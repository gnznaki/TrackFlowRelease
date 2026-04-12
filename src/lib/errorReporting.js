import { supabase } from "./supabase";
import { postToDiscord } from "./discord";

/* Injected at build time from package.json via vite.config.js */
const APP_VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "unknown";

const TYPE_TITLES = {
  crash:   "🔴 TrackFlow Crash",
  runtime: "🟡 TrackFlow Runtime Error",
  manual:  "🔴 TrackFlow Crash (Manual Report)",
};

const TYPE_COLORS = {
  crash:   0xff2222,
  runtime: 0xffaa00,
  manual:  0xff2222,
};

/**
 * Report an error to Supabase error_logs + Discord.
 * Safe to call from anywhere — all failures are swallowed so reporting
 * never causes additional errors.
 *
 * @param {"crash"|"runtime"|"manual"} type
 * @param {string} message
 * @param {string} [stack]
 * @param {object} [context]  Any extra structured data (component tree, action, etc.)
 */
export async function reportError({ type, message, stack, context = {} }) {
  let userId = null;
  let userEmail = null;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    userId    = session?.user?.id    ?? null;
    userEmail = session?.user?.email ?? null;
  } catch { /* supabase not configured or no session */ }

  // ── Write to Supabase ────────────────────────────────────────────────────
  try {
    if (supabase) {
      await supabase.from("error_logs").insert({
        user_id:     userId,
        user_email:  userEmail,
        error_type:  type,
        message:     message?.substring(0, 1000),
        stack:       stack?.substring(0, 3000),
        app_version: APP_VERSION,
        context,
      });
    }
  } catch { /* never let reporting break the app */ }

  // ── Ping Discord ─────────────────────────────────────────────────────────
  try {
    const lines = [
      `**Version:** ${APP_VERSION}`,
      userEmail ? `**User:** ${userEmail}` : userId ? `**User:** ${userId}` : "**User:** Not signed in",
      `**Error:** ${message || "Unknown"}`,
      `\`\`\`\n${(stack || "No stack").substring(0, 1200)}\n\`\`\``,
      `**Time:** ${new Date().toLocaleString()}`,
    ];
    if (context && Object.keys(context).length) {
      lines.push(`**Context:** \`\`\`json\n${JSON.stringify(context, null, 2).substring(0, 400)}\n\`\`\``);
    }
    return postToDiscord(TYPE_TITLES[type] ?? TYPE_TITLES.runtime, lines.join("\n"), TYPE_COLORS[type] ?? 0xff2222);
  } catch {
    return false;
  }
}
