import { supabase } from "./supabase";

// Open a URL in the system browser — works in Tauri and plain browser
async function openExternal(url) {
  try {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } catch {
    window.open(url, "_blank");
  }
}

export const PRICES = {
  pro_monthly: import.meta.env.VITE_STRIPE_PRO_PRICE_ID,
  team_monthly: import.meta.env.VITE_STRIPE_TEAM_PRICE_ID,
};

async function getUserId() {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

/**
 * Creates a Stripe Checkout session and opens it in the system browser.
 * The app's useTier hook will auto-update when payment completes.
 */
export async function startCheckout(priceKey) {
  if (!PRICES[priceKey]) return { error: "Stripe price ID not configured. Add VITE_STRIPE_PRO_PRICE_ID / VITE_STRIPE_TEAM_PRICE_ID to .env" };

  const userId = await getUserId();
  if (!userId) return { error: "Not signed in" };

  const { data, error } = await supabase.functions.invoke("create-checkout-session", {
    body: { priceId: PRICES[priceKey], userId },
  });

  if (error || !data?.url) return { error: error?.message ?? "Failed to create checkout session" };

  await openExternal(data.url);
  return { error: null };
}

/**
 * Opens the Stripe Customer Portal in the system browser so the user
 * can update payment info, upgrade, downgrade, or cancel.
 */
export async function openCustomerPortal() {
  const userId = await getUserId();
  if (!userId) return { error: "Not signed in" };

  const { data, error } = await supabase.functions.invoke("create-portal-session", {
    body: { userId },
  });

  if (error || !data?.url) return { error: error?.message ?? "Failed to open billing portal" };

  await openExternal(data.url);
  return { error: null };
}
