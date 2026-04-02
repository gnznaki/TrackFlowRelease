import { useState, useRef } from "react";
import { supabase } from "../lib/supabase";

async function openLink(url) {
  try {
    if (window.__TAURI_INTERNALS__) {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(url);
    } else {
      window.open(url, "_blank", "noopener");
    }
  } catch { window.open(url, "_blank", "noopener"); }
}

export const AVATAR_GRADIENTS = [
  { key: "lime",   a: "#c8ff47", b: "#3af0b0" },
  { key: "blue",   a: "#47c8ff", b: "#4780ff" },
  { key: "purple", a: "#b847ff", b: "#ff47b8" },
  { key: "orange", a: "#ff6b47", b: "#ffb347" },
  { key: "teal",   a: "#3af0b0", b: "#00c8ff" },
  { key: "rose",   a: "#ff4780", b: "#ff7447" },
];

const PLANS_INFO = {
  free: {
    name: "Free",
    color: null,
    features: [
      "Unlimited local boards",
      "FL Studio, Ableton, Pro Tools, Reaper & Logic Pro scanning",
      "Kanban with tags, notes & filters",
      "Cloud backup across devices",
      "Join shared boards",
    ],
  },
  premium: {
    name: "Premium",
    color: "#c8ff47",
    features: [
      "Everything in Free",
      "Share boards with collaborators",
      "Real-time sync across all devices",
      "Unlimited shared boards",
      "Early access to new features",
    ],
  },
};

function Check({ color }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color || "#3af0b0"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function formatDate(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return null;
  }
}

