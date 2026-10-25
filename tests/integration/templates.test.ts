import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST as uploadRoute } from "@/app/api/admin/template-uploads/route";
import { GET as downloadRoute } from "@/app/api/templates/[id]/download/route";
import { auth } from "@/server/auth/auth";
import type { Role } from "@/server/authz/roles";
import { ForbiddenError, type Actor } from "@/server/authz/scope";
import {
  createTemplate,
  getTemplateDetail,
  listTemplates,
  parseTemplateListParams,
  replaceTemplateFile,
  setTemplateArchived,
  setTemplatePublished,
  templateDownload,
  updateTemplate,
} from "@/server/services/admin/templates";
import { consumeUpload, STAGING_TTL_MS, stageUpload } from "@/server/uploads/stage";
import { makeRoleActors, makeUser, TEST_PASSWORD } from "../support/admin";
import { db, resetDatabase } from "../support/db";
import { FIXTURES } from "../support/files";
import { makeTaxonomy } from "../support/taxonomy";

// Uploaded files go to a fresh OS temp folder for this run, never into the repository.
const storageRoot = mkdtempSync(join(tmpdir(), "rifada-templates-test-"));
const previousStorage = process.env.STORAGE_DIR;
beforeAll(() => {
  process.env.STORAGE_DIR = storageRoot;
});
afterAll(() => {
  process.env.STORAGE_DIR = previousStorage;
  rmSync(storageRoot, { recursive: true, force: true });
});

const MIME = {
  pdf: "application/pdf",
  png: "image/png",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

let ctx: Awaited<ReturnType<typeof makeRoleActors>>;
let admin: Actor;
let tax: Awaited<ReturnType<typeof makeTaxonomy>>;

async function stage(actor: Actor, fileName: string, bytes: Buffer, mime: string, contentLength: number | null = bytes.length) {
  return stageUpload({ uploaderId: actor.id, sessionId: null, fileName, declaredMime: mime, contentLength, body: Readable.from([bytes]) });
}

async function stagedId(actor: Actor, fileName = "نموذج الخطة.pdf", bytes: Buffer = FIXTURES.pdf(), mime: string = MIME.pdf) {
  const r = await stage(actor, fileName, bytes, mime);
  if (!r.ok) throw new Error(r.message);
  return r.uploadId;
}

const meta = (overrides: Record<string, unknown> = {}) => ({ title: "نموذج خطة البرنامج", description: null, programId: null, initiativeId: null, attachmentTypeId: null, ...overrides });

async function makeTemplate(overrides: Record<string, unknown> = {}, publish = false) {
  const r = await createTemplate(admin, meta(overrides), await stagedId(admin));
  if (!r.ok) throw new Error(r.message);
  if (publish) await setTemplatePublished(admin, r.id, true);
  return r.id;
}

function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => join(d.parentPath, d.name));
}

beforeEach(async () => {
  await resetDatabase();
  rmSync(storageRoot, { recursive: true, force: true });
  tax = await makeTaxonomy();
  ctx = await makeRoleActors();
  admin = ctx.actors.SUPER_ADMIN;
});

