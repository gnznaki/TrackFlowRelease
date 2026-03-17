import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

/**
 * Reads the current user's tier from `profiles` and subscribes to
 * Realtime updates so the UI reflects tier changes immediately after
 * the Stripe webhook fires — no restart required.
 */
export function useTier(userId) {
  const [tier, setTier] = useState("free");

  useEffect(() => {
    if (!userId || !supabase) return;

    // Load current tier
    supabase
      .from("profiles")
      .select("tier")
      .eq("id", userId)
      .single()
      .then(({ data }) => { if (data?.tier) setTier(data.tier); });

    // Stay in sync — fires after the stripe-webhook Edge Function updates the row
    const channel = supabase
      .channel(`tier-${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        (payload) => { if (payload.new?.tier) setTier(payload.new.tier); }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [userId]);

  return {
    tier,
    isFree: tier === "free",
    isPro: tier === "pro" || tier === "team",
    isTeam: tier === "team",
  };
}
