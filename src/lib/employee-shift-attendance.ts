import { parseHHMM } from "@/lib/shift-time";

function addUtcCalendarDays(y: number, month: number, day: number, deltaDays: number) {
  const t = Date.UTC(y, month, day, 12, 0, 0, 0) + deltaDays * 86_400_000;
  const d = new Date(t);
  return { y: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate() };
}

function utcAtMinuteOfDay(y: number, month: number, day: number, minuteOfDay: number): number {
  const h = Math.floor(minuteOfDay / 60);
  const mi = minuteOfDay % 60;
  return Date.UTC(y, month, day, h, mi, 0, 0);
}

/**
 * Shift window in UTC ms that contains check-in (overnight shifts use the instance that includes the punch).
 * Times are interpreted on the UTC calendar (same basis as work-hours exports).
 */
export function shiftWindowUtcMs(checkIn: Date, startNorm: string, endNorm: string): { s0: number; s1: number } | null {
  const startM = parseHHMM(startNorm);
  const endM = parseHHMM(endNorm);
  if (startM === null || endM === null) return null;
  if (startM === endM) return null; // invalid / empty shift length

  const y = checkIn.getUTCFullYear();
  const month = checkIn.getUTCMonth();
  const day = checkIn.getUTCDate();
  const cin = checkIn.getTime();

  if (startM < endM) {
    return {
      s0: utcAtMinuteOfDay(y, month, day, startM),
      s1: utcAtMinuteOfDay(y, month, day, endM),
    };
  }

  const pd = addUtcCalendarDays(y, month, day, -1);
  const nd = addUtcCalendarDays(y, month, day, 1);

  const sPrev = utcAtMinuteOfDay(pd.y, pd.month, pd.day, startM);
  const eToday = utcAtMinuteOfDay(y, month, day, endM);
  const sToday = utcAtMinuteOfDay(y, month, day, startM);
  const eNext = utcAtMinuteOfDay(nd.y, nd.month, nd.day, endM);

  const inShiftA = cin >= sPrev && cin < eToday;
  if (inShiftA) return { s0: sPrev, s1: eToday };

  const inShiftB = cin >= sToday && cin < eNext;
  if (inShiftB) return { s0: sToday, s1: eNext };

  return { s0: sToday, s1: eNext };
}

/**
 * Deduction = hours punched before scheduled shift start. Overtime = hours punched after scheduled shift end.
 */
export function computeShiftDeductionOvertimeHours(
  checkIn: Date,
  checkOut: Date,
  shiftStartNorm: string,
  shiftEndNorm: string
): { deductionHours: number; overtimeHours: number } {
  const win = shiftWindowUtcMs(checkIn, shiftStartNorm, shiftEndNorm);
  if (!win) return { deductionHours: 0, overtimeHours: 0 };

  const p0 = checkIn.getTime();
  const p1 = checkOut.getTime();
  if (!(p1 > p0)) return { deductionHours: 0, overtimeHours: 0 };

  const { s0, s1 } = win;

  const earlyEnd = Math.min(p1, s0);
  const earlyMs = Math.max(0, earlyEnd - p0);

  const lateStart = Math.max(p0, s1);
  const lateMs = Math.max(0, p1 - lateStart);

  const grossMs = p1 - p0;
  const grossH = grossMs / 3_600_000;
  const dedH = Math.min(earlyMs / 3_600_000, grossH);
  const otH = Math.min(lateMs / 3_600_000, grossH);

  const round2 = (x: number) => Math.round(Math.max(0, x) * 100) / 100;
  return { deductionHours: round2(dedH), overtimeHours: round2(otH) };
}
