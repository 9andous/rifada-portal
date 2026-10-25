import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { keepOriginalWording } from "@/lib/original-wording";
import {
  attachmentTypeCreateSchema,
  attachmentTypeUpdateSchema,
  fieldRequirementCreateSchema,
  fieldRequirementUpdateSchema,
  initiativeFormSchema,
  programFormSchema,
  requirementFromForm,
} from "@/lib/validation/taxonomy";
import { WORDING_SLIPS } from "@/lib/wording-review";

const field = (overrides: Record<string, unknown> = {}) => ({ key: "trainees_count", label: "عدد المتدربين", fieldType: "NUMBER", options: [], isRequired: true, ...overrides });

describe("requirement validation", () => {
  it("accepts a well-formed field and drops options from non-select fields", () => {
    const v = fieldRequirementCreateSchema.parse(field({ options: ["أ", "ب"] }));
    expect(v.options).toEqual([]);
    expect(v.key).toBe("trainees_count");
  });

  it.each([
    ["starts with a digit", "1count"],
    ["uses Arabic letters", "عدد"],
    ["has a hyphen", "trainee-count"],
    ["is a single letter", "a"],
    ["is too long", "a".repeat(41)],
  ])("rejects a key that %s", (_, key) => {
    expect(fieldRequirementCreateSchema.safeParse(field({ key })).success).toBe(false);
  });

  it("reserves the general request field keys", () => {
    for (const key of ["title", "description", "location", "startdate", "enddate", "targetaudience"]) {
      const r = fieldRequirementCreateSchema.safeParse(field({ key }));
      expect(r.success, key).toBe(false);
      expect(r.error?.issues[0].message).toContain("محجوز");
    }
  });

  it("requires non-empty, unique options for select fields and ignores blank lines", () => {
    expect(fieldRequirementCreateSchema.safeParse(field({ fieldType: "SELECT", options: [] })).success).toBe(false);
    expect(fieldRequirementCreateSchema.safeParse(field({ fieldType: "SELECT", options: ["", "  "] })).success).toBe(false);
    expect(fieldRequirementCreateSchema.safeParse(field({ fieldType: "SELECT", options: ["نعم", "نعم"] })).success).toBe(false);
    expect(fieldRequirementCreateSchema.safeParse(field({ fieldType: "SELECT", options: Array.from({ length: 31 }, (_, i) => `خيار ${i}`) })).success).toBe(false);
    expect(fieldRequirementCreateSchema.parse(field({ fieldType: "SELECT", options: [" نعم ", "", "لا", ""] })).options).toEqual(["نعم", "لا"]);
  });

  it("rejects unknown field types and empty labels", () => {
    expect(fieldRequirementCreateSchema.safeParse(field({ fieldType: "FILE" })).success).toBe(false);
    expect(fieldRequirementCreateSchema.safeParse(field({ label: " " })).success).toBe(false);
  });

  it("never reads a key on update (keys are immutable)", () => {
    const parsed = fieldRequirementUpdateSchema.parse(field({ key: "changed_key" }));
    expect("key" in parsed).toBe(false);
    expect("key" in attachmentTypeUpdateSchema.parse({ key: "x_y", name: "اسم", groups: ["pdf"] })).toBe(false);
  });

  it("reads the requirement form: options one per line, checkbox on/absent", () => {
    const fd = new FormData();
    fd.set("key", "level");
    fd.set("label", "المستوى");
    fd.set("fieldType", "SELECT");
    fd.set("options", "مبتدئ\r\nمتوسط\n");
    expect(requirementFromForm(fd)).toMatchObject({ options: ["مبتدئ", "متوسط", ""], isRequired: false });
  });
});

describe("attachment type validation", () => {
  it("never allows video and needs at least one group", () => {
    expect(attachmentTypeCreateSchema.safeParse({ key: "clip", name: "مقطع", groups: ["video"] }).success).toBe(false);
    expect(attachmentTypeCreateSchema.safeParse({ key: "clip", name: "مقطع", groups: [] }).success).toBe(false);
    expect(attachmentTypeCreateSchema.parse({ key: "Plan_Doc", name: "خطة", groups: ["image", "pdf"] })).toEqual({ key: "plan_doc", name: "خطة", groups: ["pdf", "image"] });
  });
});

describe("program and initiative forms", () => {
  it("accept Arabic-Indic digits for numbers and reject out-of-range values", () => {
    expect(programFormSchema.parse({ number: "٨", name: "برنامج جديد", sortOrder: "١٠" })).toMatchObject({ number: 8, sortOrder: 10 });
    expect(programFormSchema.safeParse({ number: "0", name: "برنامج", sortOrder: "0" }).success).toBe(false);
    expect(initiativeFormSchema.safeParse({ number: "2.5", name: "مبادرة" }).success).toBe(false);
    expect(initiativeFormSchema.parse({ number: "٢٥", name: "مبادرة", description: "", sourceNote: "" })).toMatchObject({ number: 25, description: null, sourceNote: null });
  });
});

describe("original wording", () => {
  it("records the original once and never overwrites it", () => {
    const first = keepOriginalWording(null, "غرس القيمية للأطفال", "غرس القيم للأطفال");
    expect(first).toBe("النص الأصلي قبل التعديل: «غرس القيمية للأطفال».");
    expect(keepOriginalWording(first, "غرس القيم للأطفال", "غرس القيم في الأطفال")).toBe(first);
  });

  it("keeps existing notes and the Phase 1b originals; no change means no note", () => {
    expect(keepOriginalWording("ملاحظة سابقة", "أ ب", "أ ب")).toBe("ملاحظة سابقة");
    expect(keepOriginalWording("يمتد في المصدر على صفين.", "اسم", "اسم جديد")).toBe("يمتد في المصدر على صفين.\nالنص الأصلي قبل التعديل: «اسم».");
    const phase1b = "صُحّح خطأ مسافات في المصدر؛ النص الأصلي: «مركز أذان و تلاوات الحرمين الشريفين».";
    expect(keepOriginalWording(phase1b, "مركز أذان وتلاوات الحرمين الشريفين", "اسم آخر")).toBe(phase1b);
  });
});

describe("wording slips", () => {
  it("lists the 10 entries of docs/COPY-REVIEW.md (11 initiatives)", () => {
    expect(WORDING_SLIPS).toHaveLength(10);
    expect(WORDING_SLIPS.flatMap((s) => s.initiatives)).toHaveLength(11);
    const doc = readFileSync("docs/COPY-REVIEW.md", "utf8");
    // The document abbreviates some names with an ellipsis, so either end of the name must appear.
    for (const slip of WORDING_SLIPS) for (const i of slip.initiatives) expect(doc.includes(i.text.slice(0, 12)) || doc.includes(i.text.slice(-12)), i.text).toBe(true);
  });
});

describe("no hard delete of taxonomy records", () => {
  function* sourceFiles(dir: string): Generator<string> {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (path.includes("generated")) continue;
      if (statSync(path).isDirectory()) yield* sourceFiles(path);
      else if (/\.(ts|tsx)$/.test(name)) yield path;
    }
  }

  it("has no delete call on programs, goals, initiatives, objectives or attachment types", () => {
    const pattern = /\b(program|programGoal|initiative|strategicObjective|attachmentType)\s*\.\s*(delete|deleteMany)\b/;
    const offenders = [...sourceFiles("src")].filter((f) => pattern.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
