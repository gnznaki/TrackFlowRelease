import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export function useTier(userId) {
  const [tier, setTier] = useState("free");
  const [displayName, setDisplayName] = useState("");
  const [avatarColor, setAvatarColor] = useState("lime");
  const [createdAt, setCreatedAt] = useState(null);

  useEffect(() => {
    if (!userId || !supabase) return;

    function applyProfile(row) {
      if (row?.tier) setTier(row.tier);
      if (row?.display_name) setDisplayName(row.display_name);
      setAvatarColor(row?.avatar_color ?? "lime");
      setCreatedAt(row?.created_at ?? null);
    }

    supabase
      .from("profiles")
      .select("tier, display_name, avatar_color, created_at")
      .eq("id", userId)
      .single()
      .then(({ data, error }) => {
        console.log("[useTier] fetch →", { userId, data, error });
        if (data) applyProfile(data);
      });

    const channel = supabase
      .channel(`tier-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        (payload) => { applyProfile(payload.new); }
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
    isPaid: tier === "premium",
  };
}
