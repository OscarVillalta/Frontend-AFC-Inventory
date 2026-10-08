/**
 * All timestamps from the API are UTC instants. The business runs on
 * Los Angeles time, so every instant is displayed (and every "day" is computed)
 * in America/Los_Angeles regardless of the browser's own timezone.
 *
 * Calendar-date fields (order ETA, need-by, order created date) are not instants
 * and should keep being formatted with timeZone "UTC".
 */
export const APP_TIME_ZONE = "America/Los_Angeles";

type DateInput = string | number | Date | null | undefined;

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(
  value: DateInput,
  options: Intl.DateTimeFormatOptions = {},
  fallback = ""
): string {
  const date = toDate(value);
  if (!date) return fallback;
  return date.toLocaleDateString("en-US", { timeZone: APP_TIME_ZONE, ...options });
}

export function formatDateTime(
  value: DateInput,
  options: Intl.DateTimeFormatOptions = {},
  fallback = ""
): string {
  const date = toDate(value);
  if (!date) return fallback;
  return date.toLocaleString("en-US", { timeZone: APP_TIME_ZONE, ...options });
}

export function formatTime(
  value: DateInput,
  options: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" },
  fallback = ""
): string {
  const date = toDate(value);
  if (!date) return fallback;
  return date.toLocaleTimeString("en-US", { timeZone: APP_TIME_ZONE, ...options });
}

const DATE_KEY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** YYYY-MM-DD of the Los Angeles calendar day containing this instant. */
export function toLocalDateKey(value: DateInput): string {
  const date = toDate(value);
  return date ? DATE_KEY_FORMATTER.format(date) : "";
}

/** Today's Los Angeles date as YYYY-MM-DD. */
export function todayLocalKey(): string {
  return toLocalDateKey(new Date());
}

const OFFSET_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});

/** Los Angeles UTC offset (ms) at the given instant, e.g. -7h during PDT. */
function laOffsetMs(date: Date): number {
  const parts: Record<string, number> = {};
  for (const p of OFFSET_FORMATTER.formatToParts(date)) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  const wall = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return wall - Math.floor(date.getTime() / 1000) * 1000;
}

/** Instant at which the Los Angeles calendar day YYYY-MM-DD begins. */
export function localDayStart(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  const utcMidnight = Date.UTC(y, m - 1, d);
  let ts = utcMidnight - laOffsetMs(new Date(utcMidnight));
  const corrected = utcMidnight - laOffsetMs(new Date(ts));
  if (corrected !== ts) ts = corrected;
  return new Date(ts);
}

/** Shift a YYYY-MM-DD key by n calendar days. */
export function addDaysKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return shifted.toISOString().slice(0, 10);
}

/** Shift a YYYY-MM-DD key by n calendar months. */
export function addMonthsKey(key: string, months: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1 + months, d));
  return shifted.toISOString().slice(0, 10);
}

/** Day of week (0 = Sunday) for a YYYY-MM-DD key. */
export function dayOfWeekKey(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Format a YYYY-MM-DD key as a calendar date (no timezone shift). */
export function formatDateKey(key: string, options: Intl.DateTimeFormatOptions = {}): string {
  if (!key) return "";
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { timeZone: "UTC", ...options });
}
