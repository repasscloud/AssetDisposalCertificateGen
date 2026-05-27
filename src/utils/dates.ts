/** ISO yyyy-MM-dd pattern. */
const ISO_DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/**
 * Returns true iff the string is a valid ISO yyyy-MM-dd date.
 * Only accepts the exact format — no slashes, no alternative separators.
 */
export function isIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  // Further check the calendar date is real.
  const d = new Date(value + "T00:00:00Z");
  return !isNaN(d.getTime());
}

/**
 * Parses an ISO date string into a Date object (UTC midnight).
 * Assumes the value has already passed isIsoDate.
 */
export function parseIsoDate(value: string): Date {
  return new Date(value + "T00:00:00Z");
}

/**
 * Compares two ISO date strings.
 * Returns true iff `earlier` is strictly before `later`.
 */
export function isBefore(earlier: string, later: string): boolean {
  return parseIsoDate(earlier) < parseIsoDate(later);
}

/**
 * Computes the number of calendar days between two ISO date strings.
 * Returns a positive number if `b` is after `a`.
 */
export function daysBetween(a: string, b: string): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return (parseIsoDate(b).getTime() - parseIsoDate(a).getTime()) / msPerDay;
}

/**
 * Formats a Date as an ISO-8601 datetime string with timezone offset.
 * e.g. "2026-05-28T14:30:12+10:00"
 */
export function formatDatetime(date: Date): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");

  const off = -date.getTimezoneOffset(); // minutes offset
  const sign = off >= 0 ? "+" : "-";
  const absOff = Math.abs(off);
  const offHours = Math.floor(absOff / 60);
  const offMins = absOff % 60;

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(offHours)}:${pad(offMins)}`
  );
}

/**
 * Generates a batch ID stamp from a given date.
 * Format: DISP-yyyyMMdd-HHmmss
 */
export function makeBatchId(date: Date = new Date()): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return (
    `DISP-` +
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}