describe("upload validation", () => {
  it("accepts pdf, docx, xlsx and png with matching name, type and content", async () => {
    for (const [name, bytes, mime] of [
      ["خطة.pdf", FIXTURES.pdf(), MIME.pdf],
      ["نموذج.docx", FIXTURES.docx(), MIME.docx],
      ["جدول.xlsx", FIXTURES.xlsx(), MIME.xlsx],
      ["شعار.png", FIXTURES.png(), MIME.png],
    ] as const) {
      expect(await stage(admin, name, bytes, mime), name).toMatchObject({ ok: true, fileName: name });
    }
  });

  it.each([
    ["wrong magic bytes (exe named .pdf)", "plan.pdf", () => FIXTURES.exe(), MIME.pdf, 415],
    ["plain zip named .docx", "plan.docx", () => FIXTURES.plainZip(), MIME.docx, 415],
    ["macro-enabled content named .docx", "plan.docx", () => FIXTURES.docm(), MIME.docx, 415],
    ["xlsx content named .docx", "plan.docx", () => FIXTURES.xlsx(), MIME.docx, 415],
    ["SVG named .png", "logo.png", () => FIXTURES.svg(), MIME.png, 415],
    ["HTML named .pdf", "page.pdf", () => FIXTURES.html(), MIME.pdf, 415],
    ["SVG extension", "logo.svg", () => FIXTURES.svg(), "image/svg+xml", 415],
    ["legacy .doc", "old.doc", () => FIXTURES.pdf(), "application/msword", 415],
    ["macro-enabled .docm", "form.docm", () => FIXTURES.docm(), "application/vnd.ms-word.document.macroEnabled.12", 415],
    ["video", "clip.mp4", () => FIXTURES.pdf(), "video/mp4", 415],
    ["double extension", "invoice.php.pdf", () => FIXTURES.pdf(), MIME.pdf, 415],
    ["declared type differs from the extension", "plan.pdf", () => FIXTURES.pdf(), "image/png", 415],
    ["empty file", "plan.pdf", () => Buffer.alloc(0), MIME.pdf, 400],
  ])("refuses %s", async (_, name, bytes, mime, status) => {
    const r = await stage(admin, name, bytes(), mime);
    expect(r).toMatchObject({ ok: false, status });
    expect(filesUnder(storageRoot)).toEqual([]);
  });

  it("refuses an oversize file, by Content-Length and by counting the bytes actually sent", async () => {
    await db.setting.create({ data: { key: "uploads.maxFileMb", value: 1 } });
    const big = Buffer.concat([FIXTURES.pdf(), Buffer.alloc(1024 * 1024)]);
    expect(await stage(admin, "big.pdf", big, MIME.pdf)).toMatchObject({ ok: false, status: 413 });
    expect(await stage(admin, "big.pdf", big, MIME.pdf, null)).toMatchObject({ ok: false, status: 413 });
    expect(await stage(admin, "big.pdf", big, MIME.pdf, 100)).toMatchObject({ ok: false, status: 413 });
    expect(filesUnder(storageRoot)).toEqual([]);
  });

  it("refuses a group the settings do not allow", async () => {
    await db.setting.create({ data: { key: "uploads.allowedGroups", value: ["pdf"] } });
    expect(await stage(admin, "logo.png", FIXTURES.png(), MIME.png)).toMatchObject({ ok: false, status: 415 });
  });
});

describe("staged uploads", () => {
  it("are stored under random opaque names, never the original name", async () => {
    const id = await stagedId(admin, "خطة سرية.pdf");
    expect(id).toMatch(/^[a-f0-9]{32}$/);
    const files = filesUnder(storageRoot).map((f) => f.slice(storageRoot.length + 1).replaceAll("\\", "/"));
    expect(files.sort()).toEqual([`staging/${id}`, `staging/${id}.json`]);
    expect(files.join()).not.toContain("خطة");
  });

  it("can be used once, only by the uploader, within one hour", async () => {
    const other = await makeUser("SUPER_ADMIN");
    const id = await stagedId(admin);
    expect(await consumeUpload(other.id, id, "templates")).toMatchObject({ ok: false });
    const first = await consumeUpload(admin.id, id, "templates");
    expect(first.ok).toBe(true);
    expect(await consumeUpload(admin.id, id, "templates")).toMatchObject({ ok: false });

    const late = await stagedId(admin);
    expect(await consumeUpload(admin.id, late, "templates", Date.now() + STAGING_TTL_MS + 1000)).toMatchObject({ ok: false });
    expect(await consumeUpload(admin.id, late, "templates")).toMatchObject({ ok: false }); // removed when found expired
    expect(await consumeUpload(admin.id, "../../etc/passwd", "templates")).toMatchObject({ ok: false });
  });

  it("cannot be used by another super admin to create a template", async () => {
    const other = await makeUser("SUPER_ADMIN");
    const id = await stagedId(admin);
    const r = await createTemplate({ id: other.id, role: "SUPER_ADMIN", associationId: null, programIds: [] }, meta(), id);
    expect(r).toMatchObject({ ok: false, errors: { file: expect.any(String) } });
    expect(await db.template.count()).toBe(0);
  });
});

