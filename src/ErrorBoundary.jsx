import { Component } from "react";
import { postToDiscord, getWebhookUrl } from "./lib/discord";

export class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null, sending: false, sent: false }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error("TrackFlow crash:", error, info); }
  async sendError() {
    const webhookUrl = getWebhookUrl();
    if (!webhookUrl) { alert("No Discord webhook. Add one in Settings (⚙)."); return; }
    this.setState({ sending: true });
    const ok = await postToDiscord(webhookUrl, "🔴 TrackFlow Crash", `**Error:** ${this.state.error?.message}\n\`\`\`${(this.state.error?.stack || "").substring(0, 1500)}\`\`\``);
    this.setState({ sending: false, sent: ok });
    if (!ok) alert("Send failed. Check your webhook URL in Settings.");
  }
  render() {
    if (this.state.hasError) return (
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0a0a0b", color: "#f0f0f0", fontFamily: "Syne, sans-serif", padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>⚠</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Something went wrong</div>
        <div style={{ fontSize: 13, color: "#888", marginBottom: 24, maxWidth: 400, lineHeight: 1.6 }}>Your data is safe. Reload to continue or send the error so it can be fixed.</div>
        <div style={{ fontFamily: "monospace", fontSize: 11, color: "#555", background: "#111", padding: "10px 16px", borderRadius: 8, marginBottom: 24, maxWidth: 500, wordBreak: "break-all" }}>{this.state.error?.message || "Unknown"}</div>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={() => window.location.reload()} style={{ padding: "10px 24px", background: "#c8ff47", border: "none", borderRadius: 10, color: "#0a0a0b", fontFamily: "Syne, sans-serif", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>Reload</button>
          <button onClick={() => this.sendError()} disabled={this.state.sending || this.state.sent} style={{ padding: "10px 24px", background: this.state.sent ? "#3af0b0" : "#18181d", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, color: this.state.sent ? "#0a0a0b" : "#f0f0f0", fontFamily: "Syne, sans-serif", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
            {this.state.sending ? "Sending..." : this.state.sent ? "✓ Sent" : "Send Error Report"}
          </button>
        </div>
      </div>
    );
    return this.props.children;
  }
}
