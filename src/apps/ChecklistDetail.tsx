"use client";

import React, { useState, useEffect, useCallback } from "react";
import styles from "./App.module.css";
import { ChecklistDetail as ChecklistDetailType, SectionData, ItemData, SystemUser } from "./types";
import ChecklistSection from "./ChecklistSection";
import ShareModal from "./ShareModal";

interface Props {
  checklistId: string;
  onBack: () => void;
}

export default function ChecklistDetail({ checklistId, onBack }: Props) {
  const [checklist, setChecklist] = useState<ChecklistDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);

  // Section drag state
  const [draggingSectionId, setDraggingSectionId] = useState<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [clRes, usersRes] = await Promise.all([
        fetch(`/api/tasklist/checklists/${checklistId}`),
        fetch("/api/tasklist/users"),
      ]);
      if (clRes.ok) {
        const data = await clRes.json();
        setChecklist(data);
      }
      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.users || []);
      }
    } finally {
      setLoading(false);
    }
  }, [checklistId]);

  // ─── Subscription handlers ─────────────────────────────────

  const toggleChecklistSubscription = async () => {
    if (!checklist) return;
    if (checklist.subscribed && checklist.subscriptionId) {
      const res = await fetch(`/api/tasklist/subscriptions/${checklist.subscriptionId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setChecklist((prev) => prev ? { ...prev, subscribed: false, subscriptionId: null } : prev);
      }
    } else {
      const res = await fetch("/api/tasklist/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklistId }),
      });
      if (res.ok) {
        const data = await res.json();
        setChecklist((prev) => prev ? { ...prev, subscribed: true, subscriptionId: data.id } : prev);
      }
    }
  };

  const toggleItemSubscription = async (item: ItemData) => {
    if (!checklist) return;
    if (item.subscribed && item.subscriptionId) {
      const res = await fetch(`/api/tasklist/subscriptions/${item.subscriptionId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        updateItemInState(item.id, { subscribed: false, subscriptionId: null });
      }
    } else {
      const res = await fetch("/api/tasklist/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklistId, itemId: item.id }),
      });
      if (res.ok) {
        const data = await res.json();
        updateItemInState(item.id, { subscribed: true, subscriptionId: data.id });
      }
    }
  };

  // ─── Item handlers ──────────────────────────────────────────

  const updateItemInState = (id: string, updates: Partial<ItemData & { assigneeName?: string }>) => {
    setChecklist((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        sections: prev.sections.map((s) => ({
          ...s,
          items: s.items.map((i) => (i.id === id ? { ...i, ...updates } : i)),
        })),
      };
    });
  };

  const deleteItemFromState = (id: string) => {
    setChecklist((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        sections: prev.sections.map((s) => ({
          ...s,
          items: s.items.filter((i) => i.id !== id),
        })),
      };
    });
  };

  const handleItemDelete = async (itemId: string) => {
    const res = await fetch(`/api/tasklist/items/${itemId}`, { method: "DELETE" });
    if (res.ok) deleteItemFromState(itemId);
  };

  const handleItemAdd = async (sectionId: string, title: string) => {
    const res = await fetch(`/api/tasklist/sections/${sectionId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (res.ok) {
      const data = await res.json();
      const newItem: ItemData = {
        id: data.id,
        sectionId,
        title: data.title,
        assigneeId: data.assigneeId || null,
        assigneeName: null,
        dueDate: data.dueDate || null,
        reusable: !!data.reusable,
        complete: !!data.complete,
        order: data.order ?? 0,
        subscribed: false,
        subscriptionId: null,
      };
      setChecklist((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          sections: prev.sections.map((s) =>
            s.id === sectionId ? { ...s, items: [...s.items, newItem] } : s,
          ),
        };
      });
    }
  };

  const handleItemsReorder = (sectionId: string, items: ItemData[]) => {
    setChecklist((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        sections: prev.sections.map((s) => (s.id === sectionId ? { ...s, items } : s)),
      };
    });
  };

  // ─── Section handlers ───────────────────────────────────────

  const handleSectionRename = (id: string, name: string) => {
    setChecklist((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        sections: prev.sections.map((s) => (s.id === id ? { ...s, name } : s)),
      };
    });
  };

  const handleSectionDelete = async (id: string) => {
    const res = await fetch(`/api/tasklist/sections/${id}`, { method: "DELETE" });
    if (res.ok) {
      setChecklist((prev) => {
        if (!prev) return prev;
        return { ...prev, sections: prev.sections.filter((s) => s.id !== id) };
      });
    }
  };

  const handleAddSection = async () => {
    const res = await fetch(`/api/tasklist/checklists/${checklistId}/sections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Section" }),
    });
    if (res.ok) {
      const data = await res.json();
      const newSection: SectionData = { id: data.id, name: data.name, order: data.order, items: [] };
      setChecklist((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          sections: [...prev.sections, newSection].sort((a, b) => a.order - b.order),
        };
      });
    }
  };

  // ─── Section drag-and-drop ──────────────────────────────────

  const handleSectionDragStart = (e: React.DragEvent, sectionId: string) => {
    e.stopPropagation();
    setDraggingSectionId(sectionId);
  };

  const handleSectionDragOver = (e: React.DragEvent, sectionId: string) => {
    e.preventDefault();
    setDragOverSectionId(sectionId);
  };

  const handleSectionDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggingSectionId || draggingSectionId === targetId || !checklist) {
      setDraggingSectionId(null);
      setDragOverSectionId(null);
      return;
    }

    const sorted = [...checklist.sections].sort((a, b) => a.order - b.order);
    const fromIdx = sorted.findIndex((s) => s.id === draggingSectionId);
    const toIdx = sorted.findIndex((s) => s.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const newList = [...sorted];
    const [moved] = newList.splice(fromIdx, 1);
    newList.splice(toIdx, 0, moved);
    const updated = newList.map((s, i) => ({ ...s, order: i }));

    setChecklist((prev) => (prev ? { ...prev, sections: updated } : prev));
    setDraggingSectionId(null);
    setDragOverSectionId(null);

    try {
      await fetch(`/api/tasklist/checklists/${checklistId}/sections/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections: updated.map((s) => ({ id: s.id, order: s.order })) }),
      });
    } catch {}
  };

  const handleSectionDragEnd = () => {
    setDraggingSectionId(null);
    setDragOverSectionId(null);
  };

  if (loading) return <div className={styles.loading}>Loading…</div>;
  if (!checklist) return <div className={styles.loading}>Checklist not found.</div>;

  const sortedSections = [...checklist.sections].sort((a, b) => a.order - b.order);
  const canEdit = checklist.access === "owner" || checklist.access === "editor";

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onBack}>
          <ChevronLeftIcon /> Back
        </button>

        <div className={styles.headerMeta}>
          <span className={styles.headerTitle}>{checklist.name}</span>
          {checklist.description && (
            <span className={styles.headerDesc}>{checklist.description}</span>
          )}
        </div>

        <div className={styles.headerActions}>
          {/* Watch checklist */}
          <button
            className={`${styles.iconBtn} ${checklist.subscribed ? styles.active : ""}`}
            onClick={toggleChecklistSubscription}
            title={checklist.subscribed ? "Unwatch checklist" : "Watch checklist for notifications"}
          >
            <EyeIcon />
          </button>

          {/* Share settings (owner only) */}
          {checklist.access === "owner" && (
            <button
              className={styles.iconBtn}
              onClick={() => setShowShareModal(true)}
              title="Share settings"
            >
              <SettingsIcon />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className={styles.body}>
        <div className={styles.sections}>
          {sortedSections.length === 0 && (
            <div className={styles.emptyState}>
              <span className={styles.emptyStateTitle}>No sections yet</span>
              <span className={styles.emptyStateDesc}>Add a section to start organizing your checklist.</span>
            </div>
          )}

          {sortedSections.map((section) => (
            <ChecklistSection
              key={section.id}
              section={section}
              access={checklist.access}
              currentUserId={checklist.currentUserId}
              users={users}
              onSectionRename={handleSectionRename}
              onSectionDelete={handleSectionDelete}
              onItemUpdate={updateItemInState}
              onItemDelete={handleItemDelete}
              onItemAdd={handleItemAdd}
              onItemSubscriptionToggle={toggleItemSubscription}
              onItemsReorder={handleItemsReorder}
              dragOver={dragOverSectionId === section.id}
              draggingSection={draggingSectionId === section.id}
              onDragStart={(e) => handleSectionDragStart(e, section.id)}
              onDragOver={(e) => handleSectionDragOver(e, section.id)}
              onDrop={(e) => handleSectionDrop(e, section.id)}
              onDragEnd={handleSectionDragEnd}
            />
          ))}

          {canEdit && (
            <div className={styles.addSectionRow}>
              <button className={styles.addSectionBtn} onClick={handleAddSection}>
                <PlusIcon /> Add Section
              </button>
            </div>
          )}
        </div>
      </div>

      {showShareModal && (
        <ShareModal
          checklistId={checklistId}
          onClose={() => setShowShareModal(false)}
          users={users}
          currentUserId={checklist.currentUserId}
        />
      )}
    </div>
  );
}

// ─── Inline SVG icons ──────────────────────────────────────────

function ChevronLeftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
