"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Icon } from "@applicator/sdk/components";
import styles from "../apps/Taskboard.module.css";
import { ChecklistSummary } from "../types/ChecklistSummary";

interface Props {
  onOpen: (id: string) => void;
}

export default function ChecklistList({ onOpen }: Props) {
  const [owned, setOwned] = useState<ChecklistSummary[]>([]);
  const [shared, setShared] = useState<ChecklistSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tasklist/checklists");
      if (res.ok) {
        const data = await res.json();
        setOwned(data.owned || []);
        setShared(data.shared || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (!createName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/tasklist/checklists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: createName.trim(), description: createDesc.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setShowCreate(false);
        setCreateName("");
        setCreateDesc("");
        onOpen(data.id);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Delete this checklist and all its content?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/tasklist/checklists/${id}`, { method: "DELETE" });
      if (res.ok) {
        setOwned((prev) => prev.filter((c) => c.id !== id));
      }
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <div className={styles.loading}>Loading…</div>;

  return (
    <div className={styles.page}>
      <div className={styles.body}>
        <div className={styles.listHeader}>
          <span className={styles.listTitle}>Checklists</span>
          <button className={styles.addBtn} onClick={() => setShowCreate(true)}>
            <Icon name="plus" size={14} /> New Checklist
          </button>
        </div>

        {owned.length === 0 && shared.length === 0 && (
          <div className={styles.emptyState}>
            <span style={{ color: "#334155" }}><Icon name="list-view" size={32} /></span>
            <span className={styles.emptyStateTitle}>No checklists yet</span>
            <span className={styles.emptyStateDesc}>Create your first checklist to get started.</span>
          </div>
        )}

        {owned.length > 0 && (
          <>
            <div className={styles.sectionLabel}>My Checklists</div>
            <div className={styles.checklistGrid}>
              {owned.map((cl) => (
                <div key={cl.id} className={styles.checklistCard} onClick={() => onOpen(cl.id)}>
                  <div className={styles.checklistCardName}>{cl.name}</div>
                  {cl.description && (
                    <div className={styles.checklistCardDesc}>{cl.description}</div>
                  )}
                  <div
                    className={styles.checklistCardDelete}
                    onClick={(e) => handleDelete(e, cl.id)}
                  >
                    <button
                      className={styles.deleteBtn}
                      disabled={deletingId === cl.id}
                      title="Delete checklist"
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {shared.length > 0 && (
          <>
            <div className={styles.sectionLabel}>Shared With Me</div>
            <div className={styles.checklistGrid}>
              {shared.map((cl) => (
                <div key={cl.id} className={styles.checklistCard} onClick={() => onOpen(cl.id)}>
                  <div className={styles.checklistCardName}>{cl.name}</div>
                  {cl.description && (
                    <div className={styles.checklistCardDesc}>{cl.description}</div>
                  )}
                  <div className={styles.checklistCardBadge}>
                    <Icon name="users" size={10} />
                    {cl.role}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {showCreate && (
        <div className={styles.modalOverlay} onClick={() => setShowCreate(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>New Checklist</h2>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Name</label>
                <input
                  className={styles.formInput}
                  placeholder="Checklist name"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  autoFocus
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Description (optional)</label>
                <input
                  className={styles.formInput}
                  placeholder="Brief description"
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button
                className={styles.btnPrimary}
                onClick={handleCreate}
                disabled={!createName.trim() || creating}
              >
                {creating ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
