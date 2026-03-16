"use client";

import React, { useState, useRef, useCallback } from "react";
import { ButtonIcon, Icon } from "@applicator/sdk/components";
import styles from "@/src/apps/Taskboard.module.css";
import { SectionData } from "@/src/types/SectionData";
import { ItemData } from "@/src/types/ItemData";
import { SystemUser } from "@/src/types/SystemUser";
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
  // Item drag state (lifted to ChecklistDetail for cross-section support)
  draggingItemId: string | null;
  dragOverItemId: string | null;
  onItemDragStart: (itemId: string) => void;
  onItemDragOver: (e: React.DragEvent, itemId: string) => void;
  onItemDrop: (targetItemId: string) => void;
  onItemDragEnd: () => void;
  onItemDropOnSection: () => void;
  // Section drag
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
  draggingItemId,
  dragOverItemId,
  onItemDragStart,
  onItemDragOver,
  onItemDrop,
  onItemDragEnd,
  onItemDropOnSection,
  dragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(section.name);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const canEdit = access === "owner" || access === "editor";

  const incompleteItems = section.items.filter((i) => !i.complete || i.reusable).sort((a, b) => a.order - b.order);
  const completeItems = section.items.filter((i) => i.complete && !i.reusable).sort((a, b) => a.order - b.order);

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

  const handleSectionDrop = (e: React.DragEvent) => {
    // If an item is being dragged, treat this as dropping the item onto the section
    if (draggingItemId) {
      e.preventDefault();
      e.stopPropagation();
      onItemDropOnSection();
    } else {
      onDrop(e);
    }
  };

  const handleSectionDragOver = (e: React.DragEvent) => {
    if (draggingItemId) {
      e.preventDefault();
      e.stopPropagation();
    } else {
      onDragOver(e);
    }
  };

  return (
    <div
      className={`${styles.section} ${dragOver && !draggingItemId ? styles.dragOver : ""}`}
      onDragOver={handleSectionDragOver}
      onDrop={handleSectionDrop}
    >
      {/* Section header */}
      <div className={`${styles.sectionHeader} ${collapsed ? styles.sectionHeaderCollapsed : ""}`}>
        {/* Collapse toggle */}
        <span
          className={styles.sectionCollapseChevron}
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? "Expand section" : "Collapse section"}
          style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)" }}
        >
          <Icon name="chevron-down" size={13} />
        </span>

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
          style={{ cursor: canEdit ? undefined : "default" }}
          onMouseDown={(e) => { if (!canEdit) e.preventDefault(); }}
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
          <ButtonIcon
            name="trash"
            iconSize={13}
            label="Delete section"
            onClick={() => onSectionDelete(section.id)}
            size="sm"
            subvariant="danger"
            placement="top"
          />
        )}
      </div>

      {/* Section body — hidden when collapsed */}
      {!collapsed && (
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
              dragOver={dragOverItemId === item.id}
              onDragStart={() => onItemDragStart(item.id)}
              onDragOver={(e) => onItemDragOver(e, item.id)}
              onDrop={() => onItemDrop(item.id)}
              onDragEnd={onItemDragEnd}
            />
          ))}

          {/* Empty state for viewers when section has no items */}
          {!canEdit && incompleteItems.length === 0 && (
            <div className={styles.sectionEmptyState}>There are no items in this section.</div>
          )}

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
                  dragOver={false}
                  onDragStart={() => {}}
                  onDragOver={() => {}}
                  onDrop={() => {}}
                  onDragEnd={() => {}}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
