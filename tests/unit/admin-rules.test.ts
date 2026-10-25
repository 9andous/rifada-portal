import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { pageNumbers } from "@/components/ui/pagination";
import { activeNavHref, NAV } from "@/config/nav";
import { countUnit } from "@/lib/format";
import { listHref, parseListParams } from "@/lib/list-params";
import { associationFormSchema, officerFormSchema, toWesternDigits, userFormSchema } from "@/lib/validation/admin";
import { newPasswordSchema } from "@/lib/validation/auth";
import { settingsFromForm, settingsSchema } from "@/lib/validation/settings";
import { generateTemporaryPassword, TEMP_PASSWORD_LENGTH } from "@/server/auth/temp-password";
import { riyadhDayStart } from "@/server/services/admin/audit-log";
import { redactSecrets } from "@/server/services/audit";
import { SETTING_DEFAULTS } from "@/server/settings/defaults";

describe("temporary passwords", () => {
  it("meet the password policy, avoid look-alike characters and do not repeat", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const pw = generateTemporaryPassword();
      expect(pw).toHaveLength(TEMP_PASSWORD_LENGTH);
      expect(newPasswordSchema.safeParse(pw).success).toBe(true);
      expect(pw).not.toMatch(/[0O1lI]/);
      seen.add(pw);
    }
    expect(seen.size).toBe(500);
  });
});

describe("audit redaction", () => {
  it("drops secret-looking keys at any depth and keeps everything else", () => {
    const out = redactSecrets({
      username: "a",
      password: "x",
      nested: { passwordHash: "$argon2id$...", token: "t", keep: 1, list: [{ secret: "s", ok: true }] },
      apiToken: "t",
      mustChangePassword: true,
    });
    expect(out).toEqual({ username: "a", nested: { keep: 1, list: [{ ok: true }] }, mustChangePassword: true });
    expect(JSON.stringify(out)).not.toMatch(/argon2|"password|token|secret/i);
  });
});

describe("settings validation", () => {
  const valid = {
    "sla.workingDays": 7,
    "uploads.maxFileMb": 25,
    "uploads.allowedGroups": ["pdf", "image"],
    "uploads.associationQuotaMb": 2048,
    "bulk.maxItems": 25,
    "public.showInitiatives": false,
  };

  it("accepts the defaults", () => {
    const defaults = Object.fromEntries(Object.keys(valid).map((k) => [k, SETTING_DEFAULTS[k as keyof typeof SETTING_DEFAULTS]]));
    expect(settingsSchema.safeParse(defaults).success).toBe(true);
    expect(SETTING_DEFAULTS["bulk.maxItems"]).toBe(25);
    expect(SETTING_DEFAULTS["sla.workingDays"]).toBe(7);
    expect(SETTING_DEFAULTS["uploads.maxFileMb"]).toBe(25);
    expect(SETTING_DEFAULTS["public.showInitiatives"]).toBe(false);
  });

  it.each([
    ["sla.workingDays", 0],
    ["sla.workingDays", 61],
    ["sla.workingDays", 2.5],
    ["sla.workingDays", "abc"],
    ["uploads.maxFileMb", 0],
    ["uploads.maxFileMb", 101],
    ["bulk.maxItems", 0],
    ["bulk.maxItems", 101],
    ["uploads.associationQuotaMb", 99],
    ["uploads.associationQuotaMb", 51201],
    ["uploads.allowedGroups", []],
    ["uploads.allowedGroups", ["video"]],
    ["uploads.allowedGroups", ["pdf", "mp4"]],
    ["public.showInitiatives", "yes"],
  ])("rejects %s = %j with an Arabic message", (key, value) => {
    const result = settingsSchema.safeParse({ ...valid, [key]: value });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/[؀-ۿ]/);
  });

  it("reads the form, including unchecked boxes and repeated group fields", () => {
    const fd = new FormData();
    fd.set("sla.workingDays", "10");
    fd.set("uploads.maxFileMb", "5");
    fd.append("uploads.allowedGroups", "image");
    fd.append("uploads.allowedGroups", "pdf");
    fd.set("bulk.maxItems", "30");
    fd.set("uploads.associationQuotaMb", "500");
    const parsed = settingsSchema.parse(settingsFromForm(fd));
    expect(parsed).toEqual({
      "sla.workingDays": 10,
      "uploads.maxFileMb": 5,
      "uploads.allowedGroups": ["pdf", "image"],
      "uploads.associationQuotaMb": 500,
      "bulk.maxItems": 30,
      "public.showInitiatives": false,
    });
  });
});

