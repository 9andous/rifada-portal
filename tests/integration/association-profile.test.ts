import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { IMAGE_CONTEXT, IMAGE_MAX_MB } from "@/lib/images";
import { associationProfileSchema } from "@/lib/validation/association-profile";
import { ForbiddenError, type Actor } from "@/server/authz/scope";
import { getOwnAssociationProfile, updateOwnAssociationProfile } from "@/server/services/association-profile";
import { applyImageChange } from "@/server/services/images";
import { stageUpload } from "@/server/uploads/stage";
import { actorOf, makeAssociation, makeRoleActors, makeUser } from "../support/admin";
import { db, resetDatabase } from "../support/db";
import { FIXTURES } from "../support/files";

// «ملف الجمعية» (D-101): the officer reads and updates only their own association.

const storageRoot = mkdtempSync(join(tmpdir(), "rifada-profile-test-"));
const previousStorage = process.env.STORAGE_DIR;
beforeAll(() => {
  process.env.STORAGE_DIR = storageRoot;
});
afterAll(() => {
  process.env.STORAGE_DIR = previousStorage;
  rmSync(storageRoot, { recursive: true, force: true });
});

let ctx: Awaited<ReturnType<typeof makeRoleActors>>;
let officer: Actor;
let ownId: string;

beforeEach(async () => {
  await resetDatabase();
  ctx = await makeRoleActors();
  officer = ctx.actors.ASSOCIATION_OFFICER;
  ownId = officer.associationId!;
});

const input = associationProfileSchema.parse({ contactName: "سعد العتيبي", contactEmail: "INFO@Example.org", contactPhone: "٠٥٥٠١٢٣٤٥٦" });

async function stagedImage(actor: Actor) {
  const bytes = FIXTURES.png();
  const staged = await stageUpload({
    uploaderId: actor.id,
    sessionId: null,
    fileName: "شعار.png",
    declaredMime: "image/png",
    contentLength: bytes.length,
    body: Readable.from([bytes]),
    context: IMAGE_CONTEXT,
    only: { groups: ["image"], maxMb: IMAGE_MAX_MB },
  });
  if (!staged.ok) throw new Error(staged.message);
  return staged.uploadId;
}

describe("association profile", () => {
  it("is for association officers only", async () => {
    for (const role of ["SUPER_ADMIN", "UNIT_MANAGER", "SUPERVISOR"] as const) {
      await expect(getOwnAssociationProfile(ctx.actors[role])).rejects.toBeInstanceOf(ForbiddenError);
      await expect(updateOwnAssociationProfile(ctx.actors[role], input, null)).rejects.toBeInstanceOf(ForbiddenError);
    }
  });

  it("updates the officer's own contact details, normalised and audited", async () => {
    expect(await updateOwnAssociationProfile(officer, input, null)).toEqual({ ok: true });
    const a = await db.association.findUniqueOrThrow({ where: { id: ownId } });
    expect(a).toMatchObject({ contactName: "سعد العتيبي", contactEmail: "info@example.org", contactPhone: "0550123456" });
    expect(await db.auditLog.count({ where: { action: "association.profile_updated", entityId: ownId, actorId: officer.id } })).toBe(1);
    // Saving the same values again writes no audit entry.
    await updateOwnAssociationProfile(officer, input, null);
    expect(await db.auditLog.count({ where: { action: "association.profile_updated", entityId: ownId } })).toBe(1);
  });

  it("changes only the officer's own association's logo", async () => {
    expect(await updateOwnAssociationProfile(officer, input, { uploadId: await stagedImage(officer) })).toEqual({ ok: true });
    expect((await db.association.findUniqueOrThrow({ where: { id: ownId } })).logoKey).toMatch(/^images\//);

    const other = await makeAssociation("جمعية أخرى");
    await expect(applyImageChange(officer, "association", other.id, { uploadId: await stagedImage(officer) })).rejects.toBeInstanceOf(ForbiddenError);
    expect((await db.association.findUniqueOrThrow({ where: { id: other.id } })).logoKey).toBeNull();
  });

  it("refuses an inactive association and an officer without one", async () => {
    await db.association.update({ where: { id: ownId }, data: { isActive: false } });
    expect(await updateOwnAssociationProfile(officer, input, null)).toMatchObject({ ok: false });
    const loose = await makeUser("ASSOCIATION_OFFICER", { username: "loose.officer" });
    expect(await updateOwnAssociationProfile(actorOf(loose), input, null)).toMatchObject({ ok: false });
    expect(await getOwnAssociationProfile(actorOf(loose))).toBeNull();
  });

  it("requires the three contact fields", () => {
    expect(associationProfileSchema.safeParse({ contactName: "", contactEmail: "", contactPhone: "" }).success).toBe(false);
    expect(associationProfileSchema.safeParse({ contactName: "سعد", contactEmail: "a@b.co", contactPhone: "0112345678" }).success).toBe(false);
  });
});
