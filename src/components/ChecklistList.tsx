"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ButtonIcon, Icon } from "@applicator/sdk/components";
import styles from "@/src/apps/Taskboard.module.css";
import { ChecklistSummary } from "@/src/types/ChecklistSummary";

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
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

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

  const handleLeave = async (cl: ChecklistSummary) => {
    if (!cl.shareId) return;
    setLeavingId(cl.id);
    try {
      const res = await fetch(`/api/tasklist/checklists/${cl.id}/shares/${cl.shareId}`, { method: "DELETE" });
      if (res.ok) {
        setShared((prev) => prev.filter((c) => c.id !== cl.id));
      }
    } finally {
      setLeavingId(null);
    }
  };

  const handleDelete = async (id: string) => {
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

  const q = search.trim().toLowerCase();
  const matchCl = (cl: ChecklistSummary) =>
    !q ||
    cl.name.toLowerCase().includes(q) ||
    cl.description.toLowerCase().includes(q) ||
    cl.ownerName.toLowerCase().includes(q);

  const filteredOwned = owned.filter(matchCl);
  const filteredShared = shared.filter(matchCl);
  const hasResults = filteredOwned.length > 0 || filteredShared.length > 0;

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

        {(owned.length > 0 || shared.length > 0) && (
          <input
            className={styles.checklistSearchBar}
            placeholder="Search by name, description, or owner…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        )}

        {q && !hasResults && (
          <div style={{ color: "#475569", fontSize: 13, textAlign: "center", padding: "24px 0" }}>
            No checklists match &ldquo;{search}&rdquo;.
          </div>
        )}

        {filteredOwned.length > 0 && (
          <>
            <div className={styles.sectionLabel}>My Checklists</div>
            <div className={styles.checklistGrid}>
              {filteredOwned.map((cl) => (
                <div key={cl.id} className={styles.checklistCard} onClick={() => onOpen(cl.id)}>
                  <div className={styles.checklistCardName}>{cl.name}</div>
                  {cl.description && (
                    <div className={styles.checklistCardDesc}>{cl.description}</div>
                  )}
                  <div className={styles.checklistCardFooter}>
                    <span className={styles.checklistCardOwner}>
                      <Icon name="user" size={10} />
                      {cl.ownerName}
                    </span>
                  </div>
                  <div
                    className={styles.checklistCardDelete}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ButtonIcon
                      name="trash"
                      iconSize={14}
                      label="Delete checklist"
                      onClick={() => handleDelete(cl.id)}
                      disabled={deletingId === cl.id}
                      subvariant="danger"
                      placement="top"
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {filteredShared.length > 0 && (
          <>
            <div className={styles.sectionLabel}>Shared With Me</div>
            <div className={styles.checklistGrid}>
              {filteredShared.map((cl) => (
                <div key={cl.id} className={styles.checklistCard} onClick={() => onOpen(cl.id)}>
                  <div className={styles.checklistCardName}>{cl.name}</div>
                  {cl.description && (
                    <div className={styles.checklistCardDesc}>{cl.description}</div>
                  )}
                  <div className={styles.checklistCardFooter}>
                    <span className={styles.checklistCardOwner}>
                      <Icon name="user" size={10} />
                      {cl.ownerName}
                    </span>
                    <div className={styles.checklistCardBadge}>
                      <Icon name="users" size={10} />
                      {cl.role}
                    </div>
                  </div>
                  <div
                    className={styles.checklistCardDelete}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ButtonIcon
                      name="eye-off"
                      iconSize={14}
                      label="Remove from Shared"
                      onClick={() => handleLeave(cl)}
                      disabled={leavingId === cl.id}
                      placement="top"
                    />
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