describe("user and association forms", () => {
  const base = { username: "Sara.Ali", name: "سارة علي", email: "", phone: "", role: "UNIT_MANAGER", programIds: [], associationId: "" };

  it("normalises the username and empties optional fields to null", () => {
    const v = userFormSchema.parse(base);
    expect(v.username).toBe("sara.ali");
    expect(v.email).toBeNull();
    expect(v.phone).toBeNull();
  });

  it("requires programs for supervisors and an association for officers", () => {
    expect(userFormSchema.safeParse({ ...base, role: "SUPERVISOR" }).error?.issues[0].path).toEqual(["programIds"]);
    expect(userFormSchema.safeParse({ ...base, role: "ASSOCIATION_OFFICER" }).error?.issues[0].path).toEqual(["associationId"]);
  });

  it("drops programs and association that do not belong to the chosen role", () => {
    const v = userFormSchema.parse({ ...base, programIds: ["p1"], associationId: "a1" });
    expect(v.programIds).toEqual([]);
    expect(v.associationId).toBeNull();
  });

  it("rejects malformed usernames, emails and phones", () => {
    expect(userFormSchema.safeParse({ ...base, username: "سارة" }).success).toBe(false);
    expect(userFormSchema.safeParse({ ...base, username: ".x" }).success).toBe(false);
    // Better Auth's username plugin rejects "-", so the form must too.
    expect(userFormSchema.safeParse({ ...base, username: "sara-ali" }).success).toBe(false);
    expect(userFormSchema.safeParse({ ...base, email: "not-an-email" }).success).toBe(false);
    expect(userFormSchema.safeParse({ ...base, phone: "abc" }).success).toBe(false);
  });

  it("accepts Arabic-Indic digits in phone and license numbers", () => {
    expect(toWesternDigits("٠٥٠٠٠٠٠٠٠٣")).toBe("0500000003");
    expect(userFormSchema.parse({ ...base, phone: "٠٥٠٠٠٠٠٠٠٣" }).phone).toBe("0500000003");
    const a = associationFormSchema.parse({
      name: "جمعية البر",
      licenseNumber: "١٢٣٤",
      contactName: "خالد",
      contactEmail: "A@Example.org",
      contactPhone: "+966 50 000 0004",
    });
    expect(a.licenseNumber).toBe("1234");
    expect(a.contactEmail).toBe("a@example.org");
    expect(a.city).toBeNull();
  });

  it("requires the association name and contact name only; email, phone and the rest are optional", () => {
    const result = associationFormSchema.safeParse({});
    const fields = result.error?.issues.map((i) => i.path[0]).sort();
    expect(fields).toEqual(["contactName", "name"]);
    const minimal = associationFormSchema.parse({ name: "جمعية البر", contactName: "خالد", contactEmail: "", contactPhone: "  " });
    expect(minimal.contactEmail).toBeNull();
    expect(minimal.contactPhone).toBeNull();
    // Optional, but still validated when given.
    expect(associationFormSchema.safeParse({ name: "جمعية البر", contactName: "خالد", contactEmail: "not-mail" }).success).toBe(false);
    expect(associationFormSchema.safeParse({ name: "جمعية البر", contactName: "خالد", contactPhone: "abc" }).success).toBe(false);
    expect(officerFormSchema.safeParse({ username: "off.1", name: "مسؤول" }).success).toBe(true);
  });
});

