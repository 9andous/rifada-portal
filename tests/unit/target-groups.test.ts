import { describe, expect, it } from "vitest";
import { checkCompleteness, type CompletenessInput } from "@/lib/completeness";
import { formatGoals, formatTargetGroups, parseGoals, parseTargetGroups, requestTypeLabel } from "@/lib/requests";

// D-151: target groups with numbers, the association's programme and initiatives, and «أخرى».

describe("target groups", () => {
  it("formats rows as «الفئة — العدد» lines and reads them back", () => {
    const text = formatTargetGroups([
      { name: "  الحجاج   والمعتمرون ", count: "1500" },
      { name: "طلاب الحلقات", count: "٣٠٠" },
      { name: "", count: "9" },
      { name: "المعلمون", count: "" },
    ]);
    expect(text).toBe("الحجاج والمعتمرون — ١٬٥٠٠\nطلاب الحلقات — ٣٠٠\nالمعلمون");
    expect(parseTargetGroups(text)).toEqual([
      { name: "الحجاج والمعتمرون", count: "1500" },
      { name: "طلاب الحلقات", count: "300" },
      { name: "المعلمون", count: "" },
    ]);
  });

  it("reads lines written before D-151 as groups without a number", () => {
    expect(parseTargetGroups("المؤذنون الجدد\r\nطلاب العلم — الكبار")).toEqual([
      { name: "المؤذنون الجدد", count: "" },
      { name: "طلاب العلم — الكبار", count: "" },
    ]);
    expect(parseTargetGroups(null)).toEqual([]);
  });

  it("shows the association's own words for a type that asks for them", () => {
    expect(requestTypeLabel({ name: "أخرى" }, " تمديد فترة ")).toBe("أخرى: تمديد فترة");
    expect(requestTypeLabel({ name: "تصريح إقامة نشاط" }, null)).toBe("تصريح إقامة نشاط");
    expect(requestTypeLabel(null, "x")).toBeNull();
  });
});

const input = (availability: Partial<CompletenessInput["availability"]>, beneficiaries = "الحجاج — ١٠٠"): CompletenessInput => ({
  general: {
    title: "عنوان",
    description: "وصف",
    goals: "هدف — مؤشر",
    expectedBeneficiaries: beneficiaries,
    kpis: "مؤشر",
    estimatedBudget: 1000,
    startDate: new Date("2099-01-10T00:00:00Z"),
    endDate: new Date("2099-02-10T00:00:00Z"),
  },
  custom: {},
  requirements: [],
  files: [],
  allowedGroups: ["pdf"],
  availability: {
    associationActive: true,
    track: { name: "المسار", available: true },
    requestType: { name: "اعتماد مشروع", available: true },
    program: { name: "برنامج", available: true },
    initiatives: [{ name: "مبادرة", available: true }],
    ...availability,
  },
  firstSubmission: true,
  today: "2026-11-06",
});

const codes = (i: CompletenessInput) => checkCompleteness(i).map((m) => m.code);

describe("completeness for D-151", () => {
  it("passes with a programme, an initiative and counted groups", () => {
    expect(codes(input({}))).toEqual([]);
  });

  it("asks for the programme, then for an initiative", () => {
    expect(codes(input({ program: null }))).toEqual(["program_missing"]);
    expect(codes(input({ initiatives: [] }))).toEqual(["initiatives_missing"]);
    expect(codes(input({ program: { name: "ب", available: false } }))).toEqual(["program_unavailable"]);
    expect(codes(input({ initiatives: [{ name: "م", available: true }, { name: "ن", available: false }] }))).toEqual(["initiative_unavailable"]);
  });

  it("asks for the number of each target group", () => {
    const missing = checkCompleteness(input({}, "الحجاج — ١٠٠\nالمعتمرون"));
    expect(missing.map((m) => [m.code, m.field])).toEqual([["target_group_count_missing", "expectedBeneficiaries"]]);
    expect(missing[0].message).toContain("«المعتمرون»");
  });

  it("asks for the association's words when the type requires them", () => {
    const other = { name: "أخرى", available: true, requiresDetail: true };
    expect(codes(input({ requestType: other }))).toEqual(["request_type_detail_missing"]);
    expect(codes(input({ requestType: other, requestTypeDetail: "تمديد" }))).toEqual([]);
  });
});

describe("goals written by the association, each with its measure", () => {
  it("formats rows as «الهدف — المؤشر» lines and reads them back", () => {
    const text = formatGoals([
      { goal: "  رفع   جودة الخدمة ", measure: "نسبة رضا المستفيدين" },
      { goal: "هدف — بشرطة", measure: "عدد المستفيدين — بالآلاف" },
      { goal: "", measure: "يُهمل" },
      { goal: "هدف بلا مؤشر", measure: "" },
    ]);
    expect(text).toBe("رفع جودة الخدمة — نسبة رضا المستفيدين\nهدف - بشرطة — عدد المستفيدين — بالآلاف\nهدف بلا مؤشر");
    expect(parseGoals(text)).toEqual([
      { goal: "رفع جودة الخدمة", measure: "نسبة رضا المستفيدين" },
      { goal: "هدف - بشرطة", measure: "عدد المستفيدين — بالآلاف" },
      { goal: "هدف بلا مؤشر", measure: "" },
    ]);
    expect(parseGoals(null)).toEqual([]);
  });

  it("asks for the measure of each goal", () => {
    const missing = checkCompleteness({ ...input({}), general: { ...input({}).general, goals: "هدف قديم\nهدف — مؤشر" } });
    expect(missing.map((m) => [m.code, m.field])).toEqual([["goal_measure_missing", "goals"]]);
  });
});
