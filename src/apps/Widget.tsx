"use client";

import React, { useState, useEffect } from "react";
import styles from "./App.module.css";

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

export default function Widget({ settings }: Props) {
  const [checklistName, setChecklistName] = useState<string | null>(null);
  const [items, setItems] = useState<WidgetItem[]>([]);
  const [loading, setLoading] = useState(false);

  const checklistId = settings?.checklistId?.trim();
  const lookahead = settings?.lookahead || "none";

  useEffect(() => {
    if (!checklistId) return;
    setLoading(true);
    fetch(`/api/tasklist/widget/${checklistId}?lookahead=${lookahead}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setChecklistName(data.checklistName);
          setItems(data.items || []);
        }
      })
      .catch(() => {})
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

  const formatDate = (d: string | null, reusable: boolean) => {
    if (!d) return null;
    if (reusable) return d;
    const date = new Date(d + "T00:00:00");
    if (isNaN(date.getTime())) return d;
    if (d === today) return "Today";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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

      {!loading && items.length === 0 && (
        <div className={styles.widgetEmpty}>No upcoming items.</div>
      )}

      {!loading && items.length > 0 && (
        <div className={styles.widgetItems}>
          {items.map((item) => {
            const dateStr = formatDate(item.dueDate, item.reusable);
            const isToday = item.dueDate === today && !item.reusable;
            return (
              <div key={item.id} className={styles.widgetItem}>
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
