import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { postToDiscord } from "../lib/discord";
import { Icon, Icons } from "./Icon";

export default function SettingsPanel({ discordWebhook, colMaxHeight, onSave, onClose, theme }) {
  const [webhook, setWebhook] = useState(discordWebhook);
  const [maxH, setMaxH] = useState(colMaxHeight);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [updateStatus, setUpdateStatus] = useState(null);
  const [checking, setChecking] = useState(false);

  async function testWebhook() {
    setTesting(true); setTestResult(null);
    const ok = await postToDiscord(webhook, "✅ TrackFlow Test", "Webhook connected!", 0x3af0b0);
    setTesting(false); setTestResult(ok ? "success" : "fail");
  }

  async function checkUpdate() {
    setChecking(true); setUpdateStatus(null);
    try {
      const result = await invoke("check_for_update");
      setUpdateStatus(result);
    } catch (e) {
      setUpdateStatus({ available: false, error: String(e) });
    }
    setChecking(false);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: theme.surface, border: `1px solid ${theme.border2}`, borderRadius: theme.r2, padding: 28, width: 480, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 20, color: theme.text }}>Settings</div>

        {/* Column height */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 4 }}>Column Height</div>
          <div style={{ fontSize: 11, color: theme.text3, marginBottom: 10 }}>Sets a fixed height for all columns so grid rows stay aligned.</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input type="range" min={200} max={900} step={20} value={maxH} onChange={e => setMaxH(Number(e.target.value))} style={{ flex: 1 }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: theme.accent, fontFamily: "monospace", minWidth: 50 }}>{maxH}px</span>
          </div>
        </div>

        {/* Updates */}
        <div style={{ marginBottom: 24, padding: 16, background: theme.surface2, borderRadius: theme.r, border: `1px solid ${theme.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 4 }}>Updates</div>
          <div style={{ fontSize: 11, color: theme.text3, marginBottom: 12, lineHeight: 1.6 }}>Updates install automatically and preserve your entire saved state. Your projects, tags, and layout will be exactly as you left them.</div>
          <button onClick={checkUpdate} disabled={checking} style={{ padding: "7px 16px", background: theme.surface3, border: `1px solid ${theme.border2}`, borderRadius: theme.r, color: theme.text, fontFamily: "Syne", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <Icon d={Icons.update} size={13} />{checking ? "Checking..." : "Check for Updates"}
          </button>
          {updateStatus && (
            <div style={{ marginTop: 10, fontSize: 12, color: updateStatus.available ? theme.accent : theme.text3 }}>
              {updateStatus.available ? `✓ Update available: v${updateStatus.version}` : updateStatus.error ? `Error: ${updateStatus.error}` : "✓ You're on the latest version"}
            </div>
          )}
        </div>

        {/* Discord webhook */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 4 }}>Discord Error Webhook</div>
          <div style={{ fontSize: 11, color: theme.text3, marginBottom: 10, lineHeight: 1.6 }}>
            When TrackFlow hits an error, a "Send Error Report" button appears. Paste your Discord webhook and it'll DM you the details.<br />
            <span style={{ color: theme.accent }}>Server → Channel → Integrations → Webhooks → New Webhook → Copy URL</span>
          </div>
          <input value={webhook} onChange={e => setWebhook(e.target.value)} placeholder="https://discord.com/api/webhooks/..."
            style={{ width: "100%", background: theme.surface2, border: `1px solid ${theme.border}`, borderRadius: theme.r, padding: "9px 12px", color: theme.text, fontFamily: "monospace", fontSize: 11, outline: "none", marginBottom: 8 }} />
          <button onClick={testWebhook} disabled={!webhook || testing}
            style={{ padding: "6px 14px", background: testResult === "success" ? "#3af0b0" : testResult === "fail" ? "#ff5050" : theme.surface3, border: `1px solid ${theme.border}`, borderRadius: theme.r, color: testResult ? "#0a0a0b" : theme.text2, fontFamily: "Syne", fontSize: 12, cursor: "pointer" }}>
            {testing ? "Sending..." : testResult === "success" ? "✓ Test sent!" : testResult === "fail" ? "✗ Failed" : "Send Test Message"}
          </button>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => onSave(webhook, maxH)} style={{ flex: 1, padding: 11, background: theme.accent, border: "none", borderRadius: theme.r, color: theme.accentText, fontFamily: "Syne", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>Save</button>
          <button onClick={onClose} style={{ padding: "11px 20px", background: theme.surface2, border: `1px solid ${theme.border}`, borderRadius: theme.r, color: theme.text2, fontFamily: "Syne", fontSize: 13, cursor: "pointer" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
