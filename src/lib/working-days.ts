// Working days for the review SLA: Sunday to Thursday in Asia/Riyadh (UTC+3, no daylight saving
// time); Friday and Saturday are the weekend. No public-holiday calendar yet (D-080).

const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Riyadh calendar day of an instant, as a UTC-midnight timestamp of that calendar date. */
function riyadhDayStart(date: Date): number {
  const shifted = date.getTime() + RIYADH_OFFSET_MS;
  return shifted - (((shifted % DAY_MS) + DAY_MS) % DAY_MS);
}

/** 0 = Sunday … 6 = Saturday, for a UTC-midnight day timestamp. */
const weekday = (day: number) => new Date(day).getUTCDay();

export function isWorkingDay(day: number): boolean {
  const w = weekday(day);
  return w !== 5 && w !== 6;
}

/**
 * The end (23:59:59.999 Riyadh) of the `n`th working day after the Riyadh day of `from`. The day of
 * `from` itself never counts, so a request submitted on Sunday with n = 1 is due at the end of Monday,
 * and one submitted on Friday or Saturday with n = 1 is due at the end of Sunday.
 */
export function addWorkingDays(from: Date, n: number): Date {
  if (!Number.isInteger(n) || n < 1) throw new RangeError("n must be a positive integer");
  let day = riyadhDayStart(from);
  let counted = 0;
  while (counted < n) {
    day += DAY_MS;
    if (isWorkingDay(day)) counted += 1;
  }
  return new Date(day + DAY_MS - 1 - RIYADH_OFFSET_MS);
}

/** Whole working days strictly after the Riyadh day of `from` up to and including the day of `to`. */
export function workingDaysBetween(from: Date, to: Date): number {
  let day = riyadhDayStart(from);
  const end = riyadhDayStart(to);
  let count = 0;
  while (day < end) {
    day += DAY_MS;
    if (isWorkingDay(day)) count += 1;
  }
  return count;
}

/** The Riyadh calendar date of an instant as `YYYY-MM-DD`. */
export function riyadhDateString(date: Date): string {
  return new Date(riyadhDayStart(date)).toISOString().slice(0, 10);
}
