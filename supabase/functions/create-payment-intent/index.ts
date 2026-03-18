// Deploy: supabase functions deploy create-payment-intent
// Env vars required: STRIPE_SECRET_KEY, STRIPE_PREMIUM_PRICE_ID, STRIPE_ONGOING_PRICE_ID,
//                   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Get or create a Stripe customer for this user
async function getOrCreateCustomer(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, email")
    .eq("id", userId)
    .single();

  if (profile?.stripe_customer_id) return profile.stripe_customer_id;

  const customer = await stripe.customers.create({
    email: profile?.email ?? undefined,
    metadata: { supabase_user_id: userId },
  });

  await supabase
    .from("profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("id", userId);

  return customer.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Verify the caller is authenticated by checking their JWT with the anon client
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { priceKey, priceId, userId } = await req.json();
    // Ensure the userId in the body matches the authenticated user
    if (userId !== user.id) throw new Error("User ID mismatch");
    if (!priceId || !userId || !priceKey) throw new Error("Missing required fields");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const customerId = await getOrCreateCustomer(supabase, userId);

    if (priceKey === "premium_once") {
      // One-time $15 payment — create a PaymentIntent
      const pi = await stripe.paymentIntents.create({
        amount: 1500, // $15.00 in cents
        currency: "usd",
        customer: customerId,
        metadata: { supabase_user_id: userId, price_id: priceId },
        automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      });

      return new Response(
        JSON.stringify({ clientSecret: pi.client_secret, customerId, type: "payment" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (priceKey === "ongoing_monthly") {
      // Subscription — create subscription in default_incomplete state so we can
      // confirm the first invoice's PaymentIntent on the frontend
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
        expand: ["latest_invoice.payment_intent"],
        metadata: { supabase_user_id: userId },
      });

      const invoice = subscription.latest_invoice as Stripe.Invoice;
      const pi = invoice.payment_intent as Stripe.PaymentIntent;

      if (!pi?.client_secret) throw new Error("Failed to get subscription payment intent");

      return new Response(
        JSON.stringify({
          clientSecret: pi.client_secret,
          subscriptionId: subscription.id,
          customerId,
          type: "subscription",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Unknown priceKey: ${priceKey}`);
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
