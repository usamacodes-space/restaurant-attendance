import { parseHHMM, validateShiftTimes } from "@/lib/shift-time";

export const WEEKDAY_OPTIONS = [
  { dayOfWeek: 1, label: "Monday" },
  { dayOfWeek: 2, label: "Tuesday" },
  { dayOfWeek: 3, label: "Wednesday" },
  { dayOfWeek: 4, label: "Thursday" },
  { dayOfWeek: 5, label: "Friday" },
  { dayOfWeek: 6, label: "Saturday" },
  { dayOfWeek: 7, label: "Sunday" },
] as const;

export type WeekdayNumber = (typeof WEEKDAY_OPTIONS)[number]["dayOfWeek"];

export type BranchOperatingHourLike = {
  dayOfWeek: number;
  openTime: string | null;
  closeTime: string | null;
};

export type BranchOperatingWindow = {
  dayOfWeek: WeekdayNumber;
  openAt: Date;
  closeAt: Date;
  crossesMidnight: boolean;
};

function utcIsoWeekday(d: Date): WeekdayNumber {
  const w = d.getUTCDay();
  return (w === 0 ? 7 : w) as WeekdayNumber;
}

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

type ParsedHours = { dayOfWeek: WeekdayNumber; openM: number; closeM: number };

function toParsed(rows: BranchOperatingHourLike[]): ParsedHours[] {
  return rows
    .map((r) => {
      const day = Number(r.dayOfWeek);
      if (!Number.isInteger(day) || day < 1 || day > 7) return null;
      const a = r.openTime?.trim() ?? "";
      const b = r.closeTime?.trim() ?? "";
      if (!a || !b) return null;
      const openM = parseHHMM(a);
      const closeM = parseHHMM(b);
      if (openM === null || closeM === null || openM === closeM) return null;
      return { dayOfWeek: day as WeekdayNumber, openM, closeM };
    })
    .filter((v): v is ParsedHours => v != null);
}

function buildWindow(anchorDate: Date, dayOfWeek: WeekdayNumber, openM: number, closeM: number): BranchOperatingWindow {
  const y = anchorDate.getUTCFullYear();
  const month = anchorDate.getUTCMonth();
  const day = anchorDate.getUTCDate();
  const openAtMs = utcAtMinuteOfDay(y, month, day, openM);
  const closesNextDay = closeM < openM;
  const endDate = closesNextDay ? addUtcCalendarDays(y, month, day, 1) : { y, month, day };
  const closeAtMs = utcAtMinuteOfDay(endDate.y, endDate.month, endDate.day, closeM);
  return {
    dayOfWeek,
    openAt: new Date(openAtMs),
    closeAt: new Date(closeAtMs),
    crossesMidnight: closesNextDay,
  };
}

export function resolveBranchOperatingWindowUtc(
  referenceAt: Date,
  rows: BranchOperatingHourLike[]
): BranchOperatingWindow | null {
  const parsed = toParsed(rows);
  if (!parsed.length) return null;
  const byDay = new Map(parsed.map((r) => [r.dayOfWeek, r] as const));

  const todayDay = utcIsoWeekday(referenceAt);
  const prevDay = (todayDay === 1 ? 7 : todayDay - 1) as WeekdayNumber;
  const t = referenceAt.getTime();

  const prevCfg = byDay.get(prevDay);
  if (prevCfg) {
    const prevDate = addUtcCalendarDays(
      referenceAt.getUTCFullYear(),
      referenceAt.getUTCMonth(),
      referenceAt.getUTCDate(),
      -1
    );
    const prevAnchor = new Date(Date.UTC(prevDate.y, prevDate.month, prevDate.day, 12, 0, 0, 0));
    const prevWin = buildWindow(prevAnchor, prevDay, prevCfg.openM, prevCfg.closeM);
    if (t >= prevWin.openAt.getTime() && t < prevWin.closeAt.getTime()) {
      return prevWin;
    }
  }

  const todayCfg = byDay.get(todayDay);
  if (todayCfg) {
    const todayAnchor = new Date(
      Date.UTC(referenceAt.getUTCFullYear(), referenceAt.getUTCMonth(), referenceAt.getUTCDate(), 12, 0, 0, 0)
    );
    const todayWin = buildWindow(todayAnchor, todayDay, todayCfg.openM, todayCfg.closeM);
    if (t >= todayWin.openAt.getTime() && t < todayWin.closeAt.getTime()) {
      return todayWin;
    }
  }

  return null;
}

export function resolveAttendanceClosingTimeUtc(checkInAt: Date, rows: BranchOperatingHourLike[]): Date | null {
  const win = resolveBranchOperatingWindowUtc(checkInAt, rows);
  return win?.closeAt ?? null;
}

export function isAttendancePastClosingTimeUtc(
  now: Date,
  attendanceCheckInAt: Date,
  rows: BranchOperatingHourLike[]
): boolean {
  const closingAt = resolveAttendanceClosingTimeUtc(attendanceCheckInAt, rows);
  if (!closingAt) return false;
  return now.getTime() > closingAt.getTime();
}

export function computeCountedCheckInAt(
  checkInAt: Date,
  rows: BranchOperatingHourLike[],
  graceMinutes = 15
): Date {
  const win = resolveBranchOperatingWindowUtc(checkInAt, rows);
  if (!win) return checkInAt;
  const t = checkInAt.getTime();
  const openMs = win.openAt.getTime();
  const graceEndMs = openMs + Math.max(0, graceMinutes) * 60_000;
  if (t >= openMs && t <= graceEndMs) return win.openAt;
  return checkInAt;
}

export function validateBranchOperatingHourInput(input: {
  dayOfWeek: number;
  openTime?: string | null;
  closeTime?: string | null;
}): { dayOfWeek: WeekdayNumber; openTime: string | null; closeTime: string | null } | { error: string } {
  const day = Number(input.dayOfWeek);
  if (!Number.isInteger(day) || day < 1 || day > 7) {
    return { error: "dayOfWeek must be between 1 (Monday) and 7 (Sunday)." };
  }

  const a = input.openTime?.trim() ?? "";
  const b = input.closeTime?.trim() ?? "";
  if (!a && !b) {
    return { dayOfWeek: day as WeekdayNumber, openTime: null, closeTime: null };
  }
  if (!a || !b) {
    return { error: `Day ${day}: provide both open and close times, or leave both empty.` };
  }

  const validated = validateShiftTimes(a, b);
  if ("error" in validated) {
    return { error: `Day ${day}: ${validated.error}` };
  }
  return { dayOfWeek: day as WeekdayNumber, openTime: validated.start, closeTime: validated.end };
}
