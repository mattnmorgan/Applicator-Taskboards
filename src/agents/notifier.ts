/**
 * Nightly Notifier Agent
 * Runs at 6 AM daily to send notifications for checklist items due today or tomorrow.
 *
 * Notification recipients:
 * 1. Users who are directly assigned to an item
 * 2. Users who have an item-level subscription
 * 3. Users who have a checklist-level subscription (watches the whole checklist)
 *
 * Notification types:
 * - "warning" for items due today
 * - "info" for items due tomorrow
 *
 * Only active users receive notifications.
 */

function sdk<T = any>(method: string, params: Record<string, any>): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = Math.random().toString(36).slice(2);
    const handler = (message: any) => {
      if (message.id === id) {
        process.removeListener("message", handler);
        if (message.error) reject(new Error(message.error));
        else resolve(message.result as T);
      }
    };
    process.addListener("message", handler);
    process.send!({ id, method, params });
  });
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function getLocalToday(): string {
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

function resolveAnnualDate(year: number, month: number, day: number): string {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const clampedDay = Math.min(day, lastDay);
  return `${year}-${pad(month + 1)}-${pad(clampedDay)}`;
}

/**
 * Resolves a reusable item dueDate string to YYYY-MM-DD.
 * Supports: "1", "1st", "EOM", "jun 1", "jun 1st", "june 15th", etc.
 */
function resolveReusableDate(dueDate: string): string | null {
  if (!dueDate) return null;
  const trimmed = dueDate.trim();
  const upper = trimmed.toUpperCase();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();

  if (upper === "EOM") {
    return `${year}-${pad(month + 1)}-${pad(lastDayOfMonth)}`;
  }

  // Day-only: "1", "1st", "20th"
  const dayOnly = trimmed.match(/^(\d{1,2})(st|nd|rd|th)?$/i);
  if (dayOnly) {
    const day = parseInt(dayOnly[1], 10);
    if (day >= 1 && day <= 31) {
      const clampedDay = Math.min(day, lastDayOfMonth);
      return `${year}-${pad(month + 1)}-${pad(clampedDay)}`;
    }
  }

  // Month + day: "jun 1", "jun 1st", "june 15th"
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

async function main() {
  await sdk("logger.info", { message: "Notifier agent starting" });

  const today = getLocalToday();
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = `${tomorrowDate.getFullYear()}-${pad(tomorrowDate.getMonth() + 1)}-${pad(tomorrowDate.getDate())}`;

  // Fetch all active users so we only notify users who are still active
  const activeUsers = await sdk<any[]>("system.getUsers", { includeInactive: false });
  const activeUserIds = new Set(activeUsers.map((u: any) => u.id));

  // Fetch all incomplete items and filter to those due today or tomorrow
  const itemResult = await sdk<{ records: any[]; total: number }>("records.list", {
    table: "item",
    limit: 10000,
  });

  const dueItems = itemResult.records.filter((r: any) => {
    const d = r.data;
    if (d.complete) return false;
    if (!d.dueDate) return false;
    if (!d.reusable) {
      return d.dueDate === today || d.dueDate === tomorrow;
    }
    // Reusable: resolve ordinal/EOM date and compare
    const resolved = resolveReusableDate(d.dueDate);
    return resolved === today || resolved === tomorrow;
  });

  if (dueItems.length === 0) {
    await sdk("logger.info", { message: "No items due today or tomorrow" });
    return;
  }

  await sdk("logger.info", { message: `Found ${dueItems.length} due item(s)` });

  // Fetch subscriptions for checklist-level and item-level watches
  const subResult = await sdk<{ records: any[]; total: number }>("records.list", {
    table: "subscription",
    limit: 10000,
  });

  // Build a map: checklistId -> set of userIds watching at checklist level
  const checklistWatchers: Record<string, Set<string>> = {};
  // Build a map: itemId -> set of userIds watching at item level
  const itemWatchers: Record<string, Set<string>> = {};

  for (const sub of subResult.records) {
    const d = sub.data;
    if (d.itemId) {
      if (!itemWatchers[d.itemId]) itemWatchers[d.itemId] = new Set();
      itemWatchers[d.itemId].add(d.userId);
    } else if (d.checklistId) {
      if (!checklistWatchers[d.checklistId]) checklistWatchers[d.checklistId] = new Set();
      checklistWatchers[d.checklistId].add(d.userId);
    }
  }

  // For each due item, collect the set of active users to notify
  const notifications: Array<{
    userId: string;
    itemId: string;
    itemTitle: string;
    checklistId: string;
    dueDate: string;
    type: "warning" | "info";
  }> = [];

  for (const item of dueItems) {
    const d = item.data;
    const effectiveDate = d.reusable ? resolveReusableDate(d.dueDate) : d.dueDate;
    const type: "warning" | "info" = effectiveDate === today ? "warning" : "info";
    const usersToNotify = new Set<string>();

    // Assignee always gets notified
    if (d.assigneeId) usersToNotify.add(d.assigneeId);

    // Item-level subscribers
    const iw = itemWatchers[item.id];
    if (iw) iw.forEach((uid) => usersToNotify.add(uid));

    // Checklist-level subscribers
    const cw = checklistWatchers[d.checklistId];
    if (cw) cw.forEach((uid) => usersToNotify.add(uid));

    for (const userId of usersToNotify) {
      // Skip inactive users
      if (!activeUserIds.has(userId)) continue;

      notifications.push({
        userId,
        itemId: item.id,
        itemTitle: d.title,
        checklistId: d.checklistId,
        dueDate: d.dueDate,
        type,
      });
    }
  }

  await sdk("logger.info", { message: `Sending ${notifications.length} notification(s)` });

  for (const n of notifications) {
    const dueLabel = n.type === "warning" ? "today" : "tomorrow";
    try {
      await sdk("system.sendNotification", {
        userId: n.userId,
        title: `Task due ${dueLabel}`,
        message: `"${n.itemTitle}" is due ${dueLabel}`,
        type: n.type,
      });
    } catch (err: any) {
      await sdk("logger.warn", { message: `Failed to notify user ${n.userId}: ${err.message}` });
    }
  }

  await sdk("logger.info", { message: "Notifier agent complete" });
}

main().catch(console.error);