export default function ProfileModal({
  user,
  tier,
  displayName,
  avatarColor,
  avatarUrl,
  createdAt,
  invitesDisabled,
  isPaid,
  isPremium,
  onUpdateDisplayName,
  onUpdateAvatarColor,
  onUpdateAvatarUrl,
  onUpdateInvitesDisabled,
  onResetPassword,
  onDeleteAccount,
  onUpgrade,
  onManageBilling,
  onClose,
  theme,
}) {
  const C = theme;
  const font = C.font || "Syne";

  const [activeTab, setActiveTab] = useState("profile");

  // Profile tab state
  const [nameDraft, setNameDraft] = useState(displayName || "");
  const [nameSaving, setNameSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);

  // Security tab state
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  const grad = AVATAR_GRADIENTS.find(g => g.key === (avatarColor || "lime")) || AVATAR_GRADIENTS[0];

  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !user || !supabase) return;
    if (file.size > 5 * 1024 * 1024) { setUploadError("Image must be under 5 MB"); return; }
    setUploadingAvatar(true);
    setUploadError(null);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (upErr) { setUploadError(upErr.message); setUploadingAvatar(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
    // Bust cache by appending a timestamp
    await onUpdateAvatarUrl(`${publicUrl}?t=${Date.now()}`);
    setUploadingAvatar(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }
  const avatarLetter = displayName ? displayName[0].toUpperCase() : (user?.email?.[0]?.toUpperCase() ?? "?");

  const tierPlan = isPremium ? PLANS_INFO.premium : PLANS_INFO.free;
  const tierColor = isPremium ? C.accent : C.text3;

  async function handleSaveName() {
    if (!nameDraft.trim()) return;
    setNameSaving(true);
    await onUpdateDisplayName(nameDraft);
    setNameSaving(false);
  }

  async function handleResetPassword() {
    setResetLoading(true);
    await onResetPassword(user?.email);
    setResetLoading(false);
    setResetSent(true);
  }

  async function handleDeleteAccount() {
    if (deleteInput !== "DELETE") return;
    setDeleteLoading(true);
    await onDeleteAccount();
    setDeleteLoading(false);
  }

  const tabs = ["profile", "plan", "security"];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10010,
        fontFamily: font,
        padding: 24,
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          maxHeight: "90vh",
          overflowY: "auto",
          background: C.surface,
          border: `1px solid ${C.border2}`,
          borderRadius: C.r2,
          boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header area */}
        <div style={{ padding: "28px 28px 20px", borderBottom: `1px solid ${C.border}`, position: "relative" }}>
          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              background: "transparent",
              border: "none",
              color: C.text3,
              cursor: "pointer",
              fontSize: 22,
              lineHeight: 1,
              padding: "2px 6px",
              borderRadius: C.r,
            }}
            onMouseEnter={e => e.currentTarget.style.color = C.text}
            onMouseLeave={e => e.currentTarget.style.color = C.text3}
          >
            ×
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {/* Avatar circle — click to upload */}
            <div
              title="Click to upload photo"
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: 72, height: 72, borderRadius: "50%", flexShrink: 0, position: "relative",
                cursor: "pointer", boxShadow: `0 0 0 3px ${C.surface}, 0 0 0 4px ${grad.a}55`,
              }}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover", display: "block" }} />
              ) : (
                <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: `linear-gradient(135deg, ${grad.a}, ${grad.b})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800, color: "#0a0a0a" }}>
                  {avatarLetter}
                </div>
              )}
              {/* Upload overlay */}
              <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", opacity: uploadingAvatar ? 1 : 0, transition: "opacity 0.15s" }}
                onMouseEnter={e => { if (!uploadingAvatar) e.currentTarget.style.opacity = "1"; }}
                onMouseLeave={e => { if (!uploadingAvatar) e.currentTarget.style.opacity = "0"; }}>
                <span style={{ fontSize: 11, color: "#fff", fontWeight: 700, textAlign: "center", lineHeight: 1.3 }}>
                  {uploadingAvatar ? "…" : "Upload"}
                </span>
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: "none" }} onChange={handleAvatarUpload} />

            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Display name */}
              <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {displayName || <span style={{ color: C.text3, fontWeight: 400, fontSize: 16 }}>No display name</span>}
              </div>
              {/* Email */}
              <div style={{ fontSize: 12, color: C.text3, marginBottom: 7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user?.email}
              </div>
              {/* Tier badge */}
              <span style={{
                display: "inline-block",
                fontSize: 10,
                fontWeight: 700,
                padding: "3px 10px",
                borderRadius: 20,
                background: isPremium ? `${C.accent}22` : C.surface3,
                color: isPremium ? C.accent : C.text3,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
              }}>
                {tierPlan.name}
              </span>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ padding: "12px 28px 0", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 4 }}>
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: activeTab === tab ? C.surface2 : "transparent",
                border: activeTab === tab ? `1px solid ${C.border}` : "1px solid transparent",
                borderBottom: activeTab === tab ? `1px solid ${C.surface}` : "1px solid transparent",
                borderRadius: `${C.r}px ${C.r}px 0 0`,
                marginBottom: -1,
                padding: "7px 16px",
                color: activeTab === tab ? C.text : C.text3,
                fontFamily: font,
                fontSize: 12,
                fontWeight: activeTab === tab ? 700 : 400,
                cursor: "pointer",
                textTransform: "capitalize",
                transition: "color 0.15s",
              }}
              onMouseEnter={e => { if (activeTab !== tab) e.currentTarget.style.color = C.text2; }}
              onMouseLeave={e => { if (activeTab !== tab) e.currentTarget.style.color = C.text3; }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ padding: "24px 28px 28px", flex: 1 }}>

          {/* ── PROFILE TAB ────────────────────────────────────── */}
          {activeTab === "profile" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

              {/* Display Name */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.text3, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
                  Display Name
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={nameDraft}
                    onChange={e => setNameDraft(e.target.value)}
                    onBlur={handleSaveName}
                    onKeyDown={e => { if (e.key === "Enter") handleSaveName(); }}
                    placeholder="Enter display name…"
                    style={{
                      flex: 1,
                      background: C.surface2,
                      border: `1px solid ${C.border2}`,
                      borderRadius: C.r,
                      padding: "8px 12px",
                      color: C.text,
                      fontFamily: font,
                      fontSize: 13,
                      outline: "none",
                      transition: "border-color 0.15s",
                    }}
                    onFocus={e => e.currentTarget.style.borderColor = C.accent}
                    onBlurCapture={e => e.currentTarget.style.borderColor = C.border2}
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={nameSaving}
                    style={{
                      padding: "8px 16px",
                      background: C.accent,
                      border: "none",
                      borderRadius: C.r,
                      color: C.accentText,
                      fontFamily: font,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: nameSaving ? "default" : "pointer",
                      opacity: nameSaving ? 0.6 : 1,
                      flexShrink: 0,
                    }}
                  >
                    {nameSaving ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>

              {/* Profile Photo */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.text3, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
                  Profile Photo
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button onClick={() => fileInputRef.current?.click()} disabled={uploadingAvatar}
                    style={{ padding: "7px 14px", background: C.surface2, border: `1px solid ${C.border2}`, borderRadius: C.r, color: C.text, fontFamily: font, fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: uploadingAvatar ? 0.6 : 1 }}>
                    {uploadingAvatar ? "Uploading…" : "Upload Photo"}
                  </button>
                  {avatarUrl && (
                    <button onClick={() => onUpdateAvatarUrl(null)}
                      style={{ padding: "7px 14px", background: "transparent", border: `1px solid #ff505040`, borderRadius: C.r, color: "#ff5050", fontFamily: font, fontSize: 12, cursor: "pointer" }}>
                      Remove
                    </button>
                  )}
                </div>
                {uploadError && <div style={{ fontSize: 11, color: "#ff5050", marginTop: 6 }}>{uploadError}</div>}
                <div style={{ fontSize: 11, color: C.text3, marginTop: 6 }}>JPG, PNG, WEBP or GIF · Max 5 MB</div>
              </div>

              {/* Avatar Color */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.text3, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>
                  Avatar Color {avatarUrl && <span style={{ fontWeight: 400, textTransform: "none", fontSize: 10 }}>(used when no photo)</span>}
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  {AVATAR_GRADIENTS.map(g => {
                    const isSelected = (avatarColor || "lime") === g.key;
                    return (
                      <button
                        key={g.key}
                        onClick={() => onUpdateAvatarColor(g.key)}
                        title={g.key}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          background: `linear-gradient(135deg, ${g.a}, ${g.b})`,
                          border: isSelected ? `2px solid white` : "2px solid transparent",
                          boxShadow: isSelected ? `0 0 0 2px ${g.a}` : "none",
                          cursor: "pointer",
                          padding: 0,
                          transition: "box-shadow 0.15s, border-color 0.15s",
                          flexShrink: 0,
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Member since */}
              {createdAt && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.text3, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                    Member Since
                  </div>
                  <div style={{ fontSize: 13, color: C.text2 }}>
                    {formatDate(createdAt)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── PLAN TAB ───────────────────────────────────────── */}
          {activeTab === "plan" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Current plan card */}
              <div style={{
                background: C.surface2,
                border: `1px solid ${tierColor}50`,
                borderRadius: C.r2,
                padding: "18px 20px",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: tierColor, marginBottom: 2 }}>
                      {tierPlan.name}
                    </div>
                    <div style={{ fontSize: 11, color: C.text3 }}>Current plan</div>
                  </div>
                  <span style={{
                    fontSize: 9,
                    fontWeight: 700,
                    padding: "3px 10px",
                    borderRadius: 20,
                    background: `${tierColor}22`,
                    color: tierColor,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}>
                    ACTIVE
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {tierPlan.features.map(f => (
                    <div key={f} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <Check color={tierColor} />
                      <span style={{ fontSize: 12, color: C.text2, lineHeight: 1.5 }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA buttons */}
              {!isPaid && (
                <button
                  onClick={onUpgrade}
                  style={{
                    width: "100%",
                    padding: "11px 0",
                    background: C.accent,
                    border: "none",
                    borderRadius: C.r,
                    color: C.accentText,
                    fontFamily: font,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = "0.88"}
                  onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                >
                  Upgrade to Pro
                </button>
              )}

              {isPaid && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <button
                    onClick={onManageBilling}
                    style={{
                      width: "100%",
                      padding: "11px 0",
                      background: C.surface2,
                      border: `1px solid ${C.border}`,
                      borderRadius: C.r,
                      color: C.text,
                      fontFamily: font,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = C.border2}
                    onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
                  >
                    Manage Subscription
                  </button>
                  <button
                    onClick={onUpgrade}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: C.accent,
                      fontFamily: font,
                      fontSize: 12,
                      cursor: "pointer",
                      padding: "4px 0",
                      textDecoration: "underline",
                    }}
                  >
                    Change Plan
                  </button>
                </div>
              )}

              <div style={{ fontSize: 11, color: C.text3, textAlign: "center" }}>
                Checkout opens in your browser. Tier updates automatically.
              </div>
            </div>
          )}

          {/* ── SECURITY TAB ───────────────────────────────────── */}
          {activeTab === "security" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

              {/* Board Invitations toggle */}
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 6 }}>Board Invitations</div>
                <div style={{ fontSize: 12, color: C.text3, marginBottom: 12, lineHeight: 1.5 }}>
                  When disabled, no one can send you board invite requests. You can still join boards using a code.
                </div>
                <button
                  onClick={() => onUpdateInvitesDisabled(!invitesDisabled)}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", background: C.surface2, border: `1px solid ${invitesDisabled ? "rgba(255,80,80,0.4)" : C.border}`, borderRadius: C.r, color: invitesDisabled ? "#ff5050" : C.text, fontFamily: font, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}
                >
                  {/* Toggle pill */}
                  <div style={{ width: 34, height: 18, borderRadius: 9, background: invitesDisabled ? "rgba(255,80,80,0.6)" : C.accent, position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                    <div style={{ position: "absolute", top: 2, left: invitesDisabled ? 2 : 16, width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
                  </div>
                  {invitesDisabled ? "Invitations disabled" : "Invitations enabled"}
                </button>
              </div>

              <div style={{ height: 1, background: C.border }} />

              {/* Change Password */}
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 6 }}>
                  Change Password
                </div>
                <div style={{ fontSize: 12, color: C.text3, marginBottom: 14, lineHeight: 1.5 }}>
                  We'll send a reset link to your email.
                </div>
                {resetSent ? (
                  <div style={{
                    padding: "10px 14px",
                    background: `${C.accent}18`,
                    border: `1px solid ${C.accent}40`,
                    borderRadius: C.r,
                    fontSize: 12,
                    color: C.accent,
                    fontWeight: 600,
                  }}>
                    Reset link sent to {user?.email}
                  </div>
                ) : (
                  <button
                    onClick={handleResetPassword}
                    disabled={resetLoading}
                    style={{
                      padding: "9px 18px",
                      background: C.surface2,
                      border: `1px solid ${C.border}`,
                      borderRadius: C.r,
                      color: C.text,
                      fontFamily: font,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: resetLoading ? "default" : "pointer",
                      opacity: resetLoading ? 0.6 : 1,
                    }}
                  >
                    {resetLoading ? "Sending…" : "Send Reset Link"}
                  </button>
                )}
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: C.border }} />

              {/* Danger Zone */}
              <div style={{
                border: "1px solid rgba(255,80,80,0.35)",
                borderRadius: C.r2,
                padding: "18px 20px",
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#ff5050", marginBottom: 6 }}>
                  Danger Zone
                </div>
                <div style={{ fontSize: 12, color: C.text3, marginBottom: 14, lineHeight: 1.5 }}>
                  Permanently deletes your account and all associated data. This action cannot be undone.
                </div>

                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    style={{
                      padding: "8px 16px",
                      background: "transparent",
                      border: "1px solid #ff5050",
                      borderRadius: C.r,
                      color: "#ff5050",
                      fontFamily: font,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,80,80,0.08)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    Delete Account
                  </button>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.5 }}>
                      This permanently deletes your account and all data. Type <strong style={{ color: "#ff5050" }}>DELETE</strong> to confirm.
                    </div>
                    <input
                      value={deleteInput}
                      onChange={e => setDeleteInput(e.target.value)}
                      placeholder="Type DELETE"
                      style={{
                        background: C.surface2,
                        border: `1px solid rgba(255,80,80,0.4)`,
                        borderRadius: C.r,
                        padding: "8px 12px",
                        color: C.text,
                        fontFamily: font,
                        fontSize: 13,
                        outline: "none",
                      }}
                      onFocus={e => e.currentTarget.style.borderColor = "#ff5050"}
                      onBlur={e => e.currentTarget.style.borderColor = "rgba(255,80,80,0.4)"}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={handleDeleteAccount}
                        disabled={deleteInput !== "DELETE" || deleteLoading}
                        style={{
                          padding: "8px 16px",
                          background: deleteInput === "DELETE" ? "#ff5050" : "transparent",
                          border: "1px solid #ff5050",
                          borderRadius: C.r,
                          color: deleteInput === "DELETE" ? "#fff" : "#ff5050",
                          fontFamily: font,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: deleteInput === "DELETE" && !deleteLoading ? "pointer" : "default",
                          opacity: deleteLoading ? 0.6 : 1,
                          transition: "background 0.15s, color 0.15s",
                        }}
                      >
                        {deleteLoading ? "Deleting…" : "Delete Account"}
                      </button>
                      <button
                        onClick={() => { setShowDeleteConfirm(false); setDeleteInput(""); }}
                        style={{
                          padding: "8px 16px",
                          background: C.surface2,
                          border: `1px solid ${C.border}`,
                          borderRadius: C.r,
                          color: C.text2,
                          fontFamily: font,
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer links */}
        <div style={{ padding: "14px 28px 20px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 16, alignItems: "center", marginTop: 24 }}>
          <button onClick={() => openLink("https://gnznaki.github.io/TrackingMyFlowDog/privacy.html")}
            style={{ background: "none", border: "none", padding: 0, color: C.text3, fontFamily: font, fontSize: 11, cursor: "pointer" }}
            onMouseEnter={e => e.currentTarget.style.color = C.text2}
            onMouseLeave={e => e.currentTarget.style.color = C.text3}>
            Privacy Policy
          </button>
          <span style={{ color: C.border2, fontSize: 11 }}>·</span>
          <button onClick={() => openLink("https://github.com/gnznaki/TrackFlowRelease")}
            style={{ background: "none", border: "none", padding: 0, color: C.text3, fontFamily: font, fontSize: 11, cursor: "pointer" }}
            onMouseEnter={e => e.currentTarget.style.color = C.text2}
            onMouseLeave={e => e.currentTarget.style.color = C.text3}>
            GitHub
          </button>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: C.text3 }}>TrackFlow v1.2.1</span>
        </div>
      </div>
    </div>
  );
}
