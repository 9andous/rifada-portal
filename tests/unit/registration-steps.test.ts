import { describe, expect, it } from "vitest";
import { fieldErrors } from "@/lib/validation/auth";
import { REGISTRATION_FIELD_STEP, registrationStepFields, registrationStepSchema } from "@/lib/validation/registration";

const errorsOf = (step: number, raw: Record<string, unknown>) => {
  const parsed = registrationStepSchema(step).safeParse(raw);
  return parsed.success ? {} : fieldErrors(parsed.error);
};

describe("registration steps", () => {
  it("gives every field to exactly one step", () => {
    const all = [1, 2, 3, 4].flatMap(registrationStepFields);
    expect(all.sort()).toEqual(Object.keys(REGISTRATION_FIELD_STEP).sort());
  });

  it("checks only the fields of the step", () => {
    const errors = errorsOf(1, { name: "جم", licenseNumber: "abc", city: "", contactPhone: "123", foundedYear: "", contactEmail: "", website: "" });
    expect(Object.keys(errors).sort()).toEqual(["city", "classification", "contactEmail", "contactPhone", "licenseNumber", "name", "region"]);
    expect(errors.username).toBeUndefined();
  });

  it("takes only a city of the chosen region", () => {
    const step1 = {
      name: "جمعية سقيا الحرم",
      licenseNumber: "1234",
      classification: "منظمات خدمة ضيوف الرحمن",
      region: "منطقة المدينة المنورة",
      contactPhone: "0551234567",
      foundedYear: "",
      contactEmail: "info@example.org",
      website: "",
    };
    expect(errorsOf(1, { ...step1, city: "ينبع" })).toEqual({});
    expect(errorsOf(1, { ...step1, city: "جدة" }).city).toBe("اختر مدينة من مدن المنطقة المختارة.");
    expect(errorsOf(1, { ...step1, city: "" }).city).toBe("اختر المدينة.");
  });

  it("passes a complete step", () => {
    const step1 = {
      name: "جمعية سقيا الحرم",
      licenseNumber: "١٢٣٤",
      classification: "منظمات خدمة ضيوف الرحمن",
      region: "منطقة مكة المكرمة",
      city: "مكة المكرمة",
      foundedYear: "",
      contactPhone: "0551234567",
      contactEmail: "info@example.org",
      website: "",
    };
    expect(errorsOf(1, step1)).toEqual({});
  });

  it("requires a programme on step 2", () => {
    expect(errorsOf(2, { programNumbers: [] }).programNumbers).toBeDefined();
    expect(errorsOf(2, { programNumbers: ["1"] })).toEqual({});
  });

  it("reports mismatched passwords on step 3", () => {
    const step3 = {
      officerName: "فهد بن سعد",
      officerNationalId: "",
      officerPhone: "0551234567",
      officerEmail: "officer@example.org",
      username: "saqya.1",
      password: "Jamiya-2026-pass",
      confirmPassword: "Jamiya-2026-other",
    };
    expect(errorsOf(3, step3)).toEqual({ confirmPassword: "كلمتا المرور غير متطابقتين." });
    expect(errorsOf(3, { ...step3, confirmPassword: step3.password })).toEqual({});
  });
});
