import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function toDate(value: Date | string | number): Date | null {
  const d = value instanceof Date ? value : new Date(value)
  return Number.isFinite(d.getTime()) ? d : null
}

/** 24-hour clock format used across the app: HH:mm */
export function formatHoursMinutes(value: Date | string | number): string {
  const d = toDate(value)
  if (!d) return "-"
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

/** Date + app-wide time format: YYYY-MM-DD HH:mm */
export function formatDateHoursMinutes(value: Date | string | number): string {
  const d = toDate(value)
  if (!d) return "-"
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day} ${formatHoursMinutes(d)}`
}
