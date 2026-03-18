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

// premium_once  = $15 one-time payment
// ongoing_monthly = $20/month subscription
export const PRICES = {
  premium_once: import.meta.env.VITE_STRIPE_PREMIUM_PRICE_ID,
  ongoing_monthly: import.meta.env.VITE_STRIPE_ONGOING_PRICE_ID,
};

export const PLAN_DISPLAY = {
  free:    { name: "Free",     price: "$0",  sub: "forever",   color: null },
  premium: { name: "Premium",  price: "$15", sub: "one-time",  color: "#c8ff47" },
  ongoing: { name: "Cloud",    price: "$20", sub: "/ month",   color: "#47c8ff" },
};

async function getUserId() {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

async function getSession() {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/**
 * Creates a Stripe PaymentIntent (one-time) or SetupIntent (subscription)
 * without redirecting to hosted checkout — returns client_secret for
 * the homemade checkout UI to confirm with Stripe.js.
 */
export async function createPaymentIntent(priceKey) {
  if (!PRICES[priceKey]) return { error: "Stripe price ID not configured." };
  const session = await getSession();
  if (!session?.user?.id) return { error: "Not signed in" };
  const userId = session.user.id;
  const { data, error } = await supabase.functions.invoke("create-payment-intent", {
    body: { priceKey, priceId: PRICES[priceKey], userId },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (error) {
    // Try to extract the real error message from the function's JSON response body
    try {
      const body = await error.context?.json?.();
      if (body?.error) return { error: body.error };
    } catch {}
    return { error: error.message ?? "Failed to create payment intent" };
  }
  if (!data) return { error: "Empty response from payment service" };
  return data; // { clientSecret, customerId, type: "payment"|"subscription" }
}

/**
 * Legacy: opens hosted Stripe Checkout in system browser (kept as fallback).
 */
export async function startCheckout(priceKey) {
  if (!PRICES[priceKey]) return { error: "Stripe price ID not configured." };
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
 * Deletes the currently signed-in user's account via an Edge Function.
 */
export async function deleteAccount() {
  const session = await getSession();
  if (!session?.user?.id) return { error: "Not signed in" };
  const { error } = await supabase.functions.invoke("delete-account", {
    body: {},
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  return { error: error?.message ?? null };
}

/**
 * Opens the Stripe Customer Portal in the system browser.
 */
export async function openCustomerPortal() {
  const session = await getSession();
  if (!session?.user?.id) return { error: "Not signed in" };
  const { data, error } = await supabase.functions.invoke("create-portal-session", {
    body: { userId: session.user.id },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (error || !data?.url) return { error: error?.message ?? "Failed to open billing portal" };
  await openExternal(data.url);
  return { error: null };
}
