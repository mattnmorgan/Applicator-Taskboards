"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  ButtonIcon,
  Icon,
  SearchableCombobox,
  Tooltip,
} from "@applicator/sdk/components";
import styles from "@/src/apps/Taskboard.module.css";
import { ItemData } from "@/src/types/ItemData";
import { SystemUser } from "@/src/types/SystemUser";
import { resolveReusableDate, getLocalToday } from "@/src/lib/reusable-date";
import ActionMenu, { MenuAction } from "./ActionMenu";

interface Props {
  item: ItemData;
  access: "owner" | "editor" | "viewer";
  currentUserId: string;
  users: SystemUser[];
  onUpdate: (
    id: string,
    updates: Partial<ItemData & { assigneeName?: string }>,
  ) => void;
  onDelete: (id: string) => void;
  onToggleSubscription: (item: ItemData) => void;
  onMoveToSection?: (itemId: string) => void;
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
  onMoveToSection,
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
  const [pickerPos, setPickerPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  const isViewer = access === "viewer";
  const canEdit =
    access === "owner" ||
    access === "editor" ||
    item.assigneeId === currentUserId;
  const canAssign = access === "owner" || access === "editor";
  const isDraggable = !isViewer && (!item.complete || item.reusable);

  useEffect(() => {
    setTitleValue(item.title);
  }, [item.title]);

  useEffect(() => {
    setDateValue(item.dueDate || "");
  }, [item.dueDate, item.reusable]);

  const openAssigneePicker = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = 240;
    const left = Math.max(
      8,
      Math.min(rect.left, window.innerWidth - width - 8),
    );
    const top = rect.bottom + 4;
    setPickerPos({ top, left });
    setShowAssigneePicker(true);
  };

