import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export function useTier(userId) {
  const [tier, setTier] = useState("free");
  const [displayName, setDisplayName] = useState("");
  const [avatarColor, setAvatarColor] = useState("lime");
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [createdAt, setCreatedAt] = useState(null);
  const [invitesDisabled, setInvitesDisabled] = useState(false);

  useEffect(() => {
    if (!userId || !supabase) return;

    function applyProfile(row) {
      if (row?.tier) setTier(row.tier);
      if (row?.display_name) setDisplayName(row.display_name);
      setAvatarColor(row?.avatar_color ?? "lime");
      setAvatarUrl(row?.avatar_url ?? null);
      setCreatedAt(row?.created_at ?? null);
      setInvitesDisabled(row?.invites_disabled ?? false);
    }

    supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single()
      .then(({ data, error }) => {
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

  async function updateAvatarUrl(url) {
    if (!userId || !supabase) return;
    setAvatarUrl(url);
    await supabase.from("profiles").update({ avatar_url: url }).eq("id", userId);
  }

  async function updateInvitesDisabled(val) {
    if (!userId || !supabase) return;
    setInvitesDisabled(val);
    await supabase.from("profiles").update({ invites_disabled: val }).eq("id", userId);
  }

  return {
    tier,
    displayName,
    avatarColor,
    avatarUrl,
    createdAt,
    invitesDisabled,
    updateDisplayName,
    updateAvatarColor,
    updateAvatarUrl,
    updateInvitesDisabled,
    isFree: tier === "free",
    isPremium: tier === "premium",
    isPaid: tier === "premium" || tier === "ongoing",
  };
}
