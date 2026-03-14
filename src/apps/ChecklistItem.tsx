"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import styles from "./App.module.css";
import { ItemData, SystemUser } from "./types";

interface Props {
  item: ItemData;
  access: "owner" | "editor" | "viewer";
  currentUserId: string;
  users: SystemUser[];
  onUpdate: (id: string, updates: Partial<ItemData & { assigneeName?: string }>) => void;
  onDelete: (id: string) => void;
  onToggleSubscription: (item: ItemData) => void;
  dragging: boolean;
  dragOver: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}

export default function ChecklistItem({
  item,
  access,
  currentUserId,
  users,
  onUpdate,
  onDelete,
  onToggleSubscription,
  dragging,
  dragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: Props) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(item.title);
  const [editingDate, setEditingDate] = useState(false);
  const [dateValue, setDateValue] = useState(item.dueDate || "");
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const canEdit = access === "owner" || access === "editor" || item.assigneeId === currentUserId;
  const canAssign = access === "owner" || access === "editor";

  useEffect(() => {
    setTitleValue(item.title);
  }, [item.title]);

  useEffect(() => {
    setDateValue(item.dueDate || "");
  }, [item.dueDate, item.reusable]);

  // Close assignee picker on outside click
  useEffect(() => {
    if (!showAssigneePicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowAssigneePicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showAssigneePicker]);

  const saveTitle = useCallback(async () => {
    if (titleValue.trim() === item.title) {
      setEditingTitle(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/tasklist/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: titleValue.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        onUpdate(item.id, { title: data.title });
      }
    } finally {
      setSaving(false);
      setEditingTitle(false);
    }
  }, [item.id, item.title, titleValue, onUpdate]);

  const saveDate = useCallback(async () => {
    if (dateValue === (item.dueDate || "")) {
      setEditingDate(false);
      return;
    }
    try {
      const res = await fetch(`/api/tasklist/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueDate: dateValue }),
      });
      if (res.ok) {
        onUpdate(item.id, { dueDate: dateValue || null });
      }
    } finally {
      setEditingDate(false);
    }
  }, [item.id, item.dueDate, dateValue, onUpdate]);

  const toggleComplete = async () => {
    if (!canEdit) return;
    const newVal = !item.complete;
    onUpdate(item.id, { complete: newVal }); // optimistic
    try {
      const res = await fetch(`/api/tasklist/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complete: newVal }),
      });
      if (res.ok) {
        const data = await res.json();
        onUpdate(item.id, { complete: data.complete, order: data.order });
      } else {
        onUpdate(item.id, { complete: item.complete }); // rollback
      }
    } catch {
      onUpdate(item.id, { complete: item.complete });
    }
  };

  const toggleReusable = async () => {
    if (!canEdit) return;
    const newVal = !item.reusable;
    try {
      const res = await fetch(`/api/tasklist/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reusable: newVal }),
      });
      if (res.ok) {
        onUpdate(item.id, { reusable: newVal });
        // Reset date value when toggling reusable
        setDateValue(item.dueDate || "");
      }
    } catch {}
  };

  const setAssignee = async (userId: string | null) => {
    setShowAssigneePicker(false);
    const user = userId ? users.find((u) => u.id === userId) : null;
    try {
      const res = await fetch(`/api/tasklist/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeId: userId || "" }),
      });
      if (res.ok) {
        onUpdate(item.id, {
          assigneeId: userId,
          assigneeName: user?.displayName || null,
        });
      }
    } catch {}
  };

  const getDueBadgeClass = () => {
    if (item.reusable || !item.dueDate) return styles.dueBadge;
    const today = new Date().toISOString().split("T")[0];
    if (item.dueDate < today) return `${styles.dueBadge} ${styles.overdue}`;
    if (item.dueDate === today) return `${styles.dueBadge} ${styles.dueToday}`;
    return styles.dueBadge;
  };

  const formatDate = (d: string) => {
    if (!d) return "";
    const date = new Date(d + "T00:00:00");
    if (isNaN(date.getTime())) return d;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  return (
    <div
      className={`${styles.item} ${item.complete ? styles.complete : ""} ${dragOver ? styles.dragOver : ""}`}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      {/* Drag handle */}
      <span className={styles.itemDragHandle}>
        <DragIcon />
      </span>

      {/* Checkbox */}
      <div
        className={`${styles.checkbox} ${item.complete ? styles.checked : ""}`}
        onClick={toggleComplete}
        title={item.complete ? "Mark incomplete" : "Mark complete"}
      >
        {item.complete && <CheckIcon />}
      </div>

      {/* Title */}
      <div className={styles.itemContent}>
        <input
          ref={titleRef}
          className={styles.itemTitle}
          value={editingTitle ? titleValue : item.title}
          readOnly={!editingTitle || !canEdit}
          onFocus={() => {
            if (canEdit) {
              setEditingTitle(true);
              setTitleValue(item.title);
            }
          }}
          onChange={(e) => setTitleValue(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); saveTitle(); }
            if (e.key === "Escape") { setTitleValue(item.title); setEditingTitle(false); }
          }}
        />

        {/* Assignee badge */}
        {item.assigneeId && item.assigneeName && (
          <div
            className={styles.assigneeBadge}
            onClick={() => canAssign && setShowAssigneePicker(true)}
            style={{ cursor: canAssign ? "pointer" : "default" }}
            title={item.assigneeName}
          >
            <span className={styles.assigneeAvatar}>
              {item.assigneeName.charAt(0).toUpperCase()}
            </span>
            {item.assigneeName}
          </div>
        )}

        {/* Due date */}
        {item.dueDate !== null && item.dueDate !== "" && !editingDate && (
          <div
            className={getDueBadgeClass()}
            onClick={() => { if (canEdit) setEditingDate(true); }}
            title={canEdit ? "Click to edit" : undefined}
          >
            {item.reusable ? item.dueDate : formatDate(item.dueDate)}
          </div>
        )}
        {editingDate && (
          <input
            ref={dateRef}
            className={styles.dueDateInput}
            type={item.reusable ? "text" : "date"}
            value={dateValue}
            autoFocus
            onChange={(e) => setDateValue(e.target.value)}
            onBlur={saveDate}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); saveDate(); }
              if (e.key === "Escape") { setDateValue(item.dueDate || ""); setEditingDate(false); }
            }}
          />
        )}
      </div>

      {/* Assignee picker */}
      {showAssigneePicker && canAssign && (
        <div ref={pickerRef} className={styles.assigneePicker}>
          <div className={styles.assigneePickerDropdown}>
            {users.map((u) => (
              <div
                key={u.id}
                className={`${styles.assigneePickerItem} ${item.assigneeId === u.id ? styles.selected : ""}`}
                onClick={() => setAssignee(u.id)}
              >
                <span className={styles.assigneeAvatar}>{u.displayName.charAt(0).toUpperCase()}</span>
                {u.displayName}
              </div>
            ))}
            {item.assigneeId && (
              <div className={styles.assigneePickerClear} onClick={() => setAssignee(null)}>
                Remove assignee
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action buttons (visible on hover) */}
      <div className={styles.itemActions}>
        {/* Assign button (only if no assignee yet) */}
        {!item.assigneeId && canAssign && (
          <button
            className={styles.itemActionBtn}
            onClick={() => setShowAssigneePicker(true)}
            title="Assign user"
          >
            <AssignIcon />
          </button>
        )}

        {/* Set due date (if no due date) */}
        {(item.dueDate === null || item.dueDate === "") && canEdit && (
          <button
            className={styles.itemActionBtn}
            onClick={() => setEditingDate(true)}
            title="Set due date"
          >
            <CalendarIcon />
          </button>
        )}

        {/* Reusable toggle */}
        {canEdit && (
          <button
            className={`${styles.itemActionBtn} ${item.reusable ? styles.reusableActive : ""}`}
            onClick={toggleReusable}
            title={item.reusable ? "Disable reusable" : "Make reusable (stays after completion)"}
          >
            <RecycleIcon />
          </button>
        )}

        {/* Watch/subscribe toggle */}
        <button
          className={`${styles.itemActionBtn} ${item.subscribed ? styles.watchActive : ""}`}
          onClick={() => onToggleSubscription(item)}
          title={item.subscribed ? "Unwatch item" : "Watch item for notifications"}
        >
          <EyeIcon />
        </button>

        {/* Delete */}
        {canEdit && (
          <button
            className={`${styles.itemActionBtn} ${styles.deleteAction}`}
            onClick={() => onDelete(item.id)}
            title="Delete item"
          >
            <TrashIcon />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Inline SVG icons ──────────────────────────────────────────

function DragIcon() {
  return (
    <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor">
      <circle cx="4" cy="3" r="1.2" /><circle cx="8" cy="3" r="1.2" />
      <circle cx="4" cy="7" r="1.2" /><circle cx="8" cy="7" r="1.2" />
      <circle cx="4" cy="11" r="1.2" /><circle cx="8" cy="11" r="1.2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function RecycleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="1 4 1 10 7 10" /><polyline points="23 20 23 14 17 14" />
      <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
    </svg>
  );
}

function AssignIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
