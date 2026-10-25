// Display formatting. Values are stored as plain numbers and UTC dates; everything shown
// to users goes through these helpers so digits are Arabic-Indic and dates are Hijri-first.
// A fixed time zone keeps server and browser output identical (no hydration mismatch).

export const DISPLAY_TIME_ZONE = "Asia/Riyadh";

const ARABIC_INDIC = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

/** Replace Western digits in any string with Arabic-Indic digits. */
export function toArabicDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => ARABIC_INDIC[Number(d)]);
}

/**
 * A Latin fragment («PDF», «Word (docx)») inside Arabic text, wrapped in a left-to-right isolate
 * (LRI … PDI) so the bidi algorithm cannot move Arabic letters or punctuation across it. Without it,
 * a «و» glued to a Latin word lands on the far side of the word and reads as a stray «g».
 */
export function ltr(text: string): string {
  return `⁦${text}⁩`;
}

/** An Arabic list: items separated by the Arabic comma, never a «و» glued to the next item. */
export function arabicList(items: readonly string[]): string {
  return items.join("، ");
}

const numberFormat = new Intl.NumberFormat("ar-SA-u-nu-arab");

/** Format a number with Arabic-Indic digits and Arabic grouping. Null/undefined renders a dash. */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return numberFormat.format(value);
}

const hijriDate = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-arab", {
  timeZone: DISPLAY_TIME_ZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
});

const hijriDateShort = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-arab", {
  timeZone: DISPLAY_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const gregorianDate = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-arab", {
  timeZone: DISPLAY_TIME_ZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
});

const time = new Intl.DateTimeFormat("ar-SA-u-nu-arab", {
  timeZone: DISPLAY_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
});

const hijriYearParts = new Intl.DateTimeFormat("en-US-u-ca-islamic-umalqura", {
  timeZone: DISPLAY_TIME_ZONE,
  year: "numeric",
});

/** Hijri (Umm al-Qura) date, e.g. «٢٩ ربيع الآخر ١٤٤٨ هـ». */
export function formatHijri(date: Date, style: "long" | "short" = "long"): string {
  return (style === "long" ? hijriDate : hijriDateShort).format(date);
}

/** Gregorian date in Arabic, e.g. «٢٢ أكتوبر ٢٠٢٦». */
export function formatGregorian(date: Date): string {
  return gregorianDate.format(date) + " م";
}

export function formatTime(date: Date): string {
  return time.format(date);
}

/** Current Hijri (Umm al-Qura) year as a number, in the Riyadh time zone. */
export function hijriYear(date: Date = new Date()): number {
  const part = hijriYearParts.formatToParts(date).find((p) => p.type === "year");
  if (!part) throw new Error("Unable to compute Hijri year");
  return Number.parseInt(part.value, 10);
}

const riyadhHour = new Intl.DateTimeFormat("en-US", { timeZone: DISPLAY_TIME_ZONE, hour: "numeric", hourCycle: "h23" });

/** «صباح الخير» before noon and «مساء الخير» from noon, in Asia/Riyadh time. */
export function greeting(date: Date = new Date()): string {
  const hour = Number(riyadhHour.formatToParts(date).find((p) => p.type === "hour")?.value ?? "0");
  return hour < 12 ? "صباح الخير" : "مساء الخير";
}

const hijriMonthParts = new Intl.DateTimeFormat("en-US-u-ca-islamic-umalqura", {
  timeZone: DISPLAY_TIME_ZONE,
  year: "numeric",
  month: "numeric",
});
const hijriMonthName = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", { timeZone: DISPLAY_TIME_ZONE, month: "long" });

/** Hijri (Umm al-Qura) month of a date as a sortable key, e.g. "1448-05", with its Arabic name. */
export function hijriMonth(date: Date): { key: string; name: string } {
  const parts = hijriMonthParts.formatToParts(date);
  const year = Number.parseInt(parts.find((p) => p.type === "year")?.value ?? "0", 10);
  const month = Number.parseInt(parts.find((p) => p.type === "month")?.value ?? "0", 10);
  return { key: `${year}-${String(month).padStart(2, "0")}`, name: hijriMonthName.format(date) };
}

/** The last `count` Hijri months up to and including the month of `now`, oldest first. */
export function lastHijriMonths(count: number, now: Date = new Date()): { key: string; name: string }[] {
  const months: { key: string; name: string }[] = [];
  const cursor = new Date(now);
  // Step back one day at a time; a Hijri month is 29 or 30 days, so this visits every month.
  for (let i = 0; i < count * 31 && months.length < count; i++) {
    const m = hijriMonth(cursor);
    if (!months.some((x) => x.key === m.key)) months.push(m);
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return months.reverse();
}

/**
 * A day count with Arabic number agreement: «يوم واحد»، «يومان»، «٣ أيام»، «١١ يومًا».
 * Use "accusative" after words like «متأخر» («متأخر يومين»).
 */
export function daysPhrase(n: number, form: "nominative" | "accusative" = "nominative"): string {
  const abs = Math.abs(n);
  if (abs === 1) return form === "nominative" ? "يوم واحد" : "يومًا واحدًا";
  if (abs === 2) return form === "nominative" ? "يومان" : "يومين";
  if (abs >= 3 && abs <= 10) return `${formatNumber(abs)} أيام`;
  return `${formatNumber(abs)} يومًا`;
}

/**
 * The counted noun shown after a figure, with Arabic number agreement: one / two / 3–10 / 11 and above
 * (e.g. «يوم عمل»، «يوما عمل»، «أيام عمل»، «يوم عمل»; «طلب»، «طلبان»، «طلبات»، «طلبًا»).
 * Hundreds and thousands take the singular, like one.
 */
export function countUnit(n: number, forms: { one: string; two: string; few: string; many: string }): string {
  const abs = Math.abs(n);
  if (abs === 2) return forms.two;
  if (abs % 100 >= 3 && abs % 100 <= 10) return forms.few;
  if (abs % 100 === 0 || abs % 100 === 1 || abs % 100 === 2) return forms.one;
  return forms.many;
}

/** A request count with Arabic number agreement: «لا طلبات»، «طلب واحد»، «طلبان»، «٣ طلبات»، «١١ طلبًا». */
export function requestsPhrase(n: number): string {
  if (n === 0) return "لا طلبات";
  if (n === 1) return "طلب واحد";
  if (n === 2) return "طلبان";
  if (n >= 3 && n <= 10) return `${formatNumber(n)} طلبات`;
  return `${formatNumber(n)} طلبًا`;
}

/** A file size in Arabic: «٣٤٠ كيلوبايت»، «١٫٢ ميغابايت». */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${formatNumber(bytes)} بايت`;
  if (bytes < 1024 * 1024) return `${formatNumber(Math.round(bytes / 1024))} كيلوبايت`;
  return `${new Intl.NumberFormat("ar-SA-u-nu-arab", { maximumFractionDigits: 1 }).format(bytes / (1024 * 1024))} ميغابايت`;
}
