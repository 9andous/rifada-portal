import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { IMAGE_CONTEXT, IMAGE_MAX_MB } from "@/lib/images";
import type { Role } from "@/server/authz/roles";
import { ForbiddenError, type Actor } from "@/server/authz/scope";
import {
  createHomeQuote,
  deleteHomeQuote,
  listHomeQuotes,
  moveHomeQuote,
  setHeroQuoteStyle,
  updateHomeQuote,
} from "@/server/services/admin/home-quotes";
import { openImage } from "@/server/services/images";
import { getHeroQuotes } from "@/server/services/public-site";
import { stageUpload } from "@/server/uploads/stage";
import { makeRoleActors } from "../support/admin";
import { db, resetDatabase } from "../support/db";
import { FIXTURES } from "../support/files";

// Leadership statements of the home page hero (D-096).

// The public loader opts into dynamic rendering with connection(), which needs a request scope.
vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), connection: async () => undefined }));

const storageRoot = mkdtempSync(join(tmpdir(), "rifada-quotes-test-"));
const previousStorage = process.env.STORAGE_DIR;
beforeAll(() => {
  process.env.STORAGE_DIR = storageRoot;
});
afterAll(() => {
  process.env.STORAGE_DIR = previousStorage;
  rmSync(storageRoot, { recursive: true, force: true });
});

let actors: Record<Role, Actor>;
let admin: Actor;

beforeEach(async () => {
  await resetDatabase();
  actors = (await makeRoleActors()).actors;
  admin = actors.SUPER_ADMIN;
});

const input = (overrides: Partial<{ quote: string; name: string; honorific: string; title: string; isActive: boolean }> = {}) => ({
  quote: "نص الكلمة",
  name: "صاحب الكلمة",
  honorific: "",
  title: "",
  isActive: true,
  ...overrides,
});

async function stagedImageId(actor: Actor) {
  const bytes = FIXTURES.png();
  const staged = await stageUpload({
    uploaderId: actor.id,
    sessionId: null,
    fileName: "صورة.png",
    declaredMime: "image/png",
    contentLength: bytes.length,
    body: Readable.from([bytes]),
    context: IMAGE_CONTEXT,
    only: { groups: ["image"], maxMb: IMAGE_MAX_MB },
  });
  if (!staged.ok) throw new Error(staged.message);
  return staged.uploadId;
}

describe("home page statements", () => {
  it("is managed by the super admin only", async () => {
    for (const role of ["UNIT_MANAGER", "SUPERVISOR", "ASSOCIATION_OFFICER"] as const) {
      await expect(createHomeQuote(actors[role], input(), null)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(listHomeQuotes(actors[role])).rejects.toBeInstanceOf(ForbiddenError);
      await expect(setHeroQuoteStyle(actors[role], "card")).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect(await db.homeQuote.count()).toBe(0);
  });

  it("adds statements at the end, with a portrait, and audits them", async () => {
    const first = await createHomeQuote(admin, input({ name: "الأول" }), null);
    const second = await createHomeQuote(admin, input({ name: "الثاني" }), { uploadId: await stagedImageId(admin) });
    if (!first.ok || !second.ok) throw new Error("create failed");

    const list = await listHomeQuotes(admin);
    expect(list.map((q) => q.name)).toEqual(["الأول", "الثاني"]);
    expect(list[0].image).toBeNull();
    expect(list[1].image).toMatch(new RegExp(`^/api/images/quote/${second.id}\\?v=`));
    expect(await openImage("quote", second.id)).toMatchObject({ mime: "image/png" });

    const actions = (await db.auditLog.findMany({ where: { entityType: "HomeQuote" }, orderBy: { createdAt: "asc" } })).map((a) => a.action);
    expect(actions).toEqual(["home_quote.created", "home_quote.created", "home_quote.image_changed"]);
  });

  it("shows only the published statements, in order, on the public page", async () => {
    const a = await createHomeQuote(admin, input({ name: "أ" }), null);
    const b = await createHomeQuote(admin, input({ name: "ب" }), null);
    const c = await createHomeQuote(admin, input({ name: "ج", isActive: false }), null);
    if (!a.ok || !b.ok || !c.ok) throw new Error("create failed");

    await moveHomeQuote(admin, b.id, "up");
    let hero = await getHeroQuotes();
    expect(hero.slides.map((s) => s.name)).toEqual(["ب", "أ"]);
    expect(hero.style).toBe("cream");

    await updateHomeQuote(admin, c.id, input({ name: "ج", isActive: true }), null);
    await setHeroQuoteStyle(admin, "card");
    hero = await getHeroQuotes();
    expect(hero.slides.map((s) => s.name)).toEqual(["ب", "أ", "ج"]);
    expect(hero.style).toBe("card");
    expect(await db.auditLog.count({ where: { action: "setting.updated", entityId: "public.heroQuoteStyle" } })).toBe(1);
  });

  it("deletes a statement and its uploaded portrait", async () => {
    const q = await createHomeQuote(admin, input(), { uploadId: await stagedImageId(admin) });
    if (!q.ok) throw new Error("create failed");
    expect(await deleteHomeQuote(admin, q.id)).toEqual({ ok: true });
    expect(await db.homeQuote.count()).toBe(0);
    expect(await openImage("quote", q.id)).toBeNull();
    expect(await db.auditLog.count({ where: { action: "home_quote.deleted", entityId: q.id } })).toBe(1);
  });

  it("drops the bundled portrait of a seeded statement when it is removed or replaced", async () => {
    const seeded = await db.homeQuote.create({ data: { ...input(), imagePath: "/images/leadership/king-salman.jpg", sortOrder: 1 } });
    expect((await listHomeQuotes(admin))[0].image).toBe("/images/leadership/king-salman.jpg");

    await updateHomeQuote(admin, seeded.id, input(), { uploadId: await stagedImageId(admin) });
    let row = await db.homeQuote.findUniqueOrThrow({ where: { id: seeded.id } });
    expect(row.imagePath).toBeNull();
    expect(row.imageKey).toMatch(/^images\//);

    const other = await db.homeQuote.create({ data: { ...input(), imagePath: "/images/leadership/crown-prince.jpg", sortOrder: 2 } });
    await updateHomeQuote(admin, other.id, input(), { remove: true });
    row = await db.homeQuote.findUniqueOrThrow({ where: { id: other.id } });
    expect(row.imagePath).toBeNull();
    expect(row.imageKey).toBeNull();
  });
});
