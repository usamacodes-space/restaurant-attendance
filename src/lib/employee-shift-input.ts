import { validateShiftTimes } from "@/lib/shift-time";

export function parseEmployeeShiftFields(body: {
  shiftStartTime?: string | null;
  shiftEndTime?: string | null;
}): { shiftStartTime: string | null; shiftEndTime: string | null } | { error: string } {
  const a = body.shiftStartTime?.trim() ?? "";
  const b = body.shiftEndTime?.trim() ?? "";
  if (!a && !b) return { shiftStartTime: null, shiftEndTime: null };
  if (!a || !b) return { error: "Provide both shift start and end, or leave both empty." };
  const v = validateShiftTimes(a, b);
  if ("error" in v) return { error: v.error };
  return { shiftStartTime: v.start, shiftEndTime: v.end };
}
