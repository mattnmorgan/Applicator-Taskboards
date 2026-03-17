"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Icon, SearchableCombobox, Tooltip } from "@applicator/sdk/components";
import styles from "@/src/apps/Taskboard.module.css";
import { SystemUser } from "@/src/types/SystemUser";

interface ShareEntry {
  id: string;
  userId: string;
  displayName: string;
  username: string;
  profilePicture: string | null;
  role: "editor" | "viewer";
}

interface Props {
  checklistId: string;
  checklistName: string;
  checklistDescription: string;
  onClose: () => void;
  users: SystemUser[];
  currentUserId: string;
  onDetailsUpdate: (name: string, description: string) => void;
}

export default function ShareModal({ checklistId, checklistName, checklistDescription, onClose, users, currentUserId, onDetailsUpdate }: Props) {
  const [activeTab, setActiveTab] = useState<"share" | "details">("share");
  const [shares, setShares] = useState<ShareEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<"editor" | "viewer">("editor");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Details tab state
  const [detailsName, setDetailsName] = useState(checklistName);
  const [detailsDescription, setDetailsDescription] = useState(checklistDescription);
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

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
    if (!selectedUser) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasklist/checklists/${checklistId}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUser.id, role: selectedRole }),
      });
      if (res.ok) {
        const data = await res.json();
        setShares((prev) => [...prev, data]);
        setSelectedUser(null);
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
        const data = await res.json();
        setShares((prev) => prev.map((s) => (s.id === shareId ? { ...s, id: data.id, role } : s)));
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

  const saveDetails = async () => {
    if (!detailsName.trim()) return;
    setSavingDetails(true);
    setDetailsError(null);
    try {
      const res = await fetch(`/api/tasklist/checklists/${checklistId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: detailsName.trim(), description: detailsDescription.trim() }),
      });
      if (res.ok) {
        onDetailsUpdate(detailsName.trim(), detailsDescription.trim());
      } else {
        const data = await res.json();
        setDetailsError(data.error || "Failed to save");
      }
    } finally {
      setSavingDetails(false);
    }
  };

  // Only show users that aren't already shared and aren't the owner
  const availableUsers = users.filter(
    (u) => u.id !== currentUserId && !shares.find((s) => s.userId === u.id),
  );

  const tabStyle = (tab: "share" | "details"): React.CSSProperties => ({
    padding: "6px 14px",
    fontSize: 13,
    fontWeight: activeTab === tab ? 600 : 400,
    color: activeTab === tab ? "#f1f5f9" : "#64748b",
    background: "none",
    border: "none",
    borderBottom: activeTab === tab ? "2px solid #3b82f6" : "2px solid transparent",
    cursor: "pointer",
    transition: "color 0.15s, border-color 0.15s",
    marginBottom: -1,
  });

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>Share Settings</h2>

        {/* Tab bar */}
        <div style={{ display: "flex", borderBottom: "1px solid #334155", marginBottom: 4 }}>
          <button style={tabStyle("share")} onClick={() => setActiveTab("share")}>Share</button>
          <button style={tabStyle("details")} onClick={() => setActiveTab("details")}>Details</button>
        </div>

        <div className={styles.modalBody}>
          {activeTab === "share" && (
            <>
              {/* Add user */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Add person</label>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <SearchableCombobox<SystemUser>
                      items={availableUsers}
                      selectedItems={selectedUser ? [selectedUser] : []}
                      onSelectionChange={(selected) => setSelectedUser(selected[0] || null)}
                      renderItem={(u) => (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#e2e8f0" }}>
                          <div
                            style={{
                              width: 20,
                              height: 20,
                              minWidth: 20,
                              borderRadius: "50%",
                              background: "#3b82f6",
                              color: "#fff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "10px",
                              fontWeight: 600,
                              overflow: "hidden",
                              flexShrink: 0,
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
                          <div>
                            <div style={{ fontWeight: 500 }}>{u.displayName}</div>
                            <div style={{ fontSize: 11, color: "#64748b" }}>@{u.username}</div>
                          </div>
                        </div>
                      )}
                      filterItem={(u, term) =>
                        u.displayName.toLowerCase().includes(term.toLowerCase()) ||
                        u.username.toLowerCase().includes(term.toLowerCase())
                      }
                      getItemKey={(u) => u.id}
                      placeholder="Search users…"
                    />
                  </div>
                  <select
                    className={styles.formSelect}
                    style={{ width: 100, flexShrink: 0 }}
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value as "editor" | "viewer")}
                  >
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button
                    className={styles.btnPrimary}
                    onClick={addShare}
                    disabled={!selectedUser || adding}
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
                          {share.profilePicture ? (
                            <img
                              src={share.profilePicture}
                              alt={share.displayName}
                              style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover", display: "block" }}
                            />
                          ) : (
                            share.displayName.charAt(0).toUpperCase()
                          )}
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
                        <Tooltip text="Remove access" placement="top">
                          <button
                            className={styles.iconBtn}
                            onClick={() => removeShare(share.id)}
                          >
                            <Icon name="close" size={14} />
                          </button>
                        </Tooltip>
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
            </>
          )}

          {activeTab === "details" && (
            <>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Name</label>
                <input
                  className={styles.formInput}
                  value={detailsName}
                  onChange={(e) => setDetailsName(e.target.value)}
                  placeholder="Checklist name"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Description</label>
                <input
                  className={styles.formInput}
                  value={detailsDescription}
                  onChange={(e) => setDetailsDescription(e.target.value)}
                  placeholder="Brief description (optional)"
                />
              </div>
              {detailsError && (
                <span style={{ fontSize: 12, color: "#f87171" }}>{detailsError}</span>
              )}
            </>
          )}
        </div>

        <div className={styles.modalFooter}>
          {activeTab === "details" ? (
            <>
              <button className={styles.btnSecondary} onClick={onClose}>Cancel</button>
              <button
                className={styles.btnPrimary}
                onClick={saveDetails}
                disabled={!detailsName.trim() || savingDetails}
              >
                {savingDetails ? "Saving…" : "Save"}
              </button>
            </>
          ) : (
            <button className={styles.btnSecondary} onClick={onClose}>Done</button>
          )}
        </div>
      </div>
    </div>
  );
}
