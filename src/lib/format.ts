// Display formatting. Values are stored as plain numbers and UTC dates; everything shown
// to users goes through these helpers so digits are Arabic-Indic and dates are Hijri (D-134).
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

export function formatTime(date: Date): string {
  return time.format(date);
}

/** Hijri date and Riyadh time, e.g. «٢٣ جمادى الأولى ١٤٤٨ هـ، ١:٠٤ ص»: every event shows its time (D-130). */
export function formatHijriDateTime(date: Date): string {
  return `${formatHijri(date)}، ${formatTime(date)}`;
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

export const HIJRI_MONTH_NAMES = ["محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة"] as const;

const hijriDayParts = new Intl.DateTimeFormat("en-US-u-ca-islamic-umalqura-nu-latn", {
  timeZone: DISPLAY_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

export type HijriParts = { year: number; month: number; day: number };

function hijriPartsOf(date: Date): HijriParts {
  const parts = hijriDayParts.formatToParts(date);
  const read = (type: "year" | "month" | "day") => Number.parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);
  return { year: read("year"), month: read("month"), day: read("day") };
}

/** The Hijri (Umm al-Qura) date of a stored YYYY-MM-DD value, or null when malformed. */
export function hijriPartsFromIso(iso: string): HijriParts | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const date = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : hijriPartsOf(date);
}

const DAY_MS = 86_400_000;
const HIJRI_EPOCH = Date.UTC(622, 6, 19, 12);

/**
 * The YYYY-MM-DD value of a Hijri (Umm al-Qura) date, or null when it does not exist (the 30th of a
 * 29-day month). The tables have no inverse, so this estimates the day from the mean calendar and
 * looks around it.
 */
export function isoFromHijri({ year, month, day }: HijriParts): string | null {
  const estimate = HIJRI_EPOCH + Math.round((year - 1) * 354.36667 + (month - 1) * 29.5306 + (day - 1)) * DAY_MS;
  for (let offset = -5; offset <= 5; offset++) {
    const date = new Date(estimate + offset * DAY_MS);
    const found = hijriPartsOf(date);
    if (found.year === year && found.month === month && found.day === day) return date.toISOString().slice(0, 10);
  }
  return null;
}

/** Today's Hijri (Umm al-Qura) date in the Riyadh time zone. */
export function hijriToday(): HijriParts {
  return hijriPartsOf(new Date());
}

export type HijriMonth = Pick<HijriParts, "year" | "month">;

/** A month's days for a calendar, and how many empty cells come before the first one (the week starts on Sunday). */
export function hijriMonthDays({ year, month }: HijriMonth): { days: { day: number; iso: string }[]; leading: number } {
  const days: { day: number; iso: string }[] = [];
  for (let day = 1; day <= 30; day++) {
    const iso = isoFromHijri({ year, month, day });
    if (iso) days.push({ day, iso });
  }
  return { days, leading: days.length ? new Date(`${days[0].iso}T12:00:00Z`).getUTCDay() : 0 };
}

/** The month `delta` months away. */
export function shiftHijriMonth({ year, month }: HijriMonth, delta: number): HijriMonth {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** The YYYY-MM-DD value `days` days away. */
export function isoPlusDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T12:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
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
