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
 * Note: System-level cross-app notification creation via records.create is scoped to
 * the app's own tables. Notifications are stored in the tasklist notification_log table.
 * When the SDK supports cross-app record creation, update records.create to target
 * appId: "system", table: "notifications" directly.
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

function toDateString(d: Date): string {
  return d.toISOString().split("T")[0];
}

async function main() {
  await sdk("logger.info", { message: "Notifier agent starting" });

  const today = toDateString(new Date());
  const tomorrow = toDateString(new Date(Date.now() + 86400000));

  // Fetch all non-reusable, incomplete items with a due date of today or tomorrow
  const itemResult = await sdk<{ records: any[]; total: number }>("records.list", {
    table: "item",
    filters: [],
    limit: 10000,
  });

  const dueItems = itemResult.records.filter((r: any) => {
    const d = r.data;
    if (d.reusable) return false;
    if (d.complete) return false;
    return d.dueDate === today || d.dueDate === tomorrow;
  });

  if (dueItems.length === 0) {
    await sdk("logger.info", { message: "No items due today or tomorrow" });
    return;
  }

  await sdk("logger.info", { message: `Found ${dueItems.length} due item(s)` });

  // Fetch subscriptions for checklist-level watches
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

  // For each due item, collect the set of users to notify
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
    const type: "warning" | "info" = d.dueDate === today ? "warning" : "info";
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

  // Create system notifications
  // Note: records.create targets this app's tables. Once the SDK supports
  // cross-app record creation (appId: "system"), change table to "notifications"
  // and add appId: "system" to target the system notification center.
  for (const n of notifications) {
    const dueLabel = n.type === "warning" ? "today" : "tomorrow";
    try {
      await sdk("records.create", {
        table: "notification_log",
        data: {
          userId: n.userId,
          itemId: n.itemId,
          itemTitle: n.itemTitle,
          checklistId: n.checklistId,
          dueDate: n.dueDate,
          type: n.type,
          message: `"${n.itemTitle}" is due ${dueLabel}`,
          sentAt: new Date().toISOString(),
        },
      });
    } catch (err: any) {
      await sdk("logger.warn", { message: `Failed to log notification for user ${n.userId}: ${err.message}` });
    }
  }

  await sdk("logger.info", { message: "Notifier agent complete" });
}

main().catch(console.error);