describe("list URL state", () => {
  it("falls back to safe defaults for unknown sort, direction and page", () => {
    expect(parseListParams({ sort: "password", dir: "sideways", page: "-4" }, ["name", "createdAt"], { sort: "name", dir: "asc" })).toEqual({
      q: "",
      sort: "name",
      dir: "asc",
      page: 1,
    });
  });

  it("builds hrefs that keep filters and drop cleared keys", () => {
    expect(listHref("/admin/users", { q: "سارة", role: "SUPERVISOR", page: "3" }, { page: undefined, sort: "name" })).toBe(
      `/admin/users?q=${encodeURIComponent("سارة")}&role=SUPERVISOR&sort=name`,
    );
  });

  it("agrees the counted noun with the number", () => {
    const unit = { one: "طلب", two: "طلبان", few: "طلبات", many: "طلبًا" };
    expect([1, 2, 3, 10, 11, 25, 99, 100, 101, 103].map((n) => countUnit(n, unit))).toEqual([
      "طلب",
      "طلبان",
      "طلبات",
      "طلبات",
      "طلبًا",
      "طلبًا",
      "طلبًا",
      "طلب",
      "طلب",
      "طلبات",
    ]);
  });

  it("numbers pages with gaps", () => {
    expect(pageNumbers(1, 1)).toEqual([1]);
    expect(pageNumbers(5, 10)).toEqual([1, null, 4, 5, 6, null, 10]);
    expect(pageNumbers(2, 3)).toEqual([1, 2, 3]);
  });

  it("interprets audit dates as Riyadh calendar days", () => {
    expect(riyadhDayStart("2026-10-24")?.toISOString()).toBe("2026-10-23T21:00:00.000Z");
    expect(riyadhDayStart("2026-02-30")).toBeNull();
    expect(riyadhDayStart("24/10/2026")).toBeNull();
  });
});

describe("navigation (Phase 2a)", () => {
  const links = (role: keyof typeof NAV) => NAV[role].filter((i) => i.href).map((i) => i.href);

  it("activates the Phase 2 and Phase 3 screens for the right roles only", () => {
    expect(links("SUPER_ADMIN")).toEqual(["/admin", "/admin/users", "/admin/associations", "/admin/taxonomy", "/admin/settings", "/admin/audit"]);
    expect(links("UNIT_MANAGER")).toEqual(["/manager", "/manager/requests", "/manager/assignment", "/manager/associations", "/manager/taxonomy"]);
    expect(links("SUPERVISOR")).toEqual(["/supervisor", "/supervisor/queue", "/supervisor/requests", "/supervisor/templates"]);
    expect(links("ASSOCIATION_OFFICER")).toEqual(["/association", "/association/requests", "/association/requests/new", "/association/documents"]);
  });

  it("marks only the most specific matching item active", () => {
    const items = NAV.ASSOCIATION_OFFICER;
    expect(activeNavHref(items, "/association", "/association/requests/new")).toBe("/association/requests/new");
    expect(activeNavHref(items, "/association", "/association/requests/abc")).toBe("/association/requests");
    expect(activeNavHref(items, "/association", "/association")).toBe("/association");
    expect(activeNavHref(items, "/association", "/association/requestsx")).toBeNull();
    expect(activeNavHref(items, "/association", null)).toBeNull();
  });

  it("keeps every link inside the role's own area", () => {
    for (const role of Object.keys(NAV) as (keyof typeof NAV)[]) {
      const home = links(role)[0]!;
      for (const href of links(role)) expect(href === home || href!.startsWith(`${home}/`)).toBe(true);
    }
  });
});

describe("audit log is append-only", () => {
  function* sourceFiles(dir: string): Generator<string> {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (path.includes("generated")) continue;
      if (statSync(path).isDirectory()) yield* sourceFiles(path);
      else if (/\.(ts|tsx)$/.test(name)) yield path;
    }
  }

  it("has no code path that updates or deletes audit rows", () => {
    const offenders: string[] = [];
    for (const file of [...sourceFiles("src"), ...sourceFiles("prisma"), ...sourceFiles("scripts")]) {
      if (/auditLog\s*\.\s*(update|updateMany|upsert|delete|deleteMany)\b|audit_logs[^\n]*(UPDATE|DELETE)/i.test(readFileSync(file, "utf8"))) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
