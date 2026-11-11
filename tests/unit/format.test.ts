import { describe, expect, it } from "vitest";
import {
  daysPhrase,
  formatHijri,
  formatNumber,
  greeting,
  hijriMonthDays,
  hijriPartsFromIso,
  isoPlusDays,
  shiftHijriMonth,
  hijriYear,
  isoFromHijri,
  lastHijriMonths,
  requestsPhrase,
  toArabicDigits,
} from "@/lib/format";

describe("format", () => {
  it("renders Arabic-Indic digits", () => {
    expect(toArabicDigits("PRH-1448-00042")).toBe("PRH-١٤٤٨-٠٠٠٤٢");
    expect(formatNumber(1234)).toBe("١٬٢٣٤");
  });

  it("renders a dash for missing numbers instead of a fake value", () => {
    expect(formatNumber(null)).toBe("—");
    expect(formatNumber(undefined)).toBe("—");
    expect(formatNumber(0)).toBe("٠");
  });

  it("formats Hijri (Umm al-Qura) dates in Riyadh time", () => {
    expect(formatHijri(new Date("2026-10-22T09:00:00Z"))).toBe("١١ جمادى الأولى ١٤٤٨ هـ");
  });

  it("uses Riyadh time at the day boundary", () => {
    // 21:30 UTC is already the next day in Riyadh (UTC+3).
    expect(formatHijri(new Date("2026-10-21T21:30:00Z"))).toBe("١١ جمادى الأولى ١٤٤٨ هـ");
  });

  it("converts stored dates to Hijri parts and back", () => {
    expect(hijriPartsFromIso("2026-10-22")).toEqual({ year: 1448, month: 5, day: 11 });
    expect(isoFromHijri({ year: 1448, month: 5, day: 11 })).toBe("2026-10-22");
    expect(hijriPartsFromIso("not-a-date")).toBeNull();
  });

  it("round-trips every day of the picker's years", () => {
    for (let time = Date.UTC(2023, 6, 1, 12); time < Date.UTC(2044, 0, 1, 12); time += 86_400_000) {
      const iso = new Date(time).toISOString().slice(0, 10);
      expect(isoFromHijri(hijriPartsFromIso(iso)!)).toBe(iso);
    }
  });

  it("finds no date for a day the month does not have", () => {
    const lengths = Array.from({ length: 12 }, (_, i) => (isoFromHijri({ year: 1448, month: i + 1, day: 30 }) ? 30 : 29));
    expect(lengths).toContain(29);
    expect(isoFromHijri({ year: 1448, month: 1, day: 31 })).toBeNull();
  });

  it("computes the current Hijri year instead of hard-coding it", () => {
    expect(hijriYear(new Date("2026-10-22T09:00:00Z"))).toBe(1448);
    expect(hijriYear(new Date("2025-03-01T09:00:00Z"))).toBe(1446);
  });
});

describe("Arabic count phrases and greeting", () => {
  it("agree in number", () => {
    expect([0, 1, 2, 3, 11].map((n) => requestsPhrase(n))).toEqual(["لا طلبات", "طلب واحد", "طلبان", "٣ طلبات", "١١ طلبًا"]);
    expect(daysPhrase(2, "accusative")).toBe("يومين");
    expect(daysPhrase(7)).toBe("٧ أيام");
  });

  it("greets by Riyadh time", () => {
    expect(greeting(new Date("2026-10-22T05:00:00Z"))).toBe("صباح الخير"); // 08:00 Riyadh
    expect(greeting(new Date("2026-10-22T09:30:00Z"))).toBe("مساء الخير"); // 12:30 Riyadh
  });

  it("lists the last six Hijri months, oldest first", () => {
    const months = lastHijriMonths(6, new Date("2026-10-22T09:00:00Z"));
    expect(months.map((m) => m.key)).toEqual(["1447-12", "1448-01", "1448-02", "1448-03", "1448-04", "1448-05"]);
    expect(months.at(-1)?.name).toBe("جمادى الأولى");
  });
});

describe("the Hijri calendar helpers", () => {
  it("lists a month's days, ending at its real length, with the first day's place in a week from Sunday", () => {
    const { days, leading } = hijriMonthDays({ year: 1448, month: 5 });
    expect(days[0]).toEqual({ day: 1, iso: isoFromHijri({ year: 1448, month: 5, day: 1 }) });
    expect(days.at(-1)?.day).toBe(isoFromHijri({ year: 1448, month: 5, day: 30 }) ? 30 : 29);
    expect(leading).toBe(new Date(`${days[0].iso}T12:00:00Z`).getUTCDay());
    expect(days.every((d, i) => i === 0 || d.iso === isoPlusDays(days[i - 1].iso, 1))).toBe(true);
  });

  it("moves across years", () => {
    expect(shiftHijriMonth({ year: 1448, month: 12 }, 1)).toEqual({ year: 1449, month: 1 });
    expect(shiftHijriMonth({ year: 1448, month: 1 }, -1)).toEqual({ year: 1447, month: 12 });
    expect(shiftHijriMonth({ year: 1448, month: 6 }, 0)).toEqual({ year: 1448, month: 6 });
  });

  it("counts days across a Gregorian month end", () => {
    expect(isoPlusDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(isoPlusDays("2026-11-01", -7)).toBe("2026-10-25");
  });
});