  const saveTitle = useCallback(async () => {
    if (titleValue.trim() === item.title) {
      setEditingTitle(false);
      return;
    }
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
    setPickerPos(null);
    try {
      const res = await fetch(`/api/tasklist/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeId: userId || "" }),
      });
      if (res.ok) {
        const data = await res.json();
        onUpdate(item.id, {
          assigneeId: userId,
          assigneeName: data.assigneeName || undefined,
          assigneePicture: data.assigneePicture || undefined,
        });
      }
    } catch {}
  };

  const getDueBadgeClass = () => {
    if (!item.dueDate) return styles.dueBadge;
    const today = getLocalToday();
    if (!item.reusable) {
      if (item.dueDate < today) return `${styles.dueBadge} ${styles.overdue}`;
      if (item.dueDate === today) return `${styles.dueBadge} ${styles.dueToday}`;
      return `${styles.dueBadge} ${styles.dueFuture}`;
    }
    // Reusable: completed this month = grey
    if (item.complete) return styles.dueBadge;
    // Resolve ordinal/EOM date for coloring
    const resolved = resolveReusableDate(item.dueDate);
    if (!resolved) return styles.dueBadge;
    if (resolved < today) return `${styles.dueBadge} ${styles.overdue}`;
    if (resolved === today) return `${styles.dueBadge} ${styles.dueToday}`;
    return `${styles.dueBadge} ${styles.dueFuture}`;
  };

  const formatDate = (d: string) => {
    if (!d) return "";
    const date = new Date(d + "T00:00:00");
    if (isNaN(date.getTime())) return d;
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div
      className={`${styles.item} ${item.complete ? styles.complete : ""} ${dragOver ? styles.dragOver : ""}`}
      onDragOver={!isViewer ? onDragOver : undefined}
      onDrop={!isViewer ? onDrop : undefined}
    >
      {/* Drag handle — hidden for viewers and for complete non-reusable items */}
      <span
        className={`${styles.itemDragHandle} ${!isDraggable ? styles.itemDragHandleHidden : ""}`}
        draggable={isDraggable}
        onDragStart={isDraggable ? onDragStart : undefined}
        onDragEnd={isDraggable ? onDragEnd : undefined}
        style={{ cursor: isDraggable ? "grab" : "default" }}
      >
        <Icon name="drag" size={12} />
      </span>

      {/* Checkbox — hidden for viewers */}
      {!isViewer && (
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
      )}
      {isViewer && <div className={styles.checkboxSpacer} />}

      {/* Title */}
      <input
        ref={titleRef}
        className={styles.itemTitle}
        value={editingTitle ? titleValue : item.title}
        readOnly={!editingTitle || !canEdit}
        style={{ cursor: canEdit ? undefined : "default" }}
        onMouseDown={(e) => {
          if (!canEdit) e.preventDefault();
        }}
        onFocus={() => {
          if (canEdit) {
            setEditingTitle(true);
            setTitleValue(item.title);
          }
        }}
        onChange={(e) => setTitleValue(e.target.value)}
        onBlur={() => {
          saveTitle();
          if (titleRef.current) titleRef.current.scrollLeft = 0;
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            saveTitle();
          }
          if (e.key === "Escape") {
            setTitleValue(item.title);
            setEditingTitle(false);
            if (titleRef.current) titleRef.current.scrollLeft = 0;
          }
        }}
      />

      {/* Assignee slot — always rendered for badge alignment */}
      <div className={styles.itemAssigneeSlot}>
        {item.assigneeId && item.assigneeName && (
          <Tooltip text={item.assigneeName} placement="top">
            <span
              className={styles.assigneeAvatar}
              onClick={(e) => canAssign && openAssigneePicker(e)}
              style={{ cursor: canAssign ? "pointer" : "default" }}
            >
              {item.assigneePicture ? (
                <img
                  src={item.assigneePicture}
                  alt={item.assigneeName}
                  style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover", display: "block" }}
                />
              ) : (
                item.assigneeName.charAt(0).toUpperCase()
              )}
            </span>
          </Tooltip>
        )}
      </div>

      {/* Due date slot — always rendered for badge alignment */}
      <div className={styles.itemDueSlot}>
        {item.dueDate !== null && item.dueDate !== "" && !editingDate && (
          <div
            className={getDueBadgeClass()}
            onClick={() => {
              if (canEdit) setEditingDate(true);
            }}
            title={canEdit ? "Click to edit" : undefined}
            style={{ cursor: canEdit ? "pointer" : "default" }}
          >
            {item.reusable ? item.dueDate : formatDate(item.dueDate)}
          </div>
        )}
        {editingDate && (
          <input
            ref={dateRef}
            className={styles.dueDateInput}
            type={item.reusable ? "text" : "date"}
            maxLength={item.reusable ? 10 : undefined}
            value={dateValue}
            autoFocus
            onChange={(e) => setDateValue(e.target.value)}
            onBlur={saveDate}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                saveDate();
              }
              if (e.key === "Escape") {
                setDateValue(item.dueDate || "");
                setEditingDate(false);
              }
            }}
          />
        )}
      </div>

      {/* Reusable toggle — always visible, dedicated column */}
      <div className={styles.itemReusableSlot}>
        {canEdit && (!item.complete || item.reusable) && (
          <ButtonIcon
            name="refresh"
            iconSize={13}
            label={
              item.reusable
                ? "Disable reusable"
                : "Make reusable (stays after completion)"
            }
            onClick={toggleReusable}
            size="sm"
            placement="top"
            active={item.reusable}
            subvariant="info"
          />
        )}
      </div>

      {/* Mobile sandwich menu — always visible on small screens */}
      <ActionMenu actions={[
        ...(!item.assigneeId && canAssign && !item.complete ? [{
          label: "Assign user",
          icon: "user",
          onClick: () => {
            setPickerPos({ top: Math.round(window.innerHeight * 0.25), left: Math.max(8, Math.round((window.innerWidth - 240) / 2)) });
            setShowAssigneePicker(true);
          },
        }] : []),
        ...((item.dueDate === null || item.dueDate === "") && canEdit && !item.complete ? [{
          label: "Set due date",
          icon: "calendar",
          onClick: () => setEditingDate(true),
        }] : []),
        ...(!item.complete || item.reusable ? [{
          label: item.subscribed ? "Unwatch item" : "Watch item",
          icon: "eye",
          onClick: () => onToggleSubscription(item),
          active: item.subscribed,
          variant: "info" as MenuAction["variant"],
        }] : []),
        ...(canEdit && onMoveToSection ? [{
          label: "Move to section",
          icon: "move",
          onClick: () => onMoveToSection(item.id),
        }] : []),
        ...(canEdit ? [{
          label: "Delete item",
          icon: "trash",
          onClick: () => onDelete(item.id),
          variant: "danger" as MenuAction["variant"],
        }] : []),
      ]} />

      {/* Action buttons (visible on hover) */}
      <div ref={actionsRef} className={styles.itemActions}>
        {!item.assigneeId && canAssign && !item.complete && (
          <ButtonIcon
            name="user"
            iconSize={13}
            label="Assign user"
            onClick={() => {
              const rect = actionsRef.current?.getBoundingClientRect();
              const width = 240;
              const top = rect ? rect.bottom + 4 : window.innerHeight / 2;
              const left = rect
                ? Math.max(
                    8,
                    Math.min(rect.right - width, window.innerWidth - width - 8),
                  )
                : window.innerWidth / 2 - width / 2;
              setPickerPos({ top, left: Math.max(8, left) });
              setShowAssigneePicker(true);
            }}
            size="sm"
            placement="top"
          />
        )}

        {(item.dueDate === null || item.dueDate === "") &&
          canEdit &&
          !item.complete && (
            <ButtonIcon
              name="calendar"
              iconSize={13}
              label="Set due date"
              onClick={() => setEditingDate(true)}
              size="sm"
              placement="top"
            />
          )}

        {(!item.complete || item.reusable) && (
          <ButtonIcon
            name="eye"
            iconSize={14}
            label={
              item.subscribed ? "Unwatch item" : "Watch item for notifications"
            }
            onClick={() => onToggleSubscription(item)}
            size="sm"
            placement="top"
            active={item.subscribed}
            subvariant="info"
          />
        )}

        {canEdit && (
          <ButtonIcon
            name="trash"
            iconSize={13}
            label="Delete item"
            onClick={() => onDelete(item.id)}
            size="sm"
            placement="top"
            subvariant="danger"
          />
        )}
      </div>

      {/* Assignee picker — fixed-positioned to avoid off-screen issues */}
      {showAssigneePicker && canAssign && pickerPos && (
        <>
          {/* Backdrop closes picker when clicking outside */}
          <div
            style={{ position: "fixed", inset: 0, zIndex: 199 }}
            onMouseDown={() => {
              setShowAssigneePicker(false);
              setPickerPos(null);
            }}
          />
          <div
            className={styles.assigneePickerWrapper}
            style={{
              position: "fixed",
              top: pickerPos.top,
              left: pickerPos.left,
              zIndex: 200,
              width: 240,
            }}
          >
            <SearchableCombobox<SystemUser>
              items={users}
              selectedItems={[]}
              onSelectionChange={(selected) => {
                if (selected.length > 0) {
                  setAssignee(selected[0].id);
                }
              }}
              renderItem={(u) => (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 11,
                    color: "#e2e8f0",
                  }}
                >
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      minWidth: 16,
                      minHeight: 16,
                      borderRadius: "50%",
                      background: "#3b82f6",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "9px",
                      fontWeight: "600",
                      overflow: "hidden",
                    }}
                  >
                    {u.profilePicture ? (
                      <img
                        src={u.profilePicture}
                        alt={u.displayName}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      (u.displayName || u.username || "?").charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>{u.displayName}</div>
                </div>
              )}
              filterItem={(u, term) =>
                u.displayName.toLowerCase().includes(term.toLowerCase()) ||
                u.username.toLowerCase().includes(term.toLowerCase())
              }
              getItemKey={(u) => u.id}
              placeholder="Search users..."
            />
            {item.assigneeId && (
              <div
                className={styles.assigneePickerClear}
                onClick={() => setAssignee(null)}
              >
                Remove assignee
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
