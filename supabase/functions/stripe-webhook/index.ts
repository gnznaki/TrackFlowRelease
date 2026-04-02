// Deploy: supabase functions deploy stripe-webhook
// Env vars required: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// In Stripe Dashboard → Webhooks, add endpoint:
//   https://<your-project>.supabase.co/functions/v1/stripe-webhook
// Events to listen to:
//   checkout.session.completed
//   payment_intent.succeeded         ← for one-time Premium payment
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

// Maps Stripe price IDs → TrackFlow tier names.
// Set STRIPE_PREMIUM_PRICE_ID and STRIPE_ONGOING_PRICE_ID in Supabase secrets.
function tierFromPriceId(priceId: string): string {
  const premiumId = Deno.env.get("STRIPE_PREMIUM_PRICE_ID");
  const ongoingId = Deno.env.get("STRIPE_ONGOING_PRICE_ID");
  if (priceId === ongoingId) return "ongoing";
  if (priceId === premiumId) return "premium";
  return "free";
}

async function setTierByCustomer(customerId: string, tier: string) {
  await supabase.from("profiles").update({ tier }).eq("stripe_customer_id", customerId);
}

async function setTierByUserId(userId: string, tier: string) {
  await supabase.from("profiles").update({ tier }).eq("id", userId);
}

Deno.serve(async (req) => {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body, sig, Deno.env.get("STRIPE_WEBHOOK_SECRET")!
    );
  } catch (err) {
    return new Response(`Webhook signature invalid: ${err.message}`, { status: 400 });
  }

  switch (event.type) {
    // One-time Premium payment confirmed
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const userId = pi.metadata?.supabase_user_id;
      // Prefer the tier baked directly into metadata — no price ID mapping needed
      const tier = pi.metadata?.tier ?? tierFromPriceId(pi.metadata?.price_id ?? "");
      if (userId) {
        await setTierByUserId(userId, tier);
      } else if (pi.customer) {
        await setTierByCustomer(pi.customer as string, tier);
      }
      break;
    }

    // Subscription checkout completed (On-Going)
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription") {
        const sub = await stripe.subscriptions.retrieve(session.subscription as string);
        const priceId = sub.items.data[0]?.price?.id ?? "";
        await setTierByCustomer(session.customer as string, tierFromPriceId(priceId));
      } else if (session.mode === "payment") {
        // one-time payment via hosted checkout fallback
        const pi = await stripe.paymentIntents.retrieve(session.payment_intent as string);
        const priceId = pi.metadata?.price_id ?? "";
        const userId = pi.metadata?.supabase_user_id ?? session.metadata?.supabase_user_id ?? "";
        if (userId) await setTierByUserId(userId, tierFromPriceId(priceId));
        else await setTierByCustomer(session.customer as string, tierFromPriceId(priceId));
      }
      break;
    }

    // Subscription renewed / changed
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const priceId = sub.items.data[0]?.price?.id ?? "";
      const tier = (sub.status === "active" || sub.status === "trialing")
        ? tierFromPriceId(priceId)
        : "free";
      await setTierByCustomer(sub.customer as string, tier);
      break;
    }

    // Subscription cancelled / expired
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await setTierByCustomer(sub.customer as string, "free");
      break;
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
