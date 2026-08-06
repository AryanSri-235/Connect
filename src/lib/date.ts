/**
 * Day handling.
 *
 * A "day" in this app is a plain `YYYY-MM-DD` string interpreted in one fixed
 * timezone (APP_TIMEZONE). All arithmetic goes through UTC noon so that adding a
 * day never lands on a DST seam and shifts the calendar date.
 */

export type Day = string; // YYYY-MM-DD

export const APP_TIMEZONE = process.env.APP_TIMEZONE || 'UTC';

const isoFormatters = new Map<string, Intl.DateTimeFormat>();

function isoFormatter(tz: string): Intl.DateTimeFormat {
  let f = isoFormatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    isoFormatters.set(tz, f);
  }
  return f;
}

/** The current calendar date in the app's timezone. */
export function today(tz: string = APP_TIMEZONE): Day {
  // en-CA formats as YYYY-MM-DD.
  return isoFormatter(tz).format(new Date());
}

/** The calendar date a given instant falls on, in the app's timezone. */
export function dayOf(date: Date | number, tz: string = APP_TIMEZONE): Day {
  return isoFormatter(tz).format(new Date(date));
}

/** Parse `YYYY-MM-DD` to a Date at UTC noon — safe for day arithmetic. */
export function parseDay(day: Day): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

export function toDay(date: Date): Day {
  return date.toISOString().slice(0, 10);
}

/** Move `n` days from `day` (negative goes back). */
export function addDays(day: Day, n: number): Day {
  const d = parseDay(day);
  d.setUTCDate(d.getUTCDate() + n);
  return toDay(d);
}

/** Whole days from `a` to `b`; positive when `b` is later. */
export function diffDays(a: Day, b: Day): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86_400_000);
}

/** Inclusive list of days from `from` to `to`. */
export function rangeDays(from: Day, to: Day): Day[] {
  const out: Day[] = [];
  const n = diffDays(from, to);
  for (let i = 0; i <= n; i++) out.push(addDays(from, i));
  return out;
}

/** The last `n` days, oldest first, ending on `end` (default: today). */
export function lastNDays(n: number, end: Day = today()): Day[] {
  return rangeDays(addDays(end, -(n - 1)), end);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(day: Day): number {
  return parseDay(day).getUTCDay();
}

/** "Mon 4 Aug" */
export function formatDay(day: Day): string {
  return parseDay(day).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

/** "4 Aug 2026" */
export function formatFullDay(day: Day): string {
  return parseDay(day).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** "today" / "yesterday" / "3 days ago" */
export function relativeDay(day: Day, ref: Day = today()): string {
  const d = diffDays(day, ref);
  if (d === 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 0) return formatDay(day);
  if (d < 7) return `${d} days ago`;
  return formatDay(day);
}

/** Month label for a heatmap column, or '' when the column doesn't start a month. */
export function monthLabel(day: Day): string {
  return parseDay(day).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
}
