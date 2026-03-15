"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Icon } from "@applicator/sdk/components";
import styles from "@/src/apps/Taskboard.module.css";
import { ItemData } from "@/src/types/ItemData";
import { SystemUser } from "@/src/types/SystemUser";

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
        <Icon name="drag" size={12} />
      </span>

      {/* Checkbox */}
      <div
        className={`${styles.checkbox} ${item.complete ? styles.checked : ""}`}
        onClick={toggleComplete}
        title={item.complete ? "Mark incomplete" : "Mark complete"}
      >
        {item.complete && (
          <span style={{ color: "#fff" }}>
            <Icon name="check" size={10} />
          </span>
        )}
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
            <Icon name="user" size={13} />
          </button>
        )}

        {/* Set due date (if no due date) */}
        {(item.dueDate === null || item.dueDate === "") && canEdit && (
          <button
            className={styles.itemActionBtn}
            onClick={() => setEditingDate(true)}
            title="Set due date"
          >
            <Icon name="calendar" size={13} />
          </button>
        )}

        {/* Reusable toggle */}
        {canEdit && (
          <button
            className={`${styles.itemActionBtn} ${item.reusable ? styles.reusableActive : ""}`}
            onClick={toggleReusable}
            title={item.reusable ? "Disable reusable" : "Make reusable (stays after completion)"}
          >
            <Icon name="refresh" size={13} />
          </button>
        )}

        {/* Watch/subscribe toggle */}
        <button
          className={`${styles.itemActionBtn} ${item.subscribed ? styles.watchActive : ""}`}
          onClick={() => onToggleSubscription(item)}
          title={item.subscribed ? "Unwatch item" : "Watch item for notifications"}
        >
          <Icon name="eye" size={14} />
        </button>

        {/* Delete */}
        {canEdit && (
          <button
            className={`${styles.itemActionBtn} ${styles.deleteAction}`}
            onClick={() => onDelete(item.id)}
            title="Delete item"
          >
            <Icon name="trash" size={13} />
          </button>
        )}
      </div>
    </div>
  );
}
