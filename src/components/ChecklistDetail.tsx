"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ButtonIcon, Button, Icon, Modal, SearchableCombobox } from "@applicator/sdk/components";
import styles from "@/src/apps/Taskboard.module.css";
import { ChecklistDetail as ChecklistDetailType } from "@/src/types/ChecklistDetail";
import { SectionData } from "@/src/types/SectionData";
import { ItemData } from "@/src/types/ItemData";
import { SystemUser } from "@/src/types/SystemUser";
import ChecklistSection from "./ChecklistSection";
import ShareModal from "./ShareModal";
import ActionMenu, { MenuAction } from "./ActionMenu";

interface Props {
  checklistId: string;
  onBack: () => void;
}

export default function ChecklistDetail({ checklistId, onBack }: Props) {
  const [checklist, setChecklist] = useState<ChecklistDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [moveRequest, setMoveRequest] = useState<{ id: string; sectionId: string } | null>(null);
  const [moveTargetSection, setMoveTargetSection] = useState<SectionData | null>(null);

  // Section drag state
  const [draggingSectionId, setDraggingSectionId] = useState<string | null>(
    null,
  );
  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(
    null,
  );

  // Item drag state (lifted here for cross-section support)
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [draggingItemSectionId, setDraggingItemSectionId] = useState<
    string | null
  >(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);

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
      const res = await fetch(
        `/api/tasklist/subscriptions/${checklist.subscriptionId}`,
        {
          method: "DELETE",
        },
      );
      if (res.ok) {
        setChecklist((prev) =>
          prev ? { ...prev, subscribed: false, subscriptionId: null } : prev,
        );
      }
    } else {
      const res = await fetch("/api/tasklist/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklistId }),
      });
      if (res.ok) {
        const data = await res.json();
        setChecklist((prev) =>
          prev ? { ...prev, subscribed: true, subscriptionId: data.id } : prev,
        );
      }
    }
  };

  const toggleItemSubscription = async (item: ItemData) => {
    if (!checklist) return;
    if (item.subscribed && item.subscriptionId) {
      const res = await fetch(
        `/api/tasklist/subscriptions/${item.subscriptionId}`,
        {
          method: "DELETE",
        },
      );
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
        updateItemInState(item.id, {
          subscribed: true,
          subscriptionId: data.id,
        });
      }
    }
  };

  // ─── Item handlers ──────────────────────────────────────────

  const updateItemInState = (
    id: string,
    updates: Partial<ItemData & { assigneeName?: string }>,
  ) => {
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
    const res = await fetch(`/api/tasklist/items/${itemId}`, {
      method: "DELETE",
    });
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

  // ─── Item drag-and-drop ─────────────────────────────────────

  const clearItemDrag = () => {
    setDraggingItemId(null);
    setDraggingItemSectionId(null);
    setDragOverItemId(null);
  };

  const handleItemDragStart = (itemId: string, sectionId: string) => {
    setDraggingItemId(itemId);
    setDraggingItemSectionId(sectionId);
  };

  const handleItemDragOver = (e: React.DragEvent, itemId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverItemId(itemId);
  };

  const handleItemDrop = async (
    targetItemId: string,
    targetSectionId: string,
  ) => {
    if (!draggingItemId || !draggingItemSectionId || !checklist) {
      clearItemDrag();
      return;
    }
    if (draggingItemId === targetItemId) {
      clearItemDrag();
      return;
    }

    if (draggingItemSectionId === targetSectionId) {
      // Same section: reorder incomplete items
      const section = checklist.sections.find((s) => s.id === targetSectionId);
      if (!section) {
        clearItemDrag();
        return;
      }

      const incomplete = section.items
        .filter((i) => !i.complete || i.reusable)
        .sort((a, b) => a.order - b.order);

      const fromIdx = incomplete.findIndex((i) => i.id === draggingItemId);
      const toIdx = incomplete.findIndex((i) => i.id === targetItemId);
      if (fromIdx === -1 || toIdx === -1) {
        clearItemDrag();
        return;
      }

      const newList = [...incomplete];
      const [moved] = newList.splice(fromIdx, 1);
      newList.splice(toIdx, 0, moved);
      const updated = newList.map((item, idx) => ({ ...item, order: idx }));

      // Optimistic update
      setChecklist((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          sections: prev.sections.map((s) => {
            if (s.id !== targetSectionId) return s;
            return {
              ...s,
              items: s.items.map((i) => {
                const u = updated.find((u) => u.id === i.id);
                return u || i;
              }),
            };
          }),
        };
      });

      try {
        await fetch(`/api/tasklist/sections/${targetSectionId}/items/reorder`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: updated.map((i) => ({ id: i.id, order: i.order })),
          }),
        });
      } catch {}
    } else {
      // Cross-section: move item before targetItem in target section
      await moveItemToSection(
        draggingItemId,
        draggingItemSectionId,
        targetSectionId,
        targetItemId,
      );
    }

    clearItemDrag();
  };

  const handleItemDropOnSection = async (targetSectionId: string) => {
    if (
      !draggingItemId ||
      !draggingItemSectionId ||
      draggingItemSectionId === targetSectionId
    ) {
      clearItemDrag();
      return;
    }
    await moveItemToSection(
      draggingItemId,
      draggingItemSectionId,
      targetSectionId,
      null,
    );
    clearItemDrag();
  };

  const moveItemToSection = async (
    itemId: string,
    sourceSectionId: string,
    targetSectionId: string,
    beforeItemId: string | null,
  ) => {
    if (!checklist) return;
    const sourceSection = checklist.sections.find(
      (s) => s.id === sourceSectionId,
    );
    const targetSection = checklist.sections.find(
      (s) => s.id === targetSectionId,
    );
    if (!sourceSection || !targetSection) return;

    const movingItem = sourceSection.items.find((i) => i.id === itemId);
    if (!movingItem) return;

    const targetIncomplete = targetSection.items
      .filter((i) => !i.complete || i.reusable)
      .sort((a, b) => a.order - b.order);

    let toIdx = beforeItemId
      ? targetIncomplete.findIndex((i) => i.id === beforeItemId)
      : targetIncomplete.length;
    if (toIdx === -1) toIdx = targetIncomplete.length;

    const newList = [...targetIncomplete];
    newList.splice(toIdx, 0, { ...movingItem, sectionId: targetSectionId });
    const reordered = newList.map((item, idx) => ({ ...item, order: idx }));

    setChecklist((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        sections: prev.sections.map((s) => {
          if (s.id === sourceSectionId) {
            return { ...s, items: s.items.filter((i) => i.id !== itemId) };
          }
          if (s.id === targetSectionId) {
            const completeItems = s.items.filter(
              (i) => i.complete && !i.reusable,
            );
            return { ...s, items: [...reordered, ...completeItems] };
          }
          return s;
        }),
      };
    });

    try {
      await fetch(`/api/tasklist/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId: targetSectionId, order: toIdx }),
      });
    } catch {}
  };

  const handleItemDragEnd = () => {
    clearItemDrag();
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
    const res = await fetch(`/api/tasklist/sections/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setChecklist((prev) => {
        if (!prev) return prev;
        return { ...prev, sections: prev.sections.filter((s) => s.id !== id) };
      });
    }
  };

  const handleAddSection = async () => {
    const res = await fetch(
      `/api/tasklist/checklists/${checklistId}/sections`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Section" }),
      },
    );
    if (res.ok) {
      const data = await res.json();
      const newSection: SectionData = {
        id: data.id,
        name: data.name,
        order: data.order,
        items: [],
      };
      setChecklist((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          sections: [...prev.sections, newSection].sort(
            (a, b) => a.order - b.order,
          ),
        };
      });
    }
  };

  const handleResetReusable = async () => {
    if (!checklist) return;
    const completeReusable = checklist.sections
      .flatMap((s) => s.items)
      .filter((i) => i.reusable && i.complete);
    await Promise.all(
      completeReusable.map((i) =>
        fetch(`/api/tasklist/items/${i.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ complete: false }),
        }).then((res) => {
          if (res.ok) updateItemInState(i.id, { complete: false });
        }),
      ),
    );
  };

  const handleResetSectionReusable = async (sectionId: string) => {
    if (!checklist) return;
    const section = checklist.sections.find((s) => s.id === sectionId);
    if (!section) return;
    const completeReusable = section.items.filter((i) => i.reusable && i.complete);
    await Promise.all(
      completeReusable.map((i) =>
        fetch(`/api/tasklist/items/${i.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ complete: false }),
        }).then((res) => {
          if (res.ok) updateItemInState(i.id, { complete: false });
        }),
      ),
    );
  };

  // ─── Move to section ────────────────────────────────────────

  const handleRequestMoveToSection = (itemId: string) => {
    if (!checklist) return;
    const sourceSection = checklist.sections.find((s) =>
      s.items.some((i) => i.id === itemId),
    );
    if (!sourceSection) return;
    setMoveRequest({ id: itemId, sectionId: sourceSection.id });
    setMoveTargetSection(null);
  };

  const confirmMoveToSection = async () => {
    if (!moveRequest || !moveTargetSection) return;
    const { id: itemId, sectionId: sourceSectionId } = moveRequest;
    setMoveRequest(null);
    setMoveTargetSection(null);
    await moveItemToSection(itemId, sourceSectionId, moveTargetSection.id, null);
  };

  const cancelMoveToSection = () => {
    setMoveRequest(null);
    setMoveTargetSection(null);
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
        body: JSON.stringify({
          sections: updated.map((s) => ({ id: s.id, order: s.order })),
        }),
      });
    } catch {}
  };

  const handleSectionDragEnd = () => {
    setDraggingSectionId(null);
    setDragOverSectionId(null);
  };

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <div className={styles.loading}>Loading…</div>;
  if (!checklist)
    return <div className={styles.loading}>Checklist not found.</div>;

  const sortedSections = [...checklist.sections].sort(
    (a, b) => a.order - b.order,
  );
  const canEdit = checklist.access === "owner" || checklist.access === "editor";
  const hasCompleteReusable = checklist.sections
    .flatMap((s) => s.items)
    .some((i) => i.reusable && i.complete);

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onBack}>
          <Icon name="chevron-left" size={14} /> Back
        </button>

        <div className={styles.headerMeta}>
          <span className={styles.headerTitle}>{checklist.name}</span>
          {checklist.description && (
            <span className={styles.headerDesc}>{checklist.description}</span>
          )}
        </div>

        <div className={styles.headerActions}>
          <div className={styles.desktopActions}>
            <ButtonIcon
              name="copy"
              iconSize={14}
              label="Copy checklist ID"
              onClick={() => navigator.clipboard.writeText(checklistId)}
              placement="bottom"
            />

            <ButtonIcon
              name="eye"
              iconSize={16}
              label={
                checklist.subscribed
                  ? "Unwatch checklist"
                  : "Watch checklist for notifications"
              }
              onClick={toggleChecklistSubscription}
              active={checklist.subscribed}
              subvariant="info"
              placement="bottom"
            />

            {canEdit && hasCompleteReusable && (
              <ButtonIcon
                name="refresh"
                iconSize={16}
                label="Reset Reusable Items"
                onClick={handleResetReusable}
                placement="bottom"
              />
            )}

            {checklist.access === "owner" && (
              <ButtonIcon
                name="settings"
                iconSize={16}
                label="Settings"
                onClick={() => setShowShareModal(true)}
                placement="bottom"
              />
            )}
          </div>

          <ActionMenu actions={[
            {
              label: "Copy checklist ID",
              icon: "copy",
              onClick: () => navigator.clipboard.writeText(checklistId),
            },
            {
              label: checklist.subscribed ? "Unwatch checklist" : "Watch checklist",
              icon: "eye",
              onClick: toggleChecklistSubscription,
              active: checklist.subscribed,
              variant: "info" as MenuAction["variant"],
            },
            ...(canEdit && hasCompleteReusable ? [{
              label: "Reset Reusable Items",
              icon: "refresh",
              onClick: handleResetReusable,
            }] : []),
            ...(checklist.access === "owner" ? [{
              label: "Settings",
              icon: "settings",
              onClick: () => setShowShareModal(true),
            }] : []),
          ]} />
        </div>
      </div>

      {/* Body */}
      <div className={styles.body}>
        <div className={styles.sections}>
          {sortedSections.length === 0 && (
            <div className={styles.emptyState}>
              <span className={styles.emptyStateTitle}>No sections yet</span>
              <span className={styles.emptyStateDesc}>
                Add a section to start organizing your checklist.
              </span>
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
              onSectionResetReusable={handleResetSectionReusable}
              onItemUpdate={updateItemInState}
              onItemDelete={handleItemDelete}
              onItemAdd={handleItemAdd}
              onItemSubscriptionToggle={toggleItemSubscription}
              onItemMoveToSection={canEdit ? handleRequestMoveToSection : undefined}
              draggingItemId={draggingItemId}
              dragOverItemId={dragOverItemId}
              onItemDragStart={(itemId) =>
                handleItemDragStart(itemId, section.id)
              }
              onItemDragOver={handleItemDragOver}
              onItemDrop={(targetItemId) =>
                handleItemDrop(targetItemId, section.id)
              }
              onItemDragEnd={handleItemDragEnd}
              onItemDropOnSection={() => handleItemDropOnSection(section.id)}
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
              <button
                className={styles.addSectionBtn}
                onClick={handleAddSection}
              >
                <Icon name="plus" size={14} /> Add Section
              </button>
            </div>
          )}
        </div>
      </div>

      {moveRequest && checklist && (
        <Modal
          header={<span className={styles.modalTitle}>Move to section</span>}
          footer={
            <>
              <Button variant="secondary" onClick={cancelMoveToSection}>Cancel</Button>
              <Button variant="primary" disabled={!moveTargetSection} onClick={confirmMoveToSection}>Move</Button>
            </>
          }
          closeable
          onClose={cancelMoveToSection}
          maxWidth={400}
        >
          <div style={{ padding: "8px 4px" }}>
          <SearchableCombobox<SectionData>
            items={checklist.sections.filter((s) => s.id !== moveRequest.sectionId)}
            selectedItems={moveTargetSection ? [moveTargetSection] : []}
            onSelectionChange={(selected) => setMoveTargetSection(selected[0] ?? null)}
            renderItem={(section) => (
              <span style={{ fontSize: 13, color: "#e2e8f0" }}>{section.name}</span>
            )}
            filterItem={(section, term) =>
              section.name.toLowerCase().includes(term.toLowerCase())
            }
            getItemKey={(section) => section.id}
            placeholder="Search sections..."
          />
          </div>
        </Modal>
      )}

      {showShareModal && (
        <ShareModal
          checklistId={checklistId}
          checklistName={checklist.name}
          checklistDescription={checklist.description || ""}
          onClose={() => setShowShareModal(false)}
          users={users}
          currentUserId={checklist.currentUserId}
          onDetailsUpdate={(name, description) => {
            setChecklist((prev) =>
              prev ? { ...prev, name, description } : prev,
            );
          }}
        />
      )}
    </div>
  );
}
