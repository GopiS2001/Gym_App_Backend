/**
 * Date helpers.
 *
 * The app stores calendar-day columns (`recorded_date`, `logged_date`, ...) as
 * MySQL DATE values. Prisma maps those to a JS Date at UTC midnight, so every
 * calendar day we build must also be UTC midnight — otherwise the local
 * timezone offset silently shifts entries onto the previous/next day.
 */

/** Parses `YYYY-MM-DD` (or an ISO string) into a UTC-midnight Date. */
export function toDateOnly(value?: string | Date | null): Date {
  if (!value) return startOfTodayUtc();
  if (value instanceof Date) {
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    );
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) {
    return new Date(
      Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
    );
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return startOfTodayUtc();
  return new Date(
    Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()),
  );
}

export function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

/** Monday-based start of the ISO week containing `date`. */
export function startOfWeek(date: Date): Date {
  const d = toDateOnly(date);
  const day = d.getUTCDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(d, diff);
}

export function startOfMonth(date: Date): Date {
  const d = toDateOnly(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function endOfMonth(date: Date): Date {
  const d = toDateOnly(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((toDateOnly(to).getTime() - toDateOnly(from).getTime()) / 86_400_000);
}

export const WEEK_DAYS = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
] as const;

export type WeekDayName = (typeof WEEK_DAYS)[number];

export function weekDayOf(date: Date): WeekDayName {
  return WEEK_DAYS[toDateOnly(date).getUTCDay()];
}

/**
 * Builds a Prisma date filter from optional `fromDate` / `toDate` strings.
 * Returns `undefined` when neither bound is supplied so the caller can spread
 * it into a `where` clause without adding an empty object.
 */
export function dateRangeFilter(fromDate?: string, toDate?: string) {
  if (!fromDate && !toDate) return undefined;
  const filter: { gte?: Date; lte?: Date } = {};
  if (fromDate) filter.gte = toDateOnly(fromDate);
  if (toDate) filter.lte = toDateOnly(toDate);
  return filter;
}

/** Inclusive range of UTC-midnight dates between two days. */
export function eachDay(from: Date, to: Date): Date[] {
  const out: Date[] = [];
  let cursor = toDateOnly(from);
  const end = toDateOnly(to);
  while (cursor.getTime() <= end.getTime()) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return out;
}
