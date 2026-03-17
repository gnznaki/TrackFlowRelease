let _webhookUrl = "";
export function setWebhookUrl(url) { _webhookUrl = url; }
export function getWebhookUrl() { return _webhookUrl; }
export async function postToDiscord(url, title, message, color = 0xff4444) {
  if (!url) return false;
  try {
    await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ embeds: [{ title, color, description: message.substring(0, 2000), footer: { text: `TrackFlow v1.2.0 · ${new Date().toLocaleString()}` } }] }) });
    return true;
  } catch (e) { return false; }
}
