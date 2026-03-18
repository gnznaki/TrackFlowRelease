import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { check } from "@tauri-apps/plugin-updater";
import { postToDiscord } from "../lib/discord";
import { Icon, Icons } from "./Icon";

export default function SettingsPanel({ discordWebhook, colMaxHeight, onSave, onClose, theme }) {
  const [webhook, setWebhook] = useState(discordWebhook);
  const [maxH, setMaxH] = useState(colMaxHeight);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Version + update state
  const [appVersion, setAppVersion] = useState(null);
  const [updatePhase, setUpdatePhase] = useState("idle"); // idle|checking|up_to_date|available|downloading|installing|error
  const [updateObj, setUpdateObj] = useState(null);      // the live update object from the JS plugin
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [updateError, setUpdateError] = useState(null);

  useEffect(() => { getVersion().then(setAppVersion).catch(() => {}); }, []);

  async function checkUpdate() {
    setUpdatePhase("checking");
    setUpdateError(null);
    try {
      const update = await check();
      if (update?.available) {
        setUpdateObj(update);
        setUpdatePhase("available");
      } else {
        setUpdatePhase("up_to_date");
      }
    } catch (e) {
      setUpdateError(String(e));
      setUpdatePhase("error");
    }
  }

  async function startInstall() {
    if (!updateObj) return;
    setDownloadProgress(0);
    setUpdatePhase("downloading");
    try {
      // Backup state before installing
      await invoke("backup_app_state").catch(() => {});
      let contentLength = 0;
      let downloaded = 0;
      await updateObj.downloadAndInstall((event) => {
        if (event.event === "Started") {
          contentLength = event.data.contentLength ?? 0;
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          const pct = contentLength > 0 ? Math.round((downloaded / contentLength) * 100) : 0;
          setDownloadProgress(pct);
        } else if (event.event === "Finished") {
          setUpdatePhase("installing");
        }
      });
      // On Windows (NSIS) the installer closes and relaunches the app automatically
      setUpdatePhase("installing");
    } catch (e) {
      setUpdateError(String(e));
      setUpdatePhase("error");
    }
  }

  async function testWebhook() {
    setTesting(true); setTestResult(null);
    const ok = await postToDiscord(webhook, "✅ TrackFlow Test", "Webhook connected!", 0x3af0b0);
    setTesting(false); setTestResult(ok ? "success" : "fail");
  }

  const s = theme; // alias for brevity

  function UpdateSection() {
    if (updatePhase === "downloading" || updatePhase === "installing") {
      return (
        <div style={{ padding: 16, background: s.surface2, borderRadius: s.r, border: `1px solid ${s.accent}40` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.accent, animation: "pulse 1.2s infinite" }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: s.text }}>
              {updatePhase === "installing" ? "Installing update..." : `Downloading v${updateObj?.version}...`}
            </span>
          </div>
          {updatePhase === "downloading" && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ height: 4, background: s.surface3, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${downloadProgress}%`, background: s.accent, borderRadius: 4, transition: "width 0.3s ease" }} />
              </div>
              <div style={{ fontSize: 10, color: s.text3, fontFamily: "monospace", marginTop: 5 }}>{downloadProgress}%</div>
            </div>
          )}
          <div style={{ fontSize: 11, color: s.text3, lineHeight: 1.6 }}>
            {updatePhase === "installing"
              ? "TrackFlow will close and restart automatically."
              : "Your boards and layouts are being backed up automatically."}
          </div>
        </div>
      );
    }

    if (updatePhase === "available") {
      return (
        <div style={{ padding: 16, background: s.surface2, borderRadius: s.r, border: `1px solid ${s.accent}30` }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: s.accent }}>v{updateObj?.version} available</div>
              {updateObj?.date && (
                <div style={{ fontSize: 10, color: s.text3, fontFamily: "monospace", marginTop: 2 }}>
                  {new Date(updateObj.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </div>
              )}
            </div>
            <button onClick={() => setUpdatePhase("idle")} style={{ background: "transparent", border: "none", color: s.text3, cursor: "pointer", padding: 2 }}>
              <Icon d={Icons.close} size={11} />
            </button>
          </div>
          {updateObj?.body && (
            <div style={{ fontSize: 11, color: s.text2, lineHeight: 1.7, marginBottom: 12, maxHeight: 80, overflowY: "auto", background: s.surface3, borderRadius: s.r - 2, padding: "8px 10px", whiteSpace: "pre-wrap" }}>
              {updateObj.body}
            </div>
          )}
          <div style={{ fontSize: 10, color: s.text3, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <Icon d={Icons.backup} size={11} style={{ flexShrink: 0 }} />
            Your boards and layouts will be backed up automatically before installing.
          </div>
          <button onClick={startInstall} style={{ width: "100%", padding: "9px 0", background: s.accent, border: "none", borderRadius: s.r, color: s.accentText, fontFamily: "Syne", fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Icon d={Icons.drop} size={13} />
            Download & Install
          </button>
        </div>
      );
    }

    if (updatePhase === "error") {
      const isNoRelease = updateError?.toLowerCase().includes("release") || updateError?.toLowerCase().includes("fetch") || updateError?.toLowerCase().includes("json") || updateError?.toLowerCase().includes("404");
      return (
        <div style={{ padding: 16, background: s.surface2, borderRadius: s.r, border: `1px solid #ff505040` }}>
          <div style={{ fontSize: 12, color: "#ff5050", marginBottom: 6, fontWeight: 600 }}>Could not check for updates</div>
          {isNoRelease ? (
            <div style={{ fontSize: 11, color: s.text3, lineHeight: 1.6, marginBottom: 12 }}>
              No release found on GitHub yet. After running <span style={{ fontFamily: "monospace", background: s.surface3, padding: "1px 5px", borderRadius: 4 }}>tauri build</span>, upload the generated <span style={{ fontFamily: "monospace", background: s.surface3, padding: "1px 5px", borderRadius: 4 }}>latest.json</span> and the <span style={{ fontFamily: "monospace", background: s.surface3, padding: "1px 5px", borderRadius: 4 }}>.nsis.zip</span> to your GitHub release.
            </div>
          ) : (
            <div style={{ fontSize: 11, color: s.text3, fontFamily: "monospace", marginBottom: 12, wordBreak: "break-all" }}>{updateError}</div>
          )}
          <button onClick={checkUpdate} style={{ padding: "6px 14px", background: s.surface3, border: `1px solid ${s.border2}`, borderRadius: s.r, color: s.text, fontFamily: "Syne", fontSize: 12, cursor: "pointer" }}>
            Try Again
          </button>
        </div>
      );
    }

    return (
      <div style={{ padding: 16, background: s.surface2, borderRadius: s.r, border: `1px solid ${s.border}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: s.text }}>Updates</div>
          {appVersion && (
            <span style={{ fontSize: 10, fontFamily: "monospace", color: s.text3, background: s.surface3, padding: "2px 7px", borderRadius: 6 }}>
              v{appVersion}
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: s.text3, marginBottom: 12, lineHeight: 1.6 }}>
          {updatePhase === "up_to_date"
            ? "You're on the latest version. Your boards and layouts are safe across all updates."
            : "Your boards, layouts, and tags are automatically preserved across updates."}
        </div>
        {updatePhase === "up_to_date" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#3af0b0", flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: "#3af0b0", fontWeight: 600 }}>Up to date</span>
            <button onClick={() => setUpdatePhase("idle")} style={{ marginLeft: "auto", padding: "5px 12px", background: "transparent", border: `1px solid ${s.border}`, borderRadius: s.r, color: s.text3, fontFamily: "Syne", fontSize: 11, cursor: "pointer" }}>
              Check Again
            </button>
          </div>
        ) : (
          <button onClick={checkUpdate} disabled={updatePhase === "checking"} style={{ padding: "7px 16px", background: s.surface3, border: `1px solid ${s.border2}`, borderRadius: s.r, color: s.text, fontFamily: "Syne", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, opacity: updatePhase === "checking" ? 0.7 : 1 }}>
            <Icon d={Icons.update} size={13} style={{ animation: updatePhase === "checking" ? "spin 1s linear infinite" : "none" }} />
            {updatePhase === "checking" ? "Checking..." : "Check for Updates"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={onClose}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
      <div onClick={e => e.stopPropagation()} style={{ background: s.surface, border: `1px solid ${s.border2}`, borderRadius: s.r2, padding: 28, width: 480, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 20, color: s.text }}>Settings</div>

        {/* Column height */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: s.text, marginBottom: 4 }}>Column Height</div>
          <div style={{ fontSize: 11, color: s.text3, marginBottom: 10 }}>Sets a fixed height for all columns so grid rows stay aligned.</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input type="range" min={200} max={900} step={20} value={maxH} onChange={e => setMaxH(Number(e.target.value))} style={{ flex: 1 }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: s.accent, fontFamily: "monospace", minWidth: 50 }}>{maxH}px</span>
          </div>
        </div>

        {/* Update section */}
        <div style={{ marginBottom: 24 }}>
          <UpdateSection />
        </div>

        {/* Discord webhook */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: s.text, marginBottom: 4 }}>Discord Error Webhook</div>
          <div style={{ fontSize: 11, color: s.text3, marginBottom: 10, lineHeight: 1.6 }}>
            When TrackFlow hits an error, a "Send Error Report" button appears. Paste your Discord webhook and it'll DM you the details.<br />
            <span style={{ color: s.accent }}>Server → Channel → Integrations → Webhooks → New Webhook → Copy URL</span>
          </div>
          <input value={webhook} onChange={e => setWebhook(e.target.value)} placeholder="https://discord.com/api/webhooks/..."
            style={{ width: "100%", background: s.surface2, border: `1px solid ${s.border}`, borderRadius: s.r, padding: "9px 12px", color: s.text, fontFamily: "monospace", fontSize: 11, outline: "none", marginBottom: 8 }} />
          <button onClick={testWebhook} disabled={!webhook || testing}
            style={{ padding: "6px 14px", background: testResult === "success" ? "#3af0b0" : testResult === "fail" ? "#ff5050" : s.surface3, border: `1px solid ${s.border}`, borderRadius: s.r, color: testResult ? "#0a0a0b" : s.text2, fontFamily: "Syne", fontSize: 12, cursor: "pointer" }}>
            {testing ? "Sending..." : testResult === "success" ? "✓ Test sent!" : testResult === "fail" ? "✗ Failed" : "Send Test Message"}
          </button>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => onSave(webhook, maxH)} style={{ flex: 1, padding: 11, background: s.accent, border: "none", borderRadius: s.r, color: s.accentText, fontFamily: "Syne", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>Save</button>
          <button onClick={onClose} style={{ padding: "11px 20px", background: s.surface2, border: `1px solid ${s.border}`, borderRadius: s.r, color: s.text2, fontFamily: "Syne", fontSize: 13, cursor: "pointer" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
