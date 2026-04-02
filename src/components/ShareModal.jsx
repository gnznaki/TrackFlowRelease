import { useState } from "react";
import ConfirmModal from "./ConfirmModal";

const ROLE_LABELS = { owner: "Owner", editor: "Collaborator", viewer: "Viewer" };
const ROLE_DESC = {
  owner: "Full control, manages permissions",
  editor: "Can view, edit, move, and open files",
  viewer: "Read-only — cannot edit or move anything",
};

function RolePill({ role, C }) {
  const colors = {
    owner: { bg: `rgba(${C.accentRgb},0.15)`, text: C.accent },
    editor: { bg: "rgba(58,240,176,0.12)", text: "#3af0b0" },
    viewer: { bg: C.surface3, text: C.text3 },
  };
  const s = colors[role] || colors.viewer;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", background: s.bg, color: s.text, padding: "2px 8px", borderRadius: 6, flexShrink: 0 }}>
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

const RED = "#ff4d4d";
const RED_BG = "rgba(255,77,77,0.1)";
const RED_BORDER = "rgba(255,77,77,0.35)";

export default function ShareModal({ boardId, boardName, isShared, user, members, sentInvites, myRole, boardLocked, pendingInvites, onShare, onJoin, onLeave, onDelete, onUpdateRole, onRemoveMember, onAddMember, onRespondToInvite, onToggleLock, onClose, theme }) {
  const [tab, setTab] = useState("share");
  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lockLoading, setLockLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [roleLoading, setRoleLoading] = useState(null);
  const [pendingConfirm, setPendingConfirm] = useState(null);
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState("viewer");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState(null);
  const [addSuccess, setAddSuccess] = useState(null);
  const [respondingId, setRespondingId] = useState(null);
  const [removeLoading, setRemoveLoading] = useState(null);

  function switchTab(t) { setTab(t); setError(null); setSuccess(null); }

  async function handleShare() {
    setLoading(true); setError(null);
    const err = await onShare(boardName);
    setLoading(false);
    if (err) { setError(err); return; }
    setSuccess("Board shared! Share the code with your collaborators.");
  }

  async function handleJoin() {
    if (!joinCode.trim()) return;
    setLoading(true); setError(null);
    const err = await onJoin(joinCode.trim());
    setLoading(false);
    if (err) { setError(err); return; }
    onClose();
  }

  function copyCode() {
    navigator.clipboard.writeText(boardId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleLeave() {
    setPendingConfirm({
      title: "Leave this board?",
      message: "You'll lose access and the tab will be removed from your workspace.",
      confirmLabel: "Leave Board",
      onConfirm: async () => { setPendingConfirm(null); await onLeave(boardId); onClose(); },
    });
  }

  function handleDelete() {
    setPendingConfirm({
      title: "Remove sharing?",
      message: "All collaborators will immediately lose access and their tabs will be removed.",
      confirmLabel: "Remove Sharing",
      onConfirm: async () => { setPendingConfirm(null); await onDelete(boardId); onClose(); },
    });
  }

  async function handleToggleLock() {
    setLockLoading(true);
    await onToggleLock();
    setLockLoading(false);
  }

  async function handleAddMember() {
    if (!addEmail.trim()) return;
    setAddLoading(true); setAddError(null); setAddSuccess(null);
    const result = await onAddMember(addEmail.trim(), addRole);
    setAddLoading(false);
    if (result?.error) { setAddError(result.error); return; }
    setAddSuccess(`Invite sent to ${addEmail.trim()} as ${addRole === "editor" ? "Collaborator" : "Viewer"}.`);
    setAddEmail("");
    setTimeout(() => setAddSuccess(null), 3000);
  }

  async function handleRespond(inviteId, accept) {
    setRespondingId(inviteId);
    await onRespondToInvite(inviteId, accept);
    setRespondingId(null);
    if (accept) onClose(); // board will open as a new page
  }

  async function handleRemoveMember(userId, displayName) {
    setPendingConfirm({
      title: `Remove ${displayName}?`,
      message: "They'll immediately lose access to this board.",
      confirmLabel: "Remove",
      onConfirm: async () => {
        setPendingConfirm(null);
        setRemoveLoading(userId);
        await onRemoveMember(userId);
        setRemoveLoading(null);
      },
    });
  }

  async function handleRoleChange(userId, newRole) {
    setRoleLoading(userId);
    await onUpdateRole(userId, newRole);
    setRoleLoading(null);
  }

  const C = theme;
  const isOwner = myRole === "owner";
  const inviteCount = pendingInvites?.length ?? 0;

  return (
    <>
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10001, fontFamily: C.font || "Syne" }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: 460, background: C.surface, border: `1px solid ${C.border2}`, borderRadius: C.r2, boxShadow: "0 24px 64px rgba(0,0,0,0.55)", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{boardName}</div>
            <div style={{ fontSize: 11, color: C.text3, marginTop: 1 }}>
              {isShared
                ? boardLocked
                  ? "Board is locked — all editing disabled"
                  : `Collaborate in real-time · ${ROLE_LABELS[myRole] ?? myRole}`
                : "Share to collaborate in real-time"}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: C.text3, cursor: "pointer", fontSize: 20, lineHeight: 1, padding: "2px 4px" }}>×</button>
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 18px" }}>
          {[["share", "Share"], ["join", "Join Board"], ["invites", "Invites"]].map(([key, label]) => (
            <button key={key} onClick={() => switchTab(key)}
              style={{ position: "relative", padding: "10px 14px", background: "transparent", border: "none", borderBottom: tab === key ? `2px solid ${C.accent}` : "2px solid transparent", color: tab === key ? C.text : C.text3, fontFamily: C.font || "Syne", fontSize: 12, fontWeight: tab === key ? 700 : 400, cursor: "pointer", marginBottom: -1 }}>
              {label}
              {key === "invites" && inviteCount > 0 && (
                <span style={{ marginLeft: 5, minWidth: 16, height: 16, borderRadius: 8, background: "#ff4d4d", fontSize: 9, fontWeight: 800, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 4px", verticalAlign: "middle" }}>
                  {inviteCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: 20, background: C.surface2, maxHeight: "70vh", overflowY: "auto" }}>

          {/* ── SHARE TAB ── */}
          {tab === "share" && (
            <div>
              {/* Not yet shared — show the Share button */}
              {!isShared && (
                <>
                  <div style={{ fontSize: 12, color: C.text2, marginBottom: 14, lineHeight: 1.7 }}>
                    Share this board to collaborate in real-time with other TrackFlow users. They'll join as <strong style={{ color: C.text2 }}>Viewers</strong> — you can promote them to Collaborator once they're in.
                  </div>
                  <button onClick={handleShare} disabled={loading}
                    style={{ width: "100%", padding: "11px 0", background: C.accent, border: "none", borderRadius: C.r, color: C.accentText, fontFamily: C.font || "Syne", fontSize: 13, fontWeight: 700, cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1, marginBottom: 10 }}>
                    {loading ? "Sharing…" : "Share this board"}
                  </button>
                  {error && <div style={{ fontSize: 12, color: RED, marginTop: 4 }}>{error}</div>}
                </>
              )}

              {/* Already shared — show code + permissions */}
              {isShared && (
                <>
                  {success && <div style={{ fontSize: 12, color: "#3af0b0", marginBottom: 10 }}>{success}</div>}

                  {/* Board code */}
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.text2, marginBottom: 6, letterSpacing: "0.05em" }}>BOARD CODE</div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                    <div style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: C.r, padding: "9px 12px", fontFamily: "monospace", fontSize: 11, color: C.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {boardId}
                    </div>
                    <button onClick={copyCode}
                      style={{ padding: "9px 14px", background: copied ? `rgba(${C.accentRgb},0.15)` : C.surface, border: `1px solid ${copied ? C.accent : C.border}`, borderRadius: C.r, color: copied ? C.accent : C.text2, fontFamily: C.font || "Syne", fontSize: 12, cursor: "pointer", flexShrink: 0, transition: "all 0.15s" }}>
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>

                  {/* Permissions */}
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.text2, marginBottom: 4, letterSpacing: "0.05em" }}>MEMBERS</div>
                  <div style={{ fontSize: 11, color: C.text3, marginBottom: 10, lineHeight: 1.5 }}>
                    New joiners are <strong style={{ color: C.text2 }}>Viewers</strong> by default.
                    {isOwner && " Promote them to Collaborator to grant edit access."}
                  </div>

                  {members.length === 0 && (!sentInvites || sentInvites.length === 0) ? (
                    <div style={{ fontSize: 12, color: C.text3, padding: "10px 0", marginBottom: 12 }}>No members yet. Share the code above.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                      {members.map(m => {
                        const isMe = m.user_id === user?.id;
                        const isUpdating = roleLoading === m.user_id;
                        const displayName = m.profile?.display_name || m.profile?.email || m.user_id.slice(0, 8) + "…";
                        const GRADS = [
                          { key: "lime", a: "#c8ff47", b: "#3af0b0" }, { key: "blue", a: "#47c8ff", b: "#4780ff" },
                          { key: "purple", a: "#b847ff", b: "#ff47b8" }, { key: "orange", a: "#ff6b47", b: "#ffb347" },
                          { key: "teal", a: "#3af0b0", b: "#00c8ff" }, { key: "rose", a: "#ff4780", b: "#ff7447" },
                        ];
                        const grad = GRADS.find(g => g.key === (m.profile?.avatar_color || "lime")) || GRADS[0];

                        return (
                          <div key={m.user_id} style={{ background: C.surface, borderRadius: C.r, border: `1px solid ${C.border}`, overflow: "hidden" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
                              <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, overflow: "hidden", background: `linear-gradient(135deg, ${grad.a}, ${grad.b})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#000" }}>
                                {m.profile?.avatar_url
                                  ? <img src={m.profile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                                  : displayName[0].toUpperCase()}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {displayName}{isMe && <span style={{ color: C.text3, fontWeight: 400 }}> (you)</span>}
                                </div>
                                <div style={{ fontSize: 10, color: C.text3, marginTop: 1 }}>{ROLE_DESC[m.role]}</div>
                              </div>
                              <RolePill role={m.role} C={C} />
                            </div>

                            {/* Role controls + Remove — owner only, for non-owner members */}
                            {isOwner && !isMe && m.role !== "owner" && (
                              <div style={{ borderTop: `1px solid ${C.border}`, padding: "8px 12px", display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontSize: 10, color: C.text3, marginRight: 4 }}>Set role:</span>
                                {["viewer", "editor"].map(r => {
                                  const active = m.role === r;
                                  return (
                                    <button key={r} onClick={() => !active && !isUpdating && handleRoleChange(m.user_id, r)}
                                      disabled={isUpdating}
                                      style={{
                                        padding: "3px 10px", borderRadius: 6,
                                        border: `1px solid ${active ? C.accent : C.border}`,
                                        background: active ? `rgba(${C.accentRgb},0.15)` : "transparent",
                                        color: active ? C.accent : C.text3,
                                        fontFamily: C.font || "Syne", fontSize: 11, fontWeight: active ? 700 : 400,
                                        cursor: active || isUpdating ? "default" : "pointer", transition: "all 0.15s",
                                      }}>
                                      {isUpdating && !active ? "…" : r === "editor" ? "Collaborator" : "Viewer"}
                                    </button>
                                  );
                                })}
                                <div style={{ flex: 1 }} />
                                <button
                                  onClick={() => removeLoading !== m.user_id && handleRemoveMember(m.user_id, displayName)}
                                  disabled={removeLoading === m.user_id}
                                  style={{ padding: "3px 10px", borderRadius: 6, border: `1px solid ${RED_BORDER}`, background: "transparent", color: RED, fontFamily: C.font || "Syne", fontSize: 11, fontWeight: 600, cursor: removeLoading === m.user_id ? "default" : "pointer", opacity: removeLoading === m.user_id ? 0.6 : 1, transition: "all 0.15s" }}
                                  onMouseEnter={e => e.currentTarget.style.background = RED_BG}
                                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                >
                                  {removeLoading === m.user_id ? "…" : "Remove"}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Pending invites (greyed out) — owner only */}
                      {isOwner && sentInvites?.map(inv => {
                        const displayName = inv.display_name || inv.email || inv.invitee_id?.slice(0, 8) + "…";
                        const GRADS = [
                          { key: "lime", a: "#c8ff47", b: "#3af0b0" }, { key: "blue", a: "#47c8ff", b: "#4780ff" },
                          { key: "purple", a: "#b847ff", b: "#ff47b8" }, { key: "orange", a: "#ff6b47", b: "#ffb347" },
                          { key: "teal", a: "#3af0b0", b: "#00c8ff" }, { key: "rose", a: "#ff4780", b: "#ff7447" },
                        ];
                        const grad = GRADS.find(g => g.key === (inv.avatar_color || "lime")) || GRADS[0];
                        return (
                          <div key={inv.id} style={{ background: C.surface, borderRadius: C.r, border: `1px dashed ${C.border}`, overflow: "hidden", opacity: 0.6 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
                              <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, overflow: "hidden", background: `linear-gradient(135deg, ${grad.a}, ${grad.b})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#000" }}>
                                {inv.avatar_url
                                  ? <img src={inv.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                                  : displayName[0].toUpperCase()}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</div>
                                <div style={{ fontSize: 10, color: C.text3, marginTop: 1 }}>Invite pending · {inv.role === "editor" ? "Collaborator" : "Viewer"}</div>
                              </div>
                              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", background: C.surface3, color: C.text3, padding: "2px 8px", borderRadius: 6, flexShrink: 0 }}>Pending</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add member by email — owner only */}
                  {isOwner && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: C.text2, marginBottom: 6, letterSpacing: "0.05em" }}>ADD MEMBER</div>
                      <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                        <input
                          value={addEmail}
                          onChange={e => { setAddEmail(e.target.value); setAddError(null); }}
                          onKeyDown={e => { if (e.key === "Enter") handleAddMember(); }}
                          placeholder="Enter email address…"
                          style={{ flex: 1, background: C.surface, border: `1px solid ${addEmail ? C.accent + "60" : C.border}`, borderRadius: C.r, padding: "9px 12px", color: C.text, fontFamily: C.font || "Syne", fontSize: 12, outline: "none", boxSizing: "border-box", transition: "border-color 0.15s" }}
                        />
                        <button
                          onClick={handleAddMember}
                          disabled={addLoading || !addEmail.trim()}
                          style={{ padding: "9px 14px", background: addEmail.trim() ? C.accent : C.surface3, border: `1px solid ${addEmail.trim() ? C.accent : C.border2}`, borderRadius: C.r, color: addEmail.trim() ? C.accentText : C.text3, fontFamily: C.font || "Syne", fontSize: 12, fontWeight: 700, cursor: (addLoading || !addEmail.trim()) ? "default" : "pointer", flexShrink: 0, transition: "all 0.15s", opacity: addLoading ? 0.7 : 1 }}
                        >
                          {addLoading ? "…" : "Add"}
                        </button>
                      </div>
                      {/* Role selector */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <span style={{ fontSize: 10, color: C.text3 }}>Add as:</span>
                        {["viewer", "editor"].map(r => {
                          const active = addRole === r;
                          return (
                            <button key={r} onClick={() => setAddRole(r)}
                              style={{ padding: "3px 10px", borderRadius: 6, border: `1px solid ${active ? C.accent : C.border}`, background: active ? `rgba(${C.accentRgb},0.15)` : "transparent", color: active ? C.accent : C.text3, fontFamily: C.font || "Syne", fontSize: 11, fontWeight: active ? 700 : 400, cursor: "pointer", transition: "all 0.15s" }}>
                              {r === "editor" ? "Collaborator" : "Viewer"}
                            </button>
                          );
                        })}
                      </div>
                      {addError && <div style={{ fontSize: 11, color: RED, marginTop: 2 }}>{addError}</div>}
                      {addSuccess && <div style={{ fontSize: 11, color: "#3af0b0", marginTop: 2 }}>{addSuccess}</div>}
                    </div>
                  )}

                  {/* Owner actions */}
                  {isOwner && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                      {/* Lock / Unlock */}
                      <button onClick={handleToggleLock} disabled={lockLoading}
                        style={{ width: "100%", padding: "9px 0", background: boardLocked ? `rgba(${C.accentRgb},0.12)` : "transparent", border: `1px solid ${boardLocked ? C.accent : C.border2}`, borderRadius: C.r, color: boardLocked ? C.accent : C.text2, fontFamily: C.font || "Syne", fontSize: 12, fontWeight: 600, cursor: lockLoading ? "default" : "pointer", transition: "all 0.15s", opacity: lockLoading ? 0.6 : 1 }}>
                        {lockLoading ? "…" : boardLocked ? "Unlock Board" : "Lock Board"}
                      </button>
                      {boardLocked && (
                        <div style={{ fontSize: 11, color: C.text3, textAlign: "center", marginTop: -4, marginBottom: 4 }}>
                          Board is locked — all users (including you) are read-only
                        </div>
                      )}
                      {/* Remove Sharing */}
                      <button onClick={handleDelete}
                        style={{ width: "100%", padding: "9px 0", background: RED_BG, border: `1px solid ${RED_BORDER}`, borderRadius: C.r, color: RED, fontFamily: C.font || "Syne", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}>
                        Remove Sharing
                      </button>
                    </div>
                  )}

                  {/* Non-owner: Leave board */}
                  {!isOwner && (
                    <button onClick={handleLeave}
                      style={{ width: "100%", padding: "9px 0", background: RED_BG, border: `1px solid ${RED_BORDER}`, borderRadius: C.r, color: RED, fontFamily: C.font || "Syne", fontSize: 12, fontWeight: 600, cursor: "pointer", marginTop: 4 }}>
                      Leave Board
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── INVITES TAB ── */}
          {tab === "invites" && (
            <div>
              <div style={{ fontSize: 12, color: C.text2, marginBottom: 16, lineHeight: 1.7 }}>
                Board invitations sent to you. Accept to join or decline to remove them.
              </div>
              {inviteCount === 0 ? (
                <div style={{ fontSize: 12, color: C.text3, padding: "16px 0", textAlign: "center" }}>
                  No pending invitations
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {pendingInvites.map(inv => {
                    const isResponding = respondingId === inv.id;
                    return (
                      <div key={inv.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: C.r, padding: "12px 14px" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 3 }}>{inv.board_name}</div>
                        <div style={{ fontSize: 11, color: C.text3, marginBottom: 10 }}>
                          Invited by <strong style={{ color: C.text2 }}>{inv.inviter_name || "someone"}</strong> · as {inv.role === "editor" ? "Collaborator" : "Viewer"}
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => !isResponding && handleRespond(inv.id, true)} disabled={isResponding}
                            style={{ flex: 1, padding: "7px 0", background: C.accent, border: "none", borderRadius: C.r, color: C.accentText, fontFamily: C.font || "Syne", fontSize: 12, fontWeight: 700, cursor: isResponding ? "default" : "pointer", opacity: isResponding ? 0.7 : 1 }}>
                            {isResponding ? "…" : "Accept"}
                          </button>
                          <button onClick={() => !isResponding && handleRespond(inv.id, false)} disabled={isResponding}
                            style={{ flex: 1, padding: "7px 0", background: "transparent", border: `1px solid ${RED_BORDER}`, borderRadius: C.r, color: RED, fontFamily: C.font || "Syne", fontSize: 12, fontWeight: 600, cursor: isResponding ? "default" : "pointer", opacity: isResponding ? 0.7 : 1 }}>
                            {isResponding ? "…" : "Decline"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── JOIN TAB ── */}
          {tab === "join" && (
            <div>
              <div style={{ fontSize: 12, color: C.text2, marginBottom: 16, lineHeight: 1.7 }}>
                Paste a board code to join as a <strong style={{ color: C.text2 }}>Viewer</strong>. The board owner can promote you to Collaborator once you're in.
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.text2, marginBottom: 6, letterSpacing: "0.05em" }}>BOARD CODE</div>
              <input
                value={joinCode}
                onChange={e => setJoinCode(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleJoin(); }}
                placeholder="Paste the board code here…"
                style={{ width: "100%", background: C.surface, border: `1px solid ${joinCode ? C.accent + "60" : C.border}`, borderRadius: C.r, padding: "10px 12px", color: C.text, fontFamily: "monospace", fontSize: 12, outline: "none", boxSizing: "border-box", marginBottom: 14, transition: "border-color 0.15s" }}
              />
              {error && <div style={{ fontSize: 12, color: RED, marginBottom: 10 }}>{error}</div>}
              <button onClick={handleJoin} disabled={loading || !joinCode.trim()}
                style={{ width: "100%", padding: "10px 0", background: C.accent, border: "none", borderRadius: C.r, color: C.accentText, fontFamily: C.font || "Syne", fontSize: 13, fontWeight: 700, cursor: (loading || !joinCode.trim()) ? "default" : "pointer", opacity: !joinCode.trim() ? 0.45 : loading ? 0.7 : 1, marginBottom: 12 }}>
                {loading ? "Joining…" : "Join Board"}
              </button>
              <div style={{ fontSize: 11, color: C.text3, lineHeight: 1.6, padding: "10px 12px", background: C.surface, borderRadius: C.r, border: `1px solid ${C.border}` }}>
                The shared board will open as a new page. You'll join as a <strong style={{ color: C.text2 }}>Viewer</strong> — the owner can grant edit access from the Members panel.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    {pendingConfirm && (
      <ConfirmModal
        title={pendingConfirm.title}
        message={pendingConfirm.message}
        confirmLabel={pendingConfirm.confirmLabel}
        destructive
        onConfirm={pendingConfirm.onConfirm}
        onCancel={() => setPendingConfirm(null)}
        theme={theme}
      />
    )}
  </>
  );
}
