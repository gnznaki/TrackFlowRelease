import { Component } from "react";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error("TrackFlow error:", error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0a0a0b", color: "#f0f0f0", fontFamily: "Syne, sans-serif", padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>⚠</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Something went wrong</div>
          <div style={{ fontSize: 13, color: "#888", marginBottom: 24, maxWidth: 400, lineHeight: 1.6 }}>
            TrackFlow hit an unexpected error. Your data is safe — click below to reload.
          </div>
          <div style={{ fontFamily: "monospace", fontSize: 11, color: "#555", background: "#111", padding: "10px 16px", borderRadius: 8, marginBottom: 24, maxWidth: 500, wordBreak: "break-all" }}>
            {this.state.error?.message || "Unknown error"}
          </div>
          <button onClick={() => window.location.reload()} style={{ padding: "10px 24px", background: "#c8ff47", border: "none", borderRadius: 10, color: "#0a0a0b", fontFamily: "Syne, sans-serif", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
            Reload TrackFlow
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
