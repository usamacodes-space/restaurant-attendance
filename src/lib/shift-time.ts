const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export function parseHHMM(s: string): number | null {
  const m = HHMM.exec(s.trim());
  if (!m) return null;
  const h = Number.parseInt(m[1]!, 10);
  const min = Number.parseInt(m[2]!, 10);
  return h * 60 + min;
}

export function normalizeHHMM(s: string): string | null {
  const total = parseHHMM(s);
  if (total === null) return null;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** True when end is earlier on the clock than start (shift runs past midnight). */
export function shiftCrossesMidnight(startNormalized: string, endNormalized: string): boolean {
  const a = parseHHMM(startNormalized);
  const b = parseHHMM(endNormalized);
  if (a === null || b === null) return false;
  return a > b;
}

export function validateShiftTimes(start: string, end: string): { start: string; end: string } | { error: string } {
  const ns = normalizeHHMM(start);
  const ne = normalizeHHMM(end);
  if (!ns || !ne) return { error: "Use 24h times like 09:00 or 17:30." };
  if (ns === ne) return { error: "Start and end cannot be the same." };
  return { start: ns, end: ne };
}
