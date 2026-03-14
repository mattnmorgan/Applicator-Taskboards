"use client";

import React, { useState, useEffect, useCallback } from "react";
import styles from "./App.module.css";
import { ChecklistSummary } from "./types";

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
            <PlusIcon /> New Checklist
          </button>
        </div>

        {owned.length === 0 && shared.length === 0 && (
          <div className={styles.emptyState}>
            <ChecklistIcon size={32} color="#334155" />
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
                      <TrashIcon size={14} />
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
                    <ShareIcon size={10} />
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

// ─── Inline SVG icons ──────────────────────────────────────────

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function TrashIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}

function ShareIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function ChecklistIcon({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
      <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  );
}
