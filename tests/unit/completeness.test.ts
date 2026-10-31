import { describe, expect, it } from "vitest";
import { acceptedGroups, checkCompleteness, parseNumberValue, type CompletenessInput } from "@/lib/completeness";
import { formatReference, type RequirementSpec } from "@/lib/requests";

const req = (over: Partial<RequirementSpec>): RequirementSpec => ({
  key: "k",
  label: "حقل",
  kind: "FIELD",
  fieldType: "TEXT",
  options: [],
  isRequired: true,
  sortOrder: 1,
  attachmentType: null,
  ...over,
});

const base = (over: Partial<CompletenessInput> = {}): CompletenessInput => ({
  general: {
    title: "عنوان",
    description: "وصف",
    goals: "الأهداف",
    expectedBeneficiaries: "العاملون في قطاع الحج",
    estimatedBudget: 1000,
    startDate: new Date("2099-01-10T00:00:00Z"),
    endDate: new Date("2099-02-10T00:00:00Z"),
  },
  custom: {},
  requirements: [],
  files: [],
  allowedGroups: ["pdf", "word", "excel", "image"],
  availability: { associationActive: true, track: { name: "المسار", available: true }, requestType: { name: "اعتماد مشروع", available: true } },
  firstSubmission: true,
  today: "2026-10-25",
  ...over,
});

describe("completeness check (pure)", () => {
  it("passes a complete request", () => {
    expect(checkCompleteness(base())).toEqual([]);
  });

  it("is deterministic and keeps form order", () => {
    const input = base({
      general: { title: "", description: null, goals: " ", expectedBeneficiaries: null, estimatedBudget: null, startDate: null, endDate: null },
      requirements: [req({ key: "b", sortOrder: 2 }), req({ key: "a", sortOrder: 1 }), req({ key: "f", kind: "ATTACHMENT", fieldType: null, attachmentType: { key: "f", name: "ملف", groups: ["pdf"] } })],
    });
    const first = checkCompleteness(input);
    expect(checkCompleteness(input)).toEqual(first);
    expect(first.map((m) => m.field)).toEqual(["title", "description", "goals", "expectedBeneficiaries", "startDate", "endDate", "estimatedBudget", "custom.a", "custom.b", "attachment.f"]);
  });

  it("requires the track and the request type, and refuses archived or paused ones (D-123)", () => {
    expect(checkCompleteness(base({ availability: { associationActive: true, track: null, requestType: null } })).map((m) => m.field)).toEqual(["trackId", "requestTypeId"]);
    const closed = { associationActive: true, track: { name: "م", available: false }, requestType: { name: "ن", available: false } };
    expect(checkCompleteness(base({ availability: closed })).map((m) => m.code)).toEqual(["track_unavailable", "request_type_unavailable"]);
  });

  it("requires the period and checks it (D-123)", () => {
    expect(checkCompleteness(base({ general: { ...base().general, startDate: null, endDate: null } })).map((m) => m.field)).toEqual(["startDate", "endDate"]);
    const reversed = { ...base().general, startDate: new Date("2099-03-01T00:00:00Z"), endDate: new Date("2099-02-01T00:00:00Z") };
    expect(checkCompleteness(base({ general: reversed })).map((m) => m.code)).toEqual(["end_before_start"]);
  });

  it("checks that the start date is not in the past on every submission (D-123)", () => {
    const past = { ...base().general, startDate: new Date("2026-01-01T00:00:00Z"), endDate: new Date("2026-02-01T00:00:00Z") };
    expect(checkCompleteness(base({ general: past })).map((m) => m.code)).toEqual(["start_in_past"]);
    expect(checkCompleteness(base({ general: past, firstSubmission: false })).map((m) => m.code)).toEqual(["start_in_past"]);
  });

  it("type-checks optional fields only when filled", () => {
    const requirements = [req({ key: "n", fieldType: "NUMBER", isRequired: false })];
    expect(checkCompleteness(base({ requirements }))).toEqual([]);
    expect(checkCompleteness(base({ requirements, custom: { n: "abc" } })).map((m) => m.code)).toEqual(["field_not_number"]);
    expect(checkCompleteness(base({ requirements, custom: { n: "١٢٫٥" } }))).toEqual([]);
  });

  it("requires a file of an accepted type that the settings still allow", () => {
    const requirements = [req({ key: "plan", kind: "ATTACHMENT", fieldType: null, attachmentType: { key: "plan", name: "خطة", groups: ["pdf", "image"] } })];
    expect(checkCompleteness(base({ requirements, files: [{ typeKey: "plan", mime: "application/pdf" }] }))).toEqual([]);
    expect(checkCompleteness(base({ requirements, files: [{ typeKey: "other", mime: "application/pdf" }] })).map((m) => m.code)).toEqual(["attachment_missing"]);
    expect(checkCompleteness(base({ requirements, files: [{ typeKey: "plan", mime: "application/pdf" }], allowedGroups: ["image"] })).map((m) => m.code)).toEqual(["attachment_wrong_type"]);
    expect(acceptedGroups(requirements[0], ["image", "pdf"])).toEqual(["pdf", "image"]);
  });

  it("parses numbers and formats references", () => {
    expect(parseNumberValue("٢٥")).toBe(25);
    expect(parseNumberValue("1,5")).toBe(1.5);
    expect(parseNumberValue("12abc")).toBeNull();
    expect(formatReference(1448, 7)).toBe("RF-1448-00007");
  });
});
