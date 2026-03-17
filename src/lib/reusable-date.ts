/** Returns today's date as YYYY-MM-DD using the local timezone. */
export function getLocalToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Resolves a reusable item dueDate string (e.g. "1st", "EOM") to a YYYY-MM-DD
 * string for the current month. Returns null if the value is not recognized.
 */
export function resolveReusableDate(dueDate: string): string | null {
  if (!dueDate) return null;
  const upper = dueDate.trim().toUpperCase();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();

  if (upper === "EOM") {
    return `${year}-${pad(month + 1)}-${pad(lastDayOfMonth)}`;
  }

  const match = dueDate.trim().match(/^(\d{1,2})(st|nd|rd|th)$/i);
  if (match) {
    const day = parseInt(match[1], 10);
    if (day >= 1 && day <= 31) {
      const clampedDay = Math.min(day, lastDayOfMonth);
      return `${year}-${pad(month + 1)}-${pad(clampedDay)}`;
    }
  }

  return null;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
