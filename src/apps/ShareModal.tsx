"use client";

import React, { useState, useEffect, useCallback } from "react";
import styles from "./App.module.css";
import { SystemUser } from "./types";

interface ShareEntry {
  id: string;
  userId: string;
  displayName: string;
  username: string;
  role: "editor" | "viewer";
}

interface Props {
  checklistId: string;
  onClose: () => void;
  users: SystemUser[];
  currentUserId: string;
}

export default function ShareModal({ checklistId, onClose, users, currentUserId }: Props) {
  const [shares, setShares] = useState<ShareEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState<"editor" | "viewer">("editor");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tasklist/checklists/${checklistId}/shares`);
      if (res.ok) {
        const data = await res.json();
        setShares(data.shares || []);
      }
    } finally {
      setLoading(false);
    }
  }, [checklistId]);

  useEffect(() => {
    load();
  }, [load]);

  const addShare = async () => {
    if (!selectedUserId) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasklist/checklists/${checklistId}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId, role: selectedRole }),
      });
      if (res.ok) {
        const data = await res.json();
        setShares((prev) => [...prev, data]);
        setSelectedUserId("");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to share");
      }
    } finally {
      setAdding(false);
    }
  };

  const updateRole = async (shareId: string, role: "editor" | "viewer") => {
    try {
      const res = await fetch(`/api/tasklist/checklists/${checklistId}/shares/${shareId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (res.ok) {
        setShares((prev) => prev.map((s) => (s.id === shareId ? { ...s, role } : s)));
      }
    } catch {}
  };

  const removeShare = async (shareId: string) => {
    try {
      const res = await fetch(`/api/tasklist/checklists/${checklistId}/shares/${shareId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setShares((prev) => prev.filter((s) => s.id !== shareId));
      }
    } catch {}
  };

  // Only show users that aren't already shared and aren't the owner
  const availableUsers = users.filter(
    (u) => u.id !== currentUserId && !shares.find((s) => s.userId === u.id),
  );

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>Share Settings</h2>

        <div className={styles.modalBody}>
          {/* Add user */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Add person</label>
            <div style={{ display: "flex", gap: 8 }}>
              <select
                className={styles.formSelect}
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
              >
                <option value="">Select user…</option>
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.displayName} (@{u.username})
                  </option>
                ))}
              </select>
              <select
                className={styles.formSelect}
                style={{ width: "100px", flexShrink: 0 }}
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as "editor" | "viewer")}
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                className={styles.btnPrimary}
                onClick={addShare}
                disabled={!selectedUserId || adding}
                style={{ flexShrink: 0 }}
              >
                {adding ? "Adding…" : "Add"}
              </button>
            </div>
            {error && (
              <span style={{ fontSize: 12, color: "#f87171" }}>{error}</span>
            )}
          </div>

          {/* Current shares */}
          {!loading && shares.length > 0 && (
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Shared with</label>
              <div className={styles.shareList}>
                {shares.map((share) => (
                  <div key={share.id} className={styles.shareItem}>
                    <span className={styles.shareAvatar}>
                      {share.displayName.charAt(0).toUpperCase()}
                    </span>
                    <div className={styles.shareUserInfo}>
                      <div className={styles.shareUserName}>{share.displayName}</div>
                      <div className={styles.shareUserHandle}>@{share.username}</div>
                    </div>
                    <select
                      className={styles.shareRoleSelect}
                      value={share.role}
                      onChange={(e) => updateRole(share.id, e.target.value as "editor" | "viewer")}
                    >
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button
                      className={styles.iconBtn}
                      onClick={() => removeShare(share.id)}
                      title="Remove access"
                    >
                      <XIcon />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && shares.length === 0 && (
            <div style={{ color: "#475569", fontSize: 13, textAlign: "center", padding: "12px 0" }}>
              This checklist has not been shared yet.
            </div>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.btnSecondary} onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
