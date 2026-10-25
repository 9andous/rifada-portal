import { describe, expect, it } from "vitest";
import { TAXONOMY_SOURCE } from "@/lib/taxonomy-source";

const programs = TAXONOMY_SOURCE.programs;
const byNumber = (n: number) => programs.find((p) => p.number === n)!;

describe("taxonomy extraction (prisma/seed/taxonomy.json)", () => {
  it("has the seven programs with the initiative counts of the source", () => {
    expect(programs.map((p) => p.number)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(programs.map((p) => p.initiatives.length)).toEqual([13, 30, 26, 16, 13, 27, 18]);
    expect(programs.reduce((sum, p) => sum + p.initiatives.length, 0)).toBe(143);
  });

  it("keeps the original numbering, including the gap at 25 in program 6", () => {
    for (const p of programs) {
      const numbers = p.initiatives.map((i) => i.number);
      const expected = Array.from({ length: p.number === 6 ? 28 : p.initiatives.length }, (_, k) => k + 1).filter(
        (n) => !(p.number === 6 && n === 25),
      );
      expect(numbers).toEqual(expected);
    }
    expect(byNumber(6).numberingNote).toBeTruthy();
  });

  it("applies the accepted defaults for program 6 and program 1 initiative 2", () => {
    expect(byNumber(6).name).toBe("برنامج الحسبة والتوعية الميدانية");
    expect(byNumber(6).officialName).toBe("برنامج هيئة الأمر بالمعروف والنهي عن المنكر (الحسبة والتوعية الميدانية)");
    expect(byNumber(1).initiatives[1].name).toBe("تطبيق الحرمين الشريفين (ويشمل نسخة الواقع الافتراضي VR)");
  });

  it("keeps same-name initiatives as separate records per program", () => {
    expect(byNumber(6).initiatives.find((i) => i.number === 23)?.name).toBe("تبيان ودلالة");
    expect(byNumber(7).initiatives.find((i) => i.number === 4)?.name).toBe("تبيان ودلالة");
  });

  it("links every initiative to at least one valid objective, with no uncertain cells left", () => {
    for (const p of programs) {
      for (const i of p.initiatives) {
        expect(i.objectives.length).toBeGreaterThan(0);
        expect(new Set(i.objectives).size).toBe(i.objectives.length);
        expect(i.objectives.every((n) => n >= 1 && n <= 7)).toBe(true);
        expect(i.uncertainObjectives).toEqual([]);
      }
    }
    expect(programs.flatMap((p) => p.initiatives).reduce((sum, i) => sum + i.objectives.length, 0)).toBe(670);
  });

  it("records the source page of every initiative and the original text of every typo fix", () => {
    for (const p of programs) {
      for (const i of p.initiatives) {
        expect(i.sourcePage).toBeGreaterThanOrEqual(18);
        expect(i.sourcePage).toBeLessThanOrEqual(34);
        expect(i.name).toBe(i.name.trim());
        expect(i.name).not.toMatch(/\s{2}/);
        if (i.sourceText) expect(i.sourceText).not.toBe(i.name);
      }
    }
    expect(programs.flatMap((p) => p.initiatives).filter((i) => i.sourceText)).toHaveLength(21);
  });

  it("has the goals of every program", () => {
    expect(programs.map((p) => p.goals.length)).toEqual([12, 13, 19, 7, 17, 5, 6]);
    for (const g of programs.flatMap((p) => p.goals)) expect(g).not.toMatch(/\s{2}|^\s|\s$/);
  });
});
