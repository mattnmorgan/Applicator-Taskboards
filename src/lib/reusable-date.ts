/** Returns today's date as YYYY-MM-DD using the local timezone. */
export function getLocalToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const MONTH_NAMES: Record<string, number> = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8, sept: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11,
};

/**
 * Resolves a reusable item dueDate string to a YYYY-MM-DD string.
 *
 * Supported formats:
 *   "1" | "1st"           → 1st of the current month (monthly recurrence)
 *   "EOM"                 → last day of the current month
 *   "jun 1" | "jun 1st"   → June 1st; rolls to next year if already past
 *   "june 1st" | "january 15" etc. — full month names also accepted
 *
 * Returns null if the value is not recognized.
 */
export function resolveReusableDate(dueDate: string): string | null {
  if (!dueDate) return null;
  const trimmed = dueDate.trim();
  const upper = trimmed.toUpperCase();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();

  // EOM → last day of current month
  if (upper === "EOM") {
    return `${year}-${pad(month + 1)}-${pad(lastDayOfMonth)}`;
  }

  // Day-only: "1", "1st", "20th" → day in current month
  const dayOnly = trimmed.match(/^(\d{1,2})(st|nd|rd|th)?$/i);
  if (dayOnly) {
    const day = parseInt(dayOnly[1], 10);
    if (day >= 1 && day <= 31) {
      const clampedDay = Math.min(day, lastDayOfMonth);
      return `${year}-${pad(month + 1)}-${pad(clampedDay)}`;
    }
  }

  // Month + day: "jun 1", "jun 1st", "june 15th", "january 1"
  const monthDay = trimmed.match(/^([a-zA-Z]+)\s+(\d{1,2})(st|nd|rd|th)?$/i);
  if (monthDay) {
    const targetMonth = MONTH_NAMES[monthDay[1].toLowerCase()];
    const day = parseInt(monthDay[2], 10);
    if (targetMonth !== undefined && day >= 1 && day <= 31) {
      return resolveAnnualDate(year, targetMonth, day);
    }
  }

  return null;
}

/** Resolves a month+day to YYYY-MM-DD for the current year. */
function resolveAnnualDate(year: number, month: number, day: number): string {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const clampedDay = Math.min(day, lastDay);
  return `${year}-${pad(month + 1)}-${pad(clampedDay)}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
