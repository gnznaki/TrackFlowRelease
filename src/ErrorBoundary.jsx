import { Component } from "react";
import { reportError } from "./lib/errorReporting";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, sending: false, sent: false, autoSent: false };
    this._componentStack = "";
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    this._componentStack = info?.componentStack || "";
    console.error("TrackFlow crash:", error, info);
    this._autoSend(error, this._componentStack);
  }

  async _autoSend(error, componentStack) {
    const ok = await reportError({
      type: "crash",
      message: error?.message,
      stack: error?.stack,
      context: { componentStack: (componentStack || "").substring(0, 800) },
    });
    if (ok) this.setState({ autoSent: true });
  }

  async sendError() {
    this.setState({ sending: true });
    const ok = await reportError({
      type: "manual",
      message: this.state.error?.message,
      stack: this.state.error?.stack,
      context: { componentStack: (this._componentStack || "").substring(0, 800) },
    });
    this.setState({ sending: false, sent: ok });
    if (!ok) alert("Send failed.");
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    const { sending, sent, autoSent } = this.state;
    const alreadySent = sent || autoSent;
    return (
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0a0a0b", color: "#f0f0f0", fontFamily: "Syne, sans-serif", padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>⚠</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Something went wrong</div>
        <div style={{ fontSize: 13, color: "#888", marginBottom: 8, maxWidth: 400, lineHeight: 1.6 }}>
          Your data is safe. Reload to continue.
        </div>
        {autoSent && (
          <div style={{ fontSize: 12, color: "#3af0b0", marginBottom: 16 }}>✓ Error automatically reported</div>
        )}
        <div style={{ fontFamily: "monospace", fontSize: 11, color: "#555", background: "#111", padding: "10px 16px", borderRadius: 8, marginBottom: 24, maxWidth: 520, wordBreak: "break-all", textAlign: "left" }}>
          {this.state.error?.message || "Unknown error"}
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: "10px 24px", background: "#c8ff47", border: "none", borderRadius: 10, color: "#0a0a0b", fontFamily: "Syne, sans-serif", fontSize: 14, fontWeight: 800, cursor: "pointer" }}
          >
            Reload
          </button>
          {!alreadySent && (
            <button
              onClick={() => this.sendError()}
              disabled={sending}
              style={{ padding: "10px 24px", background: "#18181d", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, color: "#f0f0f0", fontFamily: "Syne, sans-serif", fontSize: 14, fontWeight: 800, cursor: "pointer", opacity: sending ? 0.7 : 1 }}
            >
              {sending ? "Sending..." : "Send Error Report"}
            </button>
          )}
        </div>
      </div>
    );
  }
}
