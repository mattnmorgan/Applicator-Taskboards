"use client";

import React, { useState, useEffect } from "react";
import styles from "@/src/apps/Taskboard.module.css";

interface WidgetItem {
  id: string;
  title: string;
  assigneeId: string | null;
  assigneeName: string | null;
  dueDate: string | null;
  reusable: boolean;
  complete: boolean;
}

interface Props {
  settings?: {
    checklistId?: string;
    lookahead?: string;
  };
}

export default function TaskboardWidget({ settings }: Props) {
  const [checklistName, setChecklistName] = useState<string | null>(null);
  const [items, setItems] = useState<WidgetItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [accessError, setAccessError] = useState(false);
  const [accessLevel, setAccessLevel] = useState<"owner" | "editor" | "viewer" | null>(null);

  const checklistId = settings?.checklistId?.trim();
  const lookahead = settings?.lookahead || "none";

  useEffect(() => {
    if (!checklistId) return;
    setLoading(true);
    setAccessError(false);
    fetch(`/api/tasklist/widget/${checklistId}?lookahead=${lookahead}`)
      .then((r) => {
        if (!r.ok) { setAccessError(true); return null; }
        return r.json();
      })
      .then((data) => {
        if (data) {
          setChecklistName(data.checklistName);
          setItems(data.items || []);
          setAccessLevel(data.accessLevel || null);
        }
      })
      .catch(() => setAccessError(true))
      .finally(() => setLoading(false));
  }, [checklistId, lookahead]);

  if (!checklistId) {
    return (
      <div className={styles.widget}>
        <div className={styles.widgetNoConfig}>
          Configure a checklist ID in widget settings.
        </div>
      </div>
    );
  }

  const today = new Date().toISOString().split("T")[0];
  const canCheck = accessLevel === "owner" || accessLevel === "editor";

  const formatDate = (d: string | null, reusable: boolean) => {
    if (!d) return null;
    if (reusable) return d;
    const date = new Date(d + "T00:00:00");
    if (isNaN(date.getTime())) return d;
    if (d === today) return "Today";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const toggleComplete = async (item: WidgetItem) => {
    if (!canCheck) return;
    const newVal = !item.complete;
    // Optimistic: remove from list (completed items are hidden in widget)
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    try {
      const res = await fetch(`/api/tasklist/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complete: newVal }),
      });
      if (!res.ok) {
        // Rollback
        setItems((prev) => [item, ...prev]);
      }
    } catch {
      setItems((prev) => [item, ...prev]);
    }
  };

  return (
    <div className={styles.widget}>
      <div className={styles.widgetHeader}>
        <span className={styles.widgetTitle}>{checklistName || "Checklist"}</span>
        <span style={{ fontSize: 11, color: "#475569" }}>
          {lookahead === "none" ? "All" : `${lookahead}h`}
        </span>
      </div>

      {loading && (
        <div className={styles.widgetEmpty}>Loading…</div>
      )}

      {!loading && accessError && (
        <div className={styles.widgetEmpty}>Checklist not found or access denied.</div>
      )}

      {!loading && !accessError && items.length === 0 && (
        <div className={styles.widgetEmpty}>No upcoming items.</div>
      )}

      {!loading && items.length > 0 && (
        <div className={styles.widgetItems}>
          {items.map((item) => {
            const dateStr = formatDate(item.dueDate, item.reusable);
            const isToday = item.dueDate === today && !item.reusable;
            return (
              <div key={item.id} className={styles.widgetItem}>
                {canCheck && (
                  <div
                    className={styles.widgetCheckbox}
                    onClick={() => toggleComplete(item)}
                    title="Mark complete"
                  />
                )}
                <div className={styles.widgetItemTitle}>
                  {item.title}
                  {item.assigneeName && (
                    <span style={{ color: "#64748b", marginLeft: 6, fontSize: 10 }}>
                      @{item.assigneeName}
                    </span>
                  )}
                </div>
                {dateStr && (
                  <div className={styles.widgetItemMeta}>
                    <span className={`${styles.widgetDueBadge} ${isToday ? styles.today : ""}`}>
                      {dateStr}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
