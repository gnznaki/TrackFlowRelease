// ── Baked error-reporting webhook ─────────────────────────────────────────────
// Split across array segments to avoid the full URL appearing as a single string in the binary.
const _W = ["https://discord.com/api/", "webhooks/", "1484701592782377112/YG2spNyQonkxDIt1HWDyZsfG7_svSzI4D69wO6nOdwFDeJLVyX5nfB2RR0G_G-1gRu-k"];
const BAKED = _W.join("");

export async function postToDiscord(title, message, color = 0xff4444) {
  try {
    const res = await fetch(BAKED, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [{
          title,
          color,
          description: message.substring(0, 2000),
          footer: { text: `TrackFlow v1.2.0 · ${new Date().toLocaleString()}` },
        }],
      }),
    });
    return res.ok || res.status === 204;
  } catch { return false; }
}
