import { describe, expect, it } from "vitest";
import {
  daysPhrase,
  formatGregorian,
  formatHijri,
  formatNumber,
  greeting,
  hijriYear,
  lastHijriMonths,
  requestsPhrase,
  toArabicDigits,
} from "@/lib/format";

describe("format", () => {
  it("renders Arabic-Indic digits", () => {
    expect(toArabicDigits("RF-1448-00042")).toBe("RF-١٤٤٨-٠٠٠٤٢");
    expect(formatNumber(1234)).toBe("١٬٢٣٤");
  });

  it("renders a dash for missing numbers instead of a fake value", () => {
    expect(formatNumber(null)).toBe("—");
    expect(formatNumber(undefined)).toBe("—");
    expect(formatNumber(0)).toBe("٠");
  });

  it("formats Hijri (Umm al-Qura) and Gregorian dates in Riyadh time", () => {
    const date = new Date("2026-10-22T09:00:00Z");
    expect(formatHijri(date)).toBe("١١ جمادى الأولى ١٤٤٨ هـ");
    expect(formatGregorian(date)).toBe("٢٢ أكتوبر ٢٠٢٦ م");
  });

  it("uses Riyadh time at the day boundary", () => {
    // 21:30 UTC is already the next day in Riyadh (UTC+3).
    expect(formatGregorian(new Date("2026-10-21T21:30:00Z"))).toBe("٢٢ أكتوبر ٢٠٢٦ م");
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
