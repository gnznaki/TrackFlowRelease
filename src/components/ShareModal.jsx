import { useState, useEffect } from "react";

export default function ShareModal({ boardId, boardName, mode, isShared, user, onShare, onJoin, onLeave, fetchMembers, onClose, theme }) {
  const [tab, setTab] = useState("share");
  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [members, setMembers] = useState([]);

  useEffect(() => {
    if (isShared) fetchMembers().then(setMembers);
  }, [isShared, fetchMembers]);

  function switchTab(t) { setTab(t); setError(null); setSuccess(null); }

  async function handleShare() {
    setLoading(true); setError(null);
    const err = await onShare(boardName);
    setLoading(false);
    if (err) { setError(err); return; }
    setSuccess("Board shared! Give the code above to your collaborators.");
    fetchMembers().then(setMembers);
  }

  async function handleJoin() {
    if (!joinCode.trim()) return;
    setLoading(true); setError(null);
    const err = await onJoin(joinCode);
    setLoading(false);
    if (err) { setError(err); return; }
    onClose();
  }

  function handleCopy() {
    navigator.clipboard.writeText(boardId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleLeave() {
    if (!window.confirm("Leave this shared board? Your local columns will remain but stop syncing.")) return;
    await onLeave(boardId);
    onClose();
  }

  const C = theme; // alias

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10001, fontFamily: C.font || "Syne" }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: 420, background: C.surface, border: `1px solid ${C.border2}`, borderRadius: C.r2, boxShadow: "0 24px 64px rgba(0,0,0,0.55)", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Collaborate</div>
            <div style={{ fontSize: 11, color: C.text3, marginTop: 1 }}>{boardName} · {mode} board</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: C.text3, cursor: "pointer", fontSize: 20, lineHeight: 1, padding: "2px 4px" }}>×</button>
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 18px", gap: 0 }}>
          {[["share", "Share Board"], ["join", "Join Board"]].map(([key, label]) => (
            <button key={key} onClick={() => switchTab(key)}
              style={{ padding: "10px 14px", background: "transparent", border: "none", borderBottom: tab === key ? `2px solid ${C.accent}` : "2px solid transparent", color: tab === key ? C.text : C.text3, fontFamily: C.font || "Syne", fontSize: 12, fontWeight: tab === key ? 700 : 400, cursor: "pointer", marginBottom: -1 }}>
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: 20, background: C.surface2 }}>

          {/* ── SHARE TAB ── */}
          {tab === "share" && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.text2, marginBottom: 6, letterSpacing: "0.05em" }}>BOARD CODE</div>
              <div style={{ display: "flex", gap: 8, marginBottom: isShared ? 16 : 12 }}>
                <div style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: C.r, padding: "9px 12px", fontFamily: "monospace", fontSize: 11, color: C.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {boardId}
                </div>
                <button onClick={handleCopy}
                  style={{ padding: "9px 14px", background: copied ? `rgba(${C.accentRgb},0.15)` : C.surface, border: `1px solid ${copied ? C.accent : C.border}`, borderRadius: C.r, color: copied ? C.accent : C.text2, fontFamily: C.font || "Syne", fontSize: 12, cursor: "pointer", flexShrink: 0, transition: "all 0.15s" }}>
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>

              {!isShared && (
                <>
                  <div style={{ fontSize: 12, color: C.text2, marginBottom: 14, lineHeight: 1.6 }}>
                    Share this code with your collaborators. Anyone with the code can join and edit this board in real-time.
                  </div>
                  <button onClick={handleShare} disabled={loading}
                    style={{ width: "100%", padding: "10px 0", background: C.accent, border: "none", borderRadius: C.r, color: C.accentText, fontFamily: C.font || "Syne", fontSize: 13, fontWeight: 700, cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1, marginBottom: 8 }}>
                    {loading ? "Sharing…" : "Share this board"}
                  </button>
                </>
              )}

              {error && <div style={{ fontSize: 12, color: "#ff5050", marginBottom: 10 }}>{error}</div>}
              {success && <div style={{ fontSize: 12, color: "#3af0b0", marginBottom: 10 }}>{success}</div>}

              {isShared && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.text2, marginBottom: 8, letterSpacing: "0.05em" }}>
                    MEMBERS {members.length > 0 && <span style={{ color: C.text3, fontWeight: 400 }}>({members.length})</span>}
                  </div>
                  {members.length === 0 ? (
                    <div style={{ fontSize: 12, color: C.text3, padding: "10px 0", marginBottom: 12 }}>No members yet. Share the code above.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                      {members.map(m => (
                        <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: C.surface, borderRadius: C.r, border: `1px solid ${C.border}` }}>
                          <div style={{ width: 26, height: 26, borderRadius: "50%", background: m.user_id === user?.id ? `linear-gradient(135deg, ${C.accent}, #47c8ff)` : C.surface3, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: m.user_id === user?.id ? C.accentText : C.text3, flexShrink: 0 }}>
                            {(m.profile?.email?.[0] ?? "?").toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {m.profile?.display_name || m.profile?.email || m.user_id.slice(0, 8) + "…"}
                              {m.user_id === user?.id && <span style={{ color: C.text3, fontWeight: 400 }}> (you)</span>}
                            </div>
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 700, color: m.role === "owner" ? C.accent : C.text3, background: m.role === "owner" ? `rgba(${C.accentRgb},0.12)` : C.surface3, padding: "2px 8px", borderRadius: 6, flexShrink: 0 }}>
                            {m.role}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={handleLeave}
                    style={{ width: "100%", padding: "8px 0", background: "transparent", border: `1px solid ${C.border}`, borderRadius: C.r, color: C.text3, fontFamily: C.font || "Syne", fontSize: 12, cursor: "pointer" }}>
                    Leave board
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── JOIN TAB ── */}
          {tab === "join" && (
            <div>
              <div style={{ fontSize: 12, color: C.text2, marginBottom: 16, lineHeight: 1.7 }}>
                Enter a board code shared by a collaborator to join their board and sync it into your workspace.
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.text2, marginBottom: 6, letterSpacing: "0.05em" }}>BOARD CODE</div>
              <input
                value={joinCode}
                onChange={e => setJoinCode(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleJoin(); }}
                placeholder="Paste the board code here…"
                style={{ width: "100%", background: C.surface, border: `1px solid ${joinCode ? C.accent + "60" : C.border}`, borderRadius: C.r, padding: "10px 12px", color: C.text, fontFamily: "monospace", fontSize: 12, outline: "none", boxSizing: "border-box", marginBottom: 14, transition: "border-color 0.15s" }}
              />
              {error && <div style={{ fontSize: 12, color: "#ff5050", marginBottom: 10 }}>{error}</div>}
              <button onClick={handleJoin} disabled={loading || !joinCode.trim()}
                style={{ width: "100%", padding: "10px 0", background: C.accent, border: "none", borderRadius: C.r, color: C.accentText, fontFamily: C.font || "Syne", fontSize: 13, fontWeight: 700, cursor: (loading || !joinCode.trim()) ? "default" : "pointer", opacity: !joinCode.trim() ? 0.45 : loading ? 0.7 : 1, marginBottom: 12 }}>
                {loading ? "Joining…" : "Join Board"}
              </button>
              <div style={{ fontSize: 11, color: C.text3, lineHeight: 1.6, padding: "10px 12px", background: C.surface, borderRadius: C.r, border: `1px solid ${C.border}` }}>
                Joining will replace your current <strong style={{ color: C.text2 }}>{mode}</strong> board with the shared one. Your existing columns will be overwritten.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
