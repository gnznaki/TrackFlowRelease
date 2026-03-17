import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export function useTier(userId) {
  const [tier, setTier] = useState("free");
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (!userId || !supabase) return;

    supabase
      .from("profiles")
      .select("tier, display_name")
      .eq("id", userId)
      .single()
      .then(({ data }) => {
        if (data?.tier) setTier(data.tier);
        if (data?.display_name) setDisplayName(data.display_name);
      });

    const channel = supabase
      .channel(`tier-${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        (payload) => {
          if (payload.new?.tier) setTier(payload.new.tier);
          if (payload.new?.display_name !== undefined) setDisplayName(payload.new.display_name ?? "");
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [userId]);

  async function updateDisplayName(name) {
    if (!userId || !supabase) return;
    const trimmed = name.trim();
    setDisplayName(trimmed);
    await supabase.from("profiles").update({ display_name: trimmed }).eq("id", userId);
  }

  return {
    tier,
    displayName,
    updateDisplayName,
    isFree: tier === "free",
    isPro: tier === "pro" || tier === "team",
    isTeam: tier === "team",
  };
}
