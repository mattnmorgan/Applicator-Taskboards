"use client";

import React, { useState, useEffect } from "react";
import { Icon } from "@applicator/sdk/components";
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

interface WidgetSection {
  id: string;
  name: string;
  items: WidgetItem[];
}

interface Props {
  settings?: {
    checklistId?: string;
    lookahead?: string;
  };
}

export default function TaskboardWidget({ settings }: Props) {
  const [checklistName, setChecklistName] = useState<string | null>(null);
  const [sections, setSections] = useState<WidgetSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [accessError, setAccessError] = useState(false);
  const [accessLevel, setAccessLevel] = useState<"owner" | "editor" | "viewer" | null>(null);
  const [showNoDueDate, setShowNoDueDate] = useState(false);

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
          setSections(data.sections || []);
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

  // Apply client-side filter for items without a due date
  const visibleSections = sections
    .map((s) => ({
      ...s,
      items: showNoDueDate ? s.items : s.items.filter((i) => i.dueDate !== null && i.dueDate !== ""),
    }))
    .filter((s) => s.items.length > 0);

  const totalItems = visibleSections.reduce((sum, s) => sum + s.items.length, 0);

  const formatDate = (d: string | null, reusable: boolean) => {
    if (!d) return null;
    if (reusable) return d;
    const date = new Date(d + "T00:00:00");
    if (isNaN(date.getTime())) return d;
    if (d === today) return "Today";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const getDueBadgeClass = (dueDate: string | null, reusable: boolean) => {
    if (!dueDate || reusable) return styles.widgetDueBadge;
    if (dueDate < today) return `${styles.widgetDueBadge} ${styles.overdue}`;
    if (dueDate === today) return `${styles.widgetDueBadge} ${styles.today}`;
    return `${styles.widgetDueBadge} ${styles.dueFuture}`;
  };

  const toggleComplete = async (item: WidgetItem, sectionId: string) => {
    if (!canCheck) return;
    setSections((prev) =>
      prev
        .map((s) => s.id === sectionId ? { ...s, items: s.items.filter((i) => i.id !== item.id) } : s)
        .filter((s) => s.items.length > 0)
    );
    try {
      const res = await fetch(`/api/tasklist/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complete: true }),
      });
      if (!res.ok) {
        setSections((prev) => {
          const found = prev.find((s) => s.id === sectionId);
          if (found) {
            return prev.map((s) => s.id === sectionId ? { ...s, items: [item, ...s.items] } : s);
          }
          return [{ id: sectionId, name: "", items: [item] }, ...prev];
        });
      }
    } catch {
      setSections((prev) => {
        const found = prev.find((s) => s.id === sectionId);
        if (found) {
          return prev.map((s) => s.id === sectionId ? { ...s, items: [item, ...s.items] } : s);
        }
        return [{ id: sectionId, name: "", items: [item] }, ...prev];
      });
    }
  };

  return (
    <div className={styles.widget}>
      <div className={styles.widgetHeader}>
        <span className={styles.widgetTitle}>{checklistName || "Checklist"}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#475569" }}>
            {lookahead === "none" ? "All" : `${lookahead}h`}
          </span>
          <button
            className={`${styles.widgetToggleBtn} ${showNoDueDate ? styles.widgetToggleBtnActive : ""}`}
            onClick={() => setShowNoDueDate((v) => !v)}
            title={showNoDueDate ? "Hide items without due date" : "Show items without due date"}
          >
            <Icon name={showNoDueDate ? "eye" : "eye-off"} size={13} />
          </button>
        </div>
      </div>

      {loading && <div className={styles.widgetEmpty}>Loading…</div>}
      {!loading && accessError && <div className={styles.widgetEmpty}>Checklist not found or access denied.</div>}
      {!loading && !accessError && totalItems === 0 && <div className={styles.widgetEmpty}>No upcoming items.</div>}

      {!loading && totalItems > 0 && (
        <div className={styles.widgetItems}>
          {visibleSections.map((section) => (
            <div key={section.id}>
              <div className={styles.widgetSectionHeader}>{section.name}</div>
              {section.items.map((item) => {
                const dateStr = formatDate(item.dueDate, item.reusable);
                return (
                  <div key={item.id} className={styles.widgetItem}>
                    {canCheck && (
                      <div
                        className={styles.widgetCheckbox}
                        onClick={() => toggleComplete(item, section.id)}
                        title="Mark complete"
                      />
                    )}
                    <div className={styles.widgetItemTitle}>{item.title}</div>
                    {item.assigneeName && (
                      <span
                        style={{
                          width: 14, height: 14, borderRadius: "50%",
                          background: "#3b82f6", color: "#fff",
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          fontSize: 8, fontWeight: 600, flexShrink: 0,
                        }}
                        title={item.assigneeName}
                      >
                        {item.assigneeName.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div className={styles.widgetItemMeta}>
                      {dateStr ? (
                        <span className={getDueBadgeClass(item.dueDate, item.reusable)}>
                          {dateStr}
                        </span>
                      ) : (
                        <span className={styles.widgetDueBadgePlaceholder} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
