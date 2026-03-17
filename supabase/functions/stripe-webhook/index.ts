// Deploy: supabase functions deploy stripe-webhook
// Env vars required: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// In Stripe Dashboard → Webhooks, add endpoint:
//   https://<your-project>.supabase.co/functions/v1/stripe-webhook
// Events to listen to:
//   checkout.session.completed
//   customer.subscription.updated
//   customer.subscription.deleted

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Maps Stripe price IDs to TrackFlow tier names.
// Set these in your Supabase Edge Function secrets to match your Stripe prices.
function tierFromPriceId(priceId: string): string {
  const proId = Deno.env.get("STRIPE_PRO_PRICE_ID");
  const teamId = Deno.env.get("STRIPE_TEAM_PRICE_ID");
  if (priceId === teamId) return "team";
  if (priceId === proId) return "pro";
  return "free";
}

async function setTier(customerId: string, tier: string) {
  await supabase
    .from("profiles")
    .update({ tier })
    .eq("stripe_customer_id", customerId);
}

Deno.serve(async (req) => {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      sig,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!
    );
  } catch (err) {
    return new Response(`Webhook signature invalid: ${err.message}`, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") break;
      // Retrieve the subscription to get the price ID
      const sub = await stripe.subscriptions.retrieve(session.subscription as string);
      const priceId = sub.items.data[0]?.price?.id ?? "";
      await setTier(session.customer as string, tierFromPriceId(priceId));
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const priceId = sub.items.data[0]?.price?.id ?? "";
      const tier = sub.status === "active" || sub.status === "trialing"
        ? tierFromPriceId(priceId)
        : "free";
      await setTier(sub.customer as string, tier);
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await setTier(sub.customer as string, "free");
      break;
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
