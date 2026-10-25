import { readFileSync, readdirSync, statSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { attachmentDisposition, checkFileName, extensionsForGroups } from "@/lib/uploads";
import { canTriggerTransition, statusTone, validateLifecycle, type LifecycleStatus, type LifecycleTransition } from "@/lib/workflow";
import { isStorageKey, LocalDiskStorage, StorageError } from "@/server/storage/storage";

const S = (id: string, isTerminal = false): LifecycleStatus => ({ id, key: id.toUpperCase(), name: id, isTerminal });
const T = (from: string, to: string, roles: string[] = ["SUPERVISOR"], isAutomatic = false): LifecycleTransition => ({
  fromStatusId: from,
  toStatusId: to,
  allowedRoles: roles,
  isAutomatic,
});

const statuses = [S("draft"), S("submitted"), S("check"), S("review"), S("returned"), S("approved", true), S("rejected", true)];
const lifecycle = [
  T("draft", "submitted", ["ASSOCIATION_OFFICER"]),
  T("submitted", "check", [], true),
  T("check", "review", [], true),
  T("check", "draft", [], true),
  T("review", "returned", ["SUPERVISOR", "UNIT_MANAGER"]),
  T("review", "approved", ["SUPERVISOR", "UNIT_MANAGER"]),
  T("review", "rejected", ["SUPERVISOR", "UNIT_MANAGER"]),
  T("returned", "submitted", ["ASSOCIATION_OFFICER"]),
];

describe("lifecycle validation", () => {
  it("accepts the default lifecycle", () => {
    expect(validateLifecycle(statuses, lifecycle)).toEqual([]);
  });

  it("refuses any transition out of a terminal status", () => {
    expect(validateLifecycle(statuses, [...lifecycle, T("approved", "review")]).join()).toContain("حالة نهائية");
  });

  it("refuses a non-terminal status that cannot reach a terminal one", () => {
    const withoutReturn = lifecycle.filter((t) => !(t.fromStatusId === "returned"));
    expect(validateLifecycle(statuses, withoutReturn).join()).toContain("«returned»");
    const noExit = lifecycle.filter((t) => t.fromStatusId !== "review");
    const problems = validateLifecycle(statuses, noExit);
    for (const s of ["draft", "submitted", "check", "review", "returned"]) expect(problems.join()).toContain(`«${s}»`);
  });

  it("refuses duplicates and self transitions", () => {
    expect(validateLifecycle(statuses, [...lifecycle, T("draft", "submitted", ["ASSOCIATION_OFFICER"])]).join()).toContain("مكرر");
    expect(validateLifecycle(statuses, [...lifecycle, T("review", "review")]).join()).toContain("الحالة نفسها");
  });

  it("requires automatic transitions without roles and manual ones with at least one", () => {
    expect(validateLifecycle(statuses, [...lifecycle.slice(0, 1), T("submitted", "check", ["UNIT_MANAGER"], true), ...lifecycle.slice(2)]).join()).toContain("تلقائي");
    expect(validateLifecycle(statuses, [T("draft", "submitted", []), ...lifecycle.slice(1)]).join()).toContain("دورًا واحدًا");
  });

  it("refuses the super admin as a transition role", () => {
    expect(validateLifecycle(statuses, [T("draft", "submitted", ["SUPER_ADMIN"]), ...lifecycle.slice(1)]).join()).toContain("مدير النظام");
  });

  it("never lets a user trigger an automatic transition", () => {
    expect(canTriggerTransition({ allowedRoles: [], isAutomatic: true }, "UNIT_MANAGER")).toBe(false);
    expect(canTriggerTransition({ allowedRoles: ["SUPERVISOR"], isAutomatic: false }, "SUPERVISOR")).toBe(true);
    expect(canTriggerTransition({ allowedRoles: ["SUPERVISOR"], isAutomatic: false }, "ASSOCIATION_OFFICER")).toBe(false);
  });

  it("maps the Phase 1a colour tokens to status tones", () => {
    expect(["neutral", "info", "primary", "warning", "success", "danger", "nonsense"].map(statusTone)).toEqual(["neutral", "info", "review", "warn", "ok", "bad", "neutral"]);
  });
});

describe("file names and types", () => {
  it.each([
    ["خطة البرنامج.pdf", "pdf"],
    ["Plan v1.2.DOCX", "docx"],
    ["budget sheet.xlsx", "xlsx"],
    ["photo.JPEG", "jpeg"],
    ["C:\\fakepath\\scan.png", "png"],
    ["a/b/../../photo.webp", "webp"],
  ])("accepts %s", (name, ext) => {
    expect(checkFileName(name)).toMatchObject({ ok: true, ext });
  });

  it.each([
    ["legacy Word", "old.doc"],
    ["legacy Excel", "old.xls"],
    ["macro-enabled Word", "form.docm"],
    ["macro-enabled Excel", "sheet.xlsm"],
    ["SVG", "logo.svg"],
    ["HTML", "page.html"],
    ["video", "clip.mp4"],
    ["executable", "setup.exe"],
    ["no extension", "README"],
    ["only an extension", ".pdf"],
    ["double extension (script)", "invoice.php.pdf"],
    ["double extension (exe)", "report.exe.pdf"],
    ["double extension (doc)", "plan.docx.pdf"],
    ["empty", ""],
  ])("refuses %s", (_, name) => {
    expect(checkFileName(name).ok).toBe(false);
  });

  it("strips folders, control and bidi-override characters", () => {
    expect(checkFileName("..\\..\\evil\u202Efdp.png")).toMatchObject({ ok: true, name: "evilfdp.png" });
  });

  it("maps settings groups to extensions (word ⇒ docx only, excel ⇒ xlsx only)", () => {
    expect(extensionsForGroups(["word", "excel"])).toEqual(["docx", "xlsx"]);
    expect(extensionsForGroups(["pdf", "image"])).toEqual(["pdf", "png", "jpg", "jpeg", "webp"]);
  });

  it("always answers as an attachment, with an ASCII fallback and the Arabic name encoded", () => {
    const header = attachmentDisposition("نموذج خطة البرنامج (٢).pdf");
    expect(header.startsWith("attachment;")).toBe(true);
    expect(header).toContain('filename="file.pdf"');
    expect(header).toContain(`filename*=UTF-8''${encodeURIComponent("نموذج خطة البرنامج ")}%28${encodeURIComponent("٢")}%29.pdf`);
    expect(attachmentDisposition('a"b;c.pdf')).toContain('filename="abc.pdf"');
    expect(attachmentDisposition("Plan (final).docx")).toContain('filename="Plan final.docx"');
    expect(attachmentDisposition("plan.pdf")).not.toMatch(/inline/);
  });
});

describe("local storage keys", () => {
  const root = mkdtempSync(join(tmpdir(), "rifada-storage-unit-"));
  const storage = new LocalDiskStorage(root);
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it("accepts only opaque area/hex keys inside the root", () => {
    expect(isStorageKey(`templates/${"a".repeat(32)}`)).toBe(true);
    for (const key of ["../etc/passwd", "templates/../../x", `templates/${"a".repeat(31)}`, `public/${"a".repeat(32)}`, `templates/${"a".repeat(32)}.pdf`, "staging/خطة.pdf"]) {
      expect(isStorageKey(key), key).toBe(false);
      expect(() => storage.localPath(key)).toThrow(StorageError);
    }
    expect(storage.localPath(`templates/${"b".repeat(32)}`).startsWith(root)).toBe(true);
  });

  it("refuses a storage folder inside public/", () => {
    expect(() => new LocalDiskStorage(join(process.cwd(), "public", "files"))).toThrow(/public/);
  });
});

describe("no hard delete of statuses or templates", () => {
  function* sourceFiles(dir: string): Generator<string> {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (path.includes("generated")) continue;
      if (statSync(path).isDirectory()) yield* sourceFiles(path);
      else if (/\.(ts|tsx)$/.test(name)) yield path;
    }
  }

  it("has no delete call on request statuses, templates or template files", () => {
    const pattern = /\b(requestStatus|template|templateFile)\s*\.\s*(delete|deleteMany)\b/;
    expect([...sourceFiles("src")].filter((f) => pattern.test(readFileSync(f, "utf8")))).toEqual([]);
  });
});
