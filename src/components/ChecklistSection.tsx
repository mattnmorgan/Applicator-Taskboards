"use client";

import React, { useState, useRef, useCallback } from "react";
import { Icon } from "@applicator/sdk/components";
import styles from "../apps/Taskboard.module.css";
import { SectionData } from "../types/SectionData";
import { ItemData } from "../types/ItemData";
import { SystemUser } from "../types/SystemUser";
import ChecklistItem from "./ChecklistItem";

interface Props {
  section: SectionData;
  access: "owner" | "editor" | "viewer";
  currentUserId: string;
  users: SystemUser[];
  onSectionRename: (id: string, name: string) => void;
  onSectionDelete: (id: string) => void;
  onItemUpdate: (id: string, updates: Partial<ItemData & { assigneeName?: string }>) => void;
  onItemDelete: (id: string) => void;
  onItemAdd: (sectionId: string, title: string) => void;
  onItemSubscriptionToggle: (item: ItemData) => void;
  onItemsReorder: (sectionId: string, items: ItemData[]) => void;
  dragOver: boolean;
  draggingSection: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

export default function ChecklistSection({
  section,
  access,
  currentUserId,
  users,
  onSectionRename,
  onSectionDelete,
  onItemUpdate,
  onItemDelete,
  onItemAdd,
  onItemSubscriptionToggle,
  onItemsReorder,
  dragOver,
  draggingSection,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: Props) {
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(section.name);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const [dragGroup, setDragGroup] = useState<"incomplete" | "complete" | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const canEdit = access === "owner" || access === "editor";

  const incompleteItems = section.items.filter((i) => !i.complete).sort((a, b) => a.order - b.order);
  const completeItems = section.items.filter((i) => i.complete).sort((a, b) => a.order - b.order);

  const saveName = useCallback(async () => {
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === section.name) {
      setNameValue(section.name);
      setEditingName(false);
      return;
    }
    try {
      const res = await fetch(`/api/tasklist/sections/${section.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.ok) {
        onSectionRename(section.id, trimmed);
      } else {
        setNameValue(section.name);
      }
    } catch {
      setNameValue(section.name);
    }
    setEditingName(false);
  }, [section.id, section.name, nameValue, onSectionRename]);

  const handleAddItem = async () => {
    const title = newItemTitle.trim();
    if (!title) return;
    setNewItemTitle("");
    setShowAddItem(false);
    onItemAdd(section.id, title);
  };

  const handleDeleteSection = () => {
    if (!confirm(`Delete section "${section.name}" and all its items?`)) return;
    onSectionDelete(section.id);
  };

  // ─── Item drag-and-drop ──────────────────────────────────────

  const handleItemDragStart = (itemId: string, group: "incomplete" | "complete") => {
    setDraggingItemId(itemId);
    setDragGroup(group);
  };

  const handleItemDragOver = (e: React.DragEvent, itemId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverItemId(itemId);
  };

  const handleItemDrop = async (targetId: string, targetGroup: "incomplete" | "complete") => {
    if (!draggingItemId || draggingItemId === targetId) {
      setDraggingItemId(null);
      setDragOverItemId(null);
      setDragGroup(null);
      return;
    }

    const sourceList = dragGroup === "incomplete" ? incompleteItems : completeItems;
    const targetList = targetGroup === "incomplete" ? incompleteItems : completeItems;

    const fromIndex = sourceList.findIndex((i) => i.id === draggingItemId);
    const toIndex = targetList.findIndex((i) => i.id === targetId);
    if (fromIndex === -1) return;

    if (dragGroup === targetGroup) {
      // Reorder within same group
      const newList = [...sourceList];
      const [moved] = newList.splice(fromIndex, 1);
      newList.splice(toIndex, 0, moved);
      const updated = newList.map((item, idx) => ({ ...item, order: idx }));

      // Optimistic update
      const allItems = section.items.map((i) => {
        const u = updated.find((u) => u.id === i.id);
        return u || i;
      });
      onItemsReorder(section.id, allItems);

      // Persist
      try {
        await fetch(`/api/tasklist/sections/${section.id}/items/reorder`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: updated.map((i) => ({ id: i.id, order: i.order })) }),
        });
      } catch {}
    }
    // Cross-group drag (incomplete ↔ complete) handled via checkbox; skip

    setDraggingItemId(null);
    setDragOverItemId(null);
    setDragGroup(null);
  };

  const handleItemDragEnd = () => {
    setDraggingItemId(null);
    setDragOverItemId(null);
    setDragGroup(null);
  };

  return (
    <div
      className={`${styles.section} ${dragOver ? styles.dragOver : ""}`}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Section header */}
      <div className={styles.sectionHeader}>
        {/* Section drag handle */}
        {canEdit && (
          <span
            className={styles.dragHandle}
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          >
            <Icon name="drag" size={14} />
          </span>
        )}

        <input
          ref={nameRef}
          className={styles.sectionName}
          value={editingName ? nameValue : section.name}
          readOnly={!editingName || !canEdit}
          onFocus={() => {
            if (canEdit) {
              setEditingName(true);
              setNameValue(section.name);
            }
          }}
          onChange={(e) => setNameValue(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); saveName(); }
            if (e.key === "Escape") { setNameValue(section.name); setEditingName(false); }
          }}
        />

        {canEdit && (
          <button
            className={`${styles.iconBtn} ${styles.sectionDeleteBtn}`}
            onClick={handleDeleteSection}
            title="Delete section"
          >
            <Icon name="trash" size={14} />
          </button>
        )}
      </div>

      {/* Incomplete items */}
      <div className={styles.sectionItems}>
        {incompleteItems.map((item) => (
          <ChecklistItem
            key={item.id}
            item={item}
            access={access}
            currentUserId={currentUserId}
            users={users}
            onUpdate={onItemUpdate}
            onDelete={onItemDelete}
            onToggleSubscription={onItemSubscriptionToggle}
            dragging={draggingItemId === item.id}
            dragOver={dragOverItemId === item.id}
            onDragStart={() => handleItemDragStart(item.id, "incomplete")}
            onDragOver={(e) => handleItemDragOver(e, item.id)}
            onDrop={() => handleItemDrop(item.id, "incomplete")}
            onDragEnd={handleItemDragEnd}
          />
        ))}

        {/* Add item row */}
        {canEdit && !showAddItem && (
          <div className={styles.addItemRow}>
            <button className={styles.addItemBtn} onClick={() => setShowAddItem(true)}>
              <Icon name="plus" size={12} /> Add item
            </button>
          </div>
        )}
        {showAddItem && (
          <div className={styles.newItemRow}>
            <input
              className={styles.newItemInput}
              placeholder="Item title…"
              value={newItemTitle}
              autoFocus
              onChange={(e) => setNewItemTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddItem();
                if (e.key === "Escape") { setShowAddItem(false); setNewItemTitle(""); }
              }}
            />
            <div className={styles.newItemActions}>
              <button className={styles.newItemSave} onClick={handleAddItem}>Add</button>
              <button className={styles.newItemCancel} onClick={() => { setShowAddItem(false); setNewItemTitle(""); }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Completed items toggle */}
        {completeItems.length > 0 && (
          <>
            <button
              className={styles.completedToggle}
              onClick={() => setShowCompleted((v) => !v)}
            >
              <span className={`${styles.completedToggleChevron} ${showCompleted ? styles.open : ""}`}>
                <Icon name="chevron-right" size={10} />
              </span>
              {completeItems.length} completed
            </button>

            {showCompleted && completeItems.map((item) => (
              <ChecklistItem
                key={item.id}
                item={item}
                access={access}
                currentUserId={currentUserId}
                users={users}
                onUpdate={onItemUpdate}
                onDelete={onItemDelete}
                onToggleSubscription={onItemSubscriptionToggle}
                dragging={draggingItemId === item.id}
                dragOver={dragOverItemId === item.id}
                onDragStart={() => handleItemDragStart(item.id, "complete")}
                onDragOver={(e) => handleItemDragOver(e, item.id)}
                onDrop={() => handleItemDrop(item.id, "complete")}
                onDragEnd={handleItemDragEnd}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
