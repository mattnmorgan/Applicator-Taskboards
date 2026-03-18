"use client";

import React, { useState, useEffect } from "react";
import { Icon, Tooltip } from "@applicator/sdk/components";
import styles from "@/src/apps/Taskboard.module.css";
import { resolveReusableDate, getLocalToday } from "@/src/lib/reusable-date";

interface WidgetItem {
  id: string;
  title: string;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneePicture: string | null;
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
    maxItems?: string;
    displayDatelessItems?: string;
  };
}

// Approximate height per item row (padding + content + gap)
const ITEM_ROW_PX = 34;

export default function TaskboardWidget({ settings }: Props) {
  const [checklistName, setChecklistName] = useState<string | null>(null);
  const [sections, setSections] = useState<WidgetSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [accessError, setAccessError] = useState(false);
  const [accessLevel, setAccessLevel] = useState<
    "owner" | "editor" | "viewer" | null
  >(null);
  const [showNoDueDate, setShowNoDueDate] = useState(
    settings?.displayDatelessItems === "true",
  );

  const checklistId = settings?.checklistId?.trim();
  const lookahead = settings?.lookahead || "none";
  const maxItems = Math.max(1, parseInt(settings?.maxItems || "5", 10) || 5);
  const defaultShowDateless = settings?.displayDatelessItems === "true";

  useEffect(() => {
    setShowNoDueDate(defaultShowDateless);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.displayDatelessItems]);

  useEffect(() => {
    if (!checklistId) return;
    setLoading(true);
    setAccessError(false);
    fetch(`/api/tasklist/widget/${checklistId}?lookahead=${lookahead}`)
      .then((r) => {
        if (!r.ok) {
          setAccessError(true);
          return null;
        }
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

  const today = getLocalToday();
  const canCheck = accessLevel === "owner" || accessLevel === "editor";

  // Apply client-side filter for items without a due date
  const visibleSections = sections
    .map((s) => ({
      ...s,
      items: showNoDueDate
        ? s.items
        : s.items.filter((i) => i.dueDate !== null && i.dueDate !== ""),
    }))
    .filter((s) => s.items.length > 0);

  const totalItems = visibleSections.reduce(
    (sum, s) => sum + s.items.length,
    0,
  );

  const formatDate = (d: string | null, reusable: boolean) => {
    if (!d) return null;
    if (reusable) return d; // show raw ordinal/EOM text
    const date = new Date(d + "T00:00:00");
    if (isNaN(date.getTime())) return d;
    if (d === today) return "Today";
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };

  const getReusableDueStatus = (
    dueDate: string,
  ): "today" | "future" | "overdue" | "none" => {
    const resolved = resolveReusableDate(dueDate);
    if (!resolved) return "none";
    if (resolved < today) return "overdue";
    if (resolved === today) return "today";
    return "future";
  };

  const getDueBadgeClass = (item: WidgetItem) => {
    const { dueDate, reusable, complete } = item;
    if (!dueDate) return styles.widgetDueBadge;
    // Completed reusable items are greyed (checked off for the month)
    if (complete && reusable) return styles.widgetDueBadge;
    if (!reusable) {
      if (dueDate < today) return `${styles.widgetDueBadge} ${styles.overdue}`;
      if (dueDate === today) return `${styles.widgetDueBadge} ${styles.today}`;
      return `${styles.widgetDueBadge} ${styles.dueFuture}`;
    }
    // Reusable with ordinal/EOM date
    const status = getReusableDueStatus(dueDate);
    if (status === "overdue")
      return `${styles.widgetDueBadge} ${styles.overdue}`;
    if (status === "today") return `${styles.widgetDueBadge} ${styles.today}`;
    if (status === "future")
      return `${styles.widgetDueBadge} ${styles.dueFuture}`;
    return styles.widgetDueBadge;
  };

  const toggleComplete = async (item: WidgetItem, sectionId: string) => {
    if (!canCheck) return;

    // Non-reusable: remove on check
    setSections((prev) =>
      prev
        .map((s) =>
          s.id === sectionId
            ? { ...s, items: s.items.filter((i) => i.id !== item.id) }
            : s,
        )
        .filter((s) => s.items.length > 0),
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
            return prev.map((s) =>
              s.id === sectionId ? { ...s, items: [item, ...s.items] } : s,
            );
          }
          return [{ id: sectionId, name: "", items: [item] }, ...prev];
        });
      }
    } catch {
      setSections((prev) => {
        const found = prev.find((s) => s.id === sectionId);
        if (found) {
          return prev.map((s) =>
            s.id === sectionId ? { ...s, items: [item, ...s.items] } : s,
          );
        }
        return [{ id: sectionId, name: "", items: [item] }, ...prev];
      });
    }
  };

  return (
    <div className={styles.widget}>
      <div className={styles.widgetHeader}>
        <span className={styles.widgetTitle}>
          {checklistName || "Checklist"}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#475569" }}>
            {lookahead === "none" ? "All" : `${lookahead}h`}
          </span>
          <Tooltip
            text={
              showNoDueDate
                ? "Hide items without dates"
                : "Display items without dates"
            }
            placement="bottom"
          >
            <button
              className={`${styles.widgetToggleBtn} ${showNoDueDate ? styles.widgetToggleBtnActive : ""}`}
              onClick={() => setShowNoDueDate((v) => !v)}
            >
              <Icon name={showNoDueDate ? "eye" : "eye-off"} size={13} />
            </button>
          </Tooltip>
        </div>
      </div>

      {loading && <div className={styles.widgetEmpty}>Loading…</div>}
      {!loading && accessError && (
        <div className={styles.widgetEmpty}>
          Checklist not found or access denied.
        </div>
      )}
      {!loading && !accessError && totalItems === 0 && (
        <div className={styles.widgetEmpty}>No upcoming items.</div>
      )}

      {!loading && totalItems > 0 && (
        <div
          className={styles.widgetItems}
          style={{ maxHeight: maxItems * ITEM_ROW_PX }}
        >
          {visibleSections.map((section) => (
            <div key={section.id}>
              <div className={styles.widgetSectionHeader}>{section.name}</div>
              {section.items.map((item) => {
                const dateStr = formatDate(item.dueDate, item.reusable);
                const isCompletedReusable = item.reusable && item.complete;
                return (
                  <div
                    key={item.id}
                    className={styles.widgetItem}
                    style={isCompletedReusable ? { opacity: 0.45 } : undefined}
                  >
                    {canCheck && (
                      <div
                        className={styles.widgetCheckbox}
                        onClick={() =>
                          !isCompletedReusable &&
                          toggleComplete(item, section.id)
                        }
                        title={
                          isCompletedReusable
                            ? "Reset to uncheck"
                            : "Mark complete"
                        }
                        style={
                          isCompletedReusable
                            ? { borderColor: "#334155", cursor: "default" }
                            : undefined
                        }
                      />
                    )}
                    <div
                      className={styles.widgetItemTitle}
                      style={
                        isCompletedReusable
                          ? { textDecoration: "line-through", color: "#475569" }
                          : undefined
                      }
                    >
                      {item.title}
                    </div>
                    {item.assigneeName && (
                      <Tooltip text={item.assigneeName} placement="top">
                        <span
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: "50%",
                            background: "#3b82f6",
                            color: "#fff",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 8,
                            fontWeight: 600,
                            flexShrink: 0,
                            overflow: "hidden",
                          }}
                        >
                          {item.assigneePicture ? (
                            <img
                              src={item.assigneePicture}
                              alt={item.assigneeName}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                              }}
                            />
                          ) : (
                            item.assigneeName.charAt(0).toUpperCase()
                          )}
                        </span>
                      </Tooltip>
                    )}
                    <div className={styles.widgetItemMeta}>
                      {dateStr ? (
                        <span className={getDueBadgeClass(item)}>
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