describe("templates", () => {
  it("creates unpublished with version 1, an opaque key and the SHA-256; audit has no storage path", async () => {
    const id = await makeTemplate({ description: "يُعبأ قبل التقديم" });
    const t = await db.template.findUniqueOrThrow({ where: { id }, include: { files: true } });
    expect(t).toMatchObject({ isPublished: false, fileName: "نموذج الخطة.pdf", mime: MIME.pdf });
    expect(t.storageKey).toMatch(/^templates\/[a-f0-9]{32}$/);
    expect(t.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(t.files).toHaveLength(1);
    expect(t.currentFileId).toBe(t.files[0].id);
    const entry = await db.auditLog.findFirstOrThrow({ where: { action: "template.created" } });
    expect(JSON.stringify(entry.after)).not.toContain("templates/");
    expect(entry.after).toMatchObject({ title: "نموذج خطة البرنامج", file: { fileName: "نموذج الخطة.pdf", version: 1 } });
  });

  it("checks program, initiative and attachment type", async () => {
    const [p1, p2] = tax.programs;
    const i2 = tax.initiatives.find((i) => i.programId === p2.id)!;
    expect(await createTemplate(admin, meta({ programId: p1.id, initiativeId: i2.id }), await stagedId(admin))).toMatchObject({
      ok: false,
      errors: { initiativeId: expect.any(String) },
    });
    const fromInitiative = await createTemplate(admin, meta({ initiativeId: i2.id }), await stagedId(admin));
    if (!fromInitiative.ok) throw new Error("expected ok");
    expect((await db.template.findUniqueOrThrow({ where: { id: fromInitiative.id } })).programId).toBe(p2.id);
    await db.attachmentType.update({ where: { id: tax.types[0].id }, data: { archivedAt: new Date() } });
    expect(await createTemplate(admin, meta({ attachmentTypeId: tax.types[0].id }), await stagedId(admin))).toMatchObject({ ok: false });
  });

  it("replacing the file adds a version and keeps the previous file on disk and in the history", async () => {
    const id = await makeTemplate();
    const before = await db.template.findUniqueOrThrow({ where: { id } });
    const r = await replaceTemplateFile(admin, id, await stagedId(admin, "الخطة المحدثة.docx", FIXTURES.docx(), MIME.docx));
    expect(r).toEqual({ ok: true, version: 2 });
    const detail = await getTemplateDetail(admin, id);
    expect(detail?.files.map((f) => [f.versionNo, f.fileName])).toEqual([
      [2, "الخطة المحدثة.docx"],
      [1, "نموذج الخطة.pdf"],
    ]);
    expect(detail?.fileName).toBe("الخطة المحدثة.docx");
    expect(existsSync(join(storageRoot, ...before.storageKey.split("/")))).toBe(true);
    const entry = await db.auditLog.findFirstOrThrow({ where: { action: "template.file_replaced" } });
    expect(entry.before).toMatchObject({ file: { fileName: "نموذج الخطة.pdf", version: 1 } });
    expect(entry.after).toMatchObject({ file: { fileName: "الخطة المحدثة.docx", version: 2 } });
  });

  it("refuses a replacement identical to the current version (same SHA-256) and keeps nothing of it", async () => {
    const id = await makeTemplate();
    const before = await db.template.findUniqueOrThrow({ where: { id } });
    const filesBefore = filesUnder(join(storageRoot, "templates")).length;
    // Same bytes under another name: still the same file.
    const r = await replaceTemplateFile(admin, id, await stagedId(admin, "نسخة أخرى.pdf", FIXTURES.pdf()));
    expect(r).toMatchObject({ ok: false, errors: { file: expect.stringContaining("مطابق تمامًا للإصدار الحالي") } });
    expect(await db.templateFile.count({ where: { templateId: id } })).toBe(1);
    expect(await db.template.findUniqueOrThrow({ where: { id } })).toMatchObject({ currentFileId: before.currentFileId, fileName: before.fileName });
    expect(filesUnder(join(storageRoot, "templates"))).toHaveLength(filesBefore);
    expect(await db.auditLog.count({ where: { action: "template.file_replaced" } })).toBe(0);
    // A different revision is accepted, and an older identical file is fine once it is no longer current.
    expect(await replaceTemplateFile(admin, id, await stagedId(admin, "محدث.pdf", FIXTURES.pdf("v2")))).toEqual({ ok: true, version: 2 });
    expect(await replaceTemplateFile(admin, id, await stagedId(admin, "الأصل.pdf", FIXTURES.pdf()))).toEqual({ ok: true, version: 3 });
  });

  it("publishes, unpublishes, archives (also unpublishing) and restores; nothing is deleted", async () => {
    const id = await makeTemplate();
    await setTemplatePublished(admin, id, true);
    await setTemplateArchived(admin, id, true);
    expect(await db.template.findUniqueOrThrow({ where: { id } })).toMatchObject({ isPublished: false, archivedAt: expect.any(Date) });
    expect(await setTemplatePublished(admin, id, true)).toMatchObject({ ok: false });
    await setTemplateArchived(admin, id, false);
    expect((await db.auditLog.findMany({ where: { entityId: id }, orderBy: { createdAt: "asc" } })).map((e) => e.action)).toEqual([
      "template.created",
      "template.published",
      "template.archived",
      "template.restored",
    ]);
    expect(await db.template.count()).toBe(1);
  });

  it("are managed by the super admin only; readers see published, non-archived templates only", async () => {
    const draft = await makeTemplate({ title: "مسودة نموذج" });
    const published = await makeTemplate({ title: "نموذج منشور" }, true);
    const archived = await makeTemplate({ title: "نموذج مؤرشف" }, true);
    await setTemplateArchived(admin, archived, true);
    for (const role of ["UNIT_MANAGER", "SUPERVISOR", "ASSOCIATION_OFFICER"] as Role[]) {
      const a = ctx.actors[role];
      const reader = await listTemplates(a, parseTemplateListParams({}), "reader");
      expect(reader.items.map((t) => t.id), role).toEqual([published]);
      const calls: (() => Promise<unknown>)[] = [
        () => listTemplates(a, parseTemplateListParams({}), "admin"),
        () => getTemplateDetail(a, draft),
        () => createTemplate(a, meta(), "a".repeat(32)),
        () => updateTemplate(a, draft, meta({ title: "تغيير" })),
        () => setTemplatePublished(a, draft, true),
        () => setTemplateArchived(a, draft, true),
        () => replaceTemplateFile(a, draft, "a".repeat(32)),
      ];
      for (const call of calls) await expect(call(), role).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect((await listTemplates(admin, parseTemplateListParams({ state: "unpublished" }), "admin")).items.map((t) => t.id)).toEqual([draft]);
  });

  it("download lookup: published for every role; unpublished, archived and old versions for the super admin only", async () => {
    const published = await makeTemplate({}, true);
    await replaceTemplateFile(admin, published, await stagedId(admin, "v2.pdf", FIXTURES.pdf("v2")));
    const draft = await makeTemplate();
    const archived = await makeTemplate({}, true);
    await setTemplateArchived(admin, archived, true);
    for (const role of ["UNIT_MANAGER", "SUPERVISOR", "ASSOCIATION_OFFICER"] as Role[]) {
      const a = ctx.actors[role];
      const ok = await templateDownload(a, published);
      expect(ok?.fileName, role).toBe("v2.pdf");
      ok?.stream.destroy();
      expect(await templateDownload(a, draft), role).toBeNull();
      expect(await templateDownload(a, archived), role).toBeNull();
      expect(await templateDownload(a, published, 1), role).toBeNull();
    }
    for (const [id, version] of [[draft], [archived], [published, 1]] as [string, number?][]) {
      const file = await templateDownload(admin, id, version);
      expect(file).not.toBeNull();
      file?.stream.destroy();
    }
    expect(await templateDownload(admin, "missing")).toBeNull();
  });
});

describe("routes", () => {
  const BASE = "http://localhost:3000";
  let ip = 0;

  async function cookieFor(username: string) {
    ip += 1;
    const response = await auth.handler(
      new Request(`${BASE}/api/auth/sign-in/username`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: BASE, "x-forwarded-for": `10.60.0.${ip}` },
        body: JSON.stringify({ username, password: TEST_PASSWORD }),
      }),
    );
    expect(response.status).toBe(200);
    return response.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
  }

  const usernames = () => ({
    SUPER_ADMIN: ctx.users.admin.username!,
    UNIT_MANAGER: ctx.users.manager.username!,
    SUPERVISOR: ctx.users.supervisor.username!,
    ASSOCIATION_OFFICER: ctx.users.officer.username!,
  });

  function download(id: string, cookie?: string, version?: number) {
    const url = `${BASE}/api/templates/${id}/download${version ? `?version=${version}` : ""}`;
    return downloadRoute(new NextRequest(url, { headers: cookie ? { cookie } : {} }), { params: Promise.resolve({ id }) });
  }

  it("download: every role × published / unpublished / archived / old version, with attachment headers", async () => {
    const published = await makeTemplate({}, true);
    await replaceTemplateFile(admin, published, await stagedId(admin, "خطة البرنامج المحدثة.pdf", FIXTURES.pdf("v2")));
    const draft = await makeTemplate();
    const archived = await makeTemplate({}, true);
    await setTemplateArchived(admin, archived, true);

    expect((await download(published)).status).toBe(401);
    for (const [role, username] of Object.entries(usernames())) {
      const cookie = await cookieFor(username);
      const res = await download(published, cookie);
      expect(res.status, role).toBe(200);
      expect(res.headers.get("content-disposition")).toMatch(/^attachment; filename="file.pdf"; filename\*=UTF-8''/);
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
      expect(res.headers.get("cache-control")).toBe("private, no-store");
      expect(res.headers.get("content-type")).toBe(MIME.pdf);
      expect(res.headers.get("content-security-policy")).toBeNull();
      expect(Buffer.from(await res.arrayBuffer()).subarray(0, 5).toString("latin1")).toBe("%PDF-");
      const hidden = role === "SUPER_ADMIN" ? 200 : 404;
      for (const [id, version] of [[draft], [archived], [published, 1]] as [string, number?][]) {
        const r = await download(id, cookie, version);
        expect(r.status, `${role} ${id} ${version ?? ""}`).toBe(hidden);
        await r.arrayBuffer();
      }
    }
    const adminCookie = await cookieFor(usernames().SUPER_ADMIN);
    const malformed = await downloadRoute(new NextRequest(`${BASE}/api/templates/${published}/download?version=../1`, { headers: { cookie: adminCookie } }), {
      params: Promise.resolve({ id: published }),
    });
    expect(malformed.status).toBe(404);
  });

  function upload(cookie: string | undefined, body: Buffer, fileName: string, mime: string, origin: string | null = BASE) {
    const headers: Record<string, string> = { "content-type": mime, "x-file-name": encodeURIComponent(fileName), "content-length": String(body.length) };
    if (cookie) headers.cookie = cookie;
    if (origin) headers.origin = origin;
    return uploadRoute(new NextRequest(`${BASE}/api/admin/template-uploads`, { method: "POST", headers, body: new Uint8Array(body), duplex: "half" } as ConstructorParameters<typeof NextRequest>[1]));
  }

  it("upload: super admin only, same origin only, and the response carries only the upload id", async () => {
    expect((await upload(undefined, FIXTURES.pdf(), "a.pdf", MIME.pdf)).status).toBe(401);
    for (const [role, username] of Object.entries(usernames())) {
      const cookie = await cookieFor(username);
      const res = await upload(cookie, FIXTURES.pdf(), "خطة.pdf", MIME.pdf);
      if (role === "SUPER_ADMIN") {
        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body).toMatchObject({ uploadId: expect.stringMatching(/^[a-f0-9]{32}$/), fileName: "خطة.pdf" });
        expect(JSON.stringify(body)).not.toContain("staging/");
        expect((await upload(cookie, FIXTURES.pdf(), "a.pdf", MIME.pdf, null)).status).toBe(403);
        expect((await upload(cookie, FIXTURES.pdf(), "a.pdf", MIME.pdf, "https://evil.example")).status).toBe(403);
        expect((await upload(cookie, FIXTURES.exe(), "a.pdf", MIME.pdf)).status).toBe(415);
      } else {
        expect(res.status, role).toBe(403);
      }
    }
  });
});
