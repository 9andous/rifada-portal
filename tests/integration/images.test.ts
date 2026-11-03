import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { IMAGE_CONTEXT, IMAGE_MAX_MB } from "@/lib/images";
import type { Actor } from "@/server/authz/scope";
import { applyImageChange, checkImageChange, openImage } from "@/server/services/images";
import { stageUpload } from "@/server/uploads/stage";
import { actorOf, makeAssociation, makeRoleActors, makeUser } from "../support/admin";
import { db, resetDatabase } from "../support/db";
import { FIXTURES } from "../support/files";

// Uploaded files go to a fresh OS temp folder for this run, never into the repository.
const storageRoot = mkdtempSync(join(tmpdir(), "rifada-images-test-"));
const previousStorage = process.env.STORAGE_DIR;
beforeAll(() => {
  process.env.STORAGE_DIR = storageRoot;
});
afterAll(() => {
  process.env.STORAGE_DIR = previousStorage;
  rmSync(storageRoot, { recursive: true, force: true });
});

let admin: Actor;

beforeEach(async () => {
  await resetDatabase();
  rmSync(storageRoot, { recursive: true, force: true });
  admin = (await makeRoleActors()).actors.SUPER_ADMIN;
});

function stageImage(actor: Actor, fileName: string, bytes: Buffer, mime: string, context: string | null = IMAGE_CONTEXT) {
  return stageUpload({
    uploaderId: actor.id,
    sessionId: null,
    fileName,
    declaredMime: mime,
    contentLength: bytes.length,
    body: Readable.from([bytes]),
    context,
    only: { groups: ["image"], maxMb: IMAGE_MAX_MB },
  });
}

async function stagedImageId(actor: Actor) {
  const staged = await stageImage(actor, "صورة.png", FIXTURES.png(), "image/png");
  if (!staged.ok) throw new Error(staged.message);
  return staged.uploadId;
}

describe("profile pictures and association logos", () => {
  it("accepts only images, whatever the document settings allow", async () => {
    expect(await stageImage(admin, "خطة.pdf", FIXTURES.pdf(), "application/pdf")).toMatchObject({ ok: false, status: 415 });
    expect(await stageImage(admin, "صورة.png", FIXTURES.png(), "image/png")).toMatchObject({ ok: true });
  });

  it("stores, replaces and removes a user's picture", async () => {
    const first = await stagedImageId(admin);
    expect(await checkImageChange(admin, { uploadId: first })).toEqual({ ok: true });
    expect(await applyImageChange(admin, "user", admin.id, { uploadId: first })).toEqual({ ok: true });
    const firstKey = (await db.user.findUniqueOrThrow({ where: { id: admin.id } })).avatarKey;
    expect(firstKey).toMatch(/^images\/[a-f0-9]{32}$/);
    expect(await openImage("user", admin.id)).toMatchObject({ mime: "image/png" });

    await applyImageChange(admin, "user", admin.id, { uploadId: await stagedImageId(admin) });
    const secondKey = (await db.user.findUniqueOrThrow({ where: { id: admin.id } })).avatarKey;
    expect(secondKey).not.toBe(firstKey);

    await applyImageChange(admin, "user", admin.id, { remove: true });
    expect((await db.user.findUniqueOrThrow({ where: { id: admin.id } })).avatarKey).toBeNull();
    expect(await openImage("user", admin.id)).toBeNull();
    const actions = (await db.auditLog.findMany({ where: { entityId: admin.id }, orderBy: { createdAt: "asc" } })).map((a) => a.action);
    expect(actions).toEqual(["user.image_changed", "user.image_changed", "user.image_removed"]);
  });

  it("stores an association's logo", async () => {
    const association = await makeAssociation("جمعية سقيا الحرم");
    await applyImageChange(admin, "association", association.id, { uploadId: await stagedImageId(admin) });
    expect(await openImage("association", association.id)).toMatchObject({ mime: "image/png" });
  });

  it("refuses an upload staged for documents or by someone else", async () => {
    const document = await stageImage(admin, "صورة.png", FIXTURES.png(), "image/png", null);
    if (!document.ok) throw new Error(document.message);
    expect(await checkImageChange(admin, { uploadId: document.uploadId })).toMatchObject({ ok: false, errors: { image: expect.any(String) } });

    const other = actorOf(await makeUser("SUPER_ADMIN", { username: "second.admin" }));
    expect(await checkImageChange(admin, { uploadId: await stagedImageId(other) })).toMatchObject({ ok: false });
  });
});
