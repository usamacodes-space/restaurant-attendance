/** Monday 00:00:00.000 UTC of the week containing `d` (ISO week, Monday start). */
export function utcMondayStartOfWeek(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = x.getUTCDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  x.setUTCDate(x.getUTCDate() + mondayOffset);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

export function utcWeekRangeContaining(d: Date): { start: Date; end: Date } {
  const start = utcMondayStartOfWeek(d);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { start, end };
}

/** Calendar month in UTC: [first, first of next month). */
export function utcMonthRange(year: number, monthIndex0: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, monthIndex0, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthIndex0 + 1, 1, 0, 0, 0, 0));
  return { start, end };
}

export function parseYearMonth(s: string): { year: number; monthIndex0: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return { year, monthIndex0: month - 1 };
}
