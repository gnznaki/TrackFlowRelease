import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export function useTier(userId) {
  const [tier, setTier] = useState("free");
  const [displayName, setDisplayName] = useState("");
  const [avatarColor, setAvatarColor] = useState("lime");
  const [createdAt, setCreatedAt] = useState(null);

  useEffect(() => {
    if (!userId || !supabase) return;

    supabase
      .from("profiles")
      .select("tier, display_name, avatar_color, created_at")
      .eq("id", userId)
      .single()
      .then(({ data }) => {
        if (data?.tier) setTier(data.tier);
        if (data?.display_name) setDisplayName(data.display_name);
        setAvatarColor(data?.avatar_color ?? "lime");
        setCreatedAt(data?.created_at ?? null);
      });

    const channel = supabase
      .channel(`tier-${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        (payload) => {
          if (payload.new?.tier) setTier(payload.new.tier);
          if (payload.new?.display_name !== undefined) setDisplayName(payload.new.display_name ?? "");
          if (payload.new?.avatar_color !== undefined) setAvatarColor(payload.new.avatar_color ?? "lime");
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

  async function updateAvatarColor(colorKey) {
    if (!userId || !supabase) return;
    setAvatarColor(colorKey);
    await supabase.from("profiles").update({ avatar_color: colorKey }).eq("id", userId);
  }

  return {
    tier,
    displayName,
    avatarColor,
    createdAt,
    updateDisplayName,
    updateAvatarColor,
    isFree: tier === "free",
    isPremium: tier === "premium",
    isOngoing: tier === "ongoing",
    isPaid: tier === "premium" || tier === "ongoing",
  };
}
