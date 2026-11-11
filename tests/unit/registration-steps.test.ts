import { describe, expect, it } from "vitest";
import { fieldErrors } from "@/lib/validation/auth";
import { REGISTRATION_FIELD_STEP, registrationStepFields, registrationStepSchema } from "@/lib/validation/registration";

const errorsOf = (step: number, raw: Record<string, unknown>) => {
  const parsed = registrationStepSchema(step).safeParse(raw);
  return parsed.success ? {} : fieldErrors(parsed.error);
};

describe("registration steps (D-149)", () => {
  it("gives every schema field to one step", () => {
    const all = [1, 2, 3, 4].flatMap(registrationStepFields);
    // The letter and the logo are files, checked by the submission, not by the schema.
    const fileFields = ["letter", "image"];
    expect(all.sort()).toEqual(Object.keys(REGISTRATION_FIELD_STEP).filter((k) => !fileFields.includes(k)).sort());
  });

  it("checks only the fields of the step", () => {
    const errors = errorsOf(1, { contactPhone: "123", foundedYear: "", website: "" });
    expect(Object.keys(errors).sort()).toEqual(["classification", "contactPhone"]);
  });

  it("asks for the association's own classification when «أخرى» is chosen", () => {
    const base = { contactPhone: "0551234567", foundedYear: "", website: "" };
    expect(errorsOf(1, { ...base, classification: "أخرى", classificationOther: "" })).toEqual({ classificationOther: "اكتبوا تصنيف الجمعية." });
    expect(errorsOf(1, { ...base, classification: "أخرى", classificationOther: "رعاية كبار السن" })).toEqual({});
    expect(errorsOf(1, { ...base, classification: "منظمات خدمة ضيوف الرحمن" })).toEqual({});
  });

  it("requires a site and at least one of its places", () => {
    expect(errorsOf(2, { servicePlaces: [] }).serviceSite).toBeTruthy();
    expect(errorsOf(2, { serviceSite: "MADINAH", servicePlaces: [] }).servicePlaces).toBe("اختر مكانًا واحدًا على الأقل من أماكن تقديم الخدمة.");
    expect(errorsOf(2, { serviceSite: "MADINAH", servicePlaces: ["mataf"] }).servicePlaces).toBe("اختر الأماكن من أماكن الموقع المختار.");
    expect(errorsOf(2, { serviceSite: "MADINAH", servicePlaces: ["rawdah", "women"] })).toEqual({});
  });

  it("requires the first officer's phone only", () => {
    expect(errorsOf(3, { officerPhone: "", secondOfficerPhone: "" })).toEqual({ officerPhone: expect.any(String) });
    expect(errorsOf(3, { officerPhone: "0551234567", secondOfficerPhone: "12" })).toEqual({ secondOfficerPhone: expect.any(String) });
    expect(errorsOf(3, { officerPhone: "0551234567", secondOfficerPhone: "" })).toEqual({});
  });
});
