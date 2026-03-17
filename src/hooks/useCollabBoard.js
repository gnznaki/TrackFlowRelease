import { useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";

/**
 * Handles real-time collaboration for a single board (producer or engineer mode).
 *
 * - When `isShared` is true: debounced-publishes local changes to `shared_boards`,
 *   and subscribes to Realtime updates from other members.
 * - Returns `shareBoard`, `joinBoard`, `leaveBoard`, and `fetchMembers` actions.
 */
export function useCollabBoard({ boardId, isShared, columns, layout, mode, onRemoteUpdate }) {
  // Tracks the timestamp of our last publish so we can ignore our own Realtime echo
  const suppressUntilRef = useRef(0);

  // ── PUBLISH ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isShared || !boardId || !supabase) return;

    const timer = setTimeout(async () => {
      if (Date.now() < suppressUntilRef.current) return; // don't re-publish remote data

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      suppressUntilRef.current = Date.now() + 3000; // suppress echo for 3s after our write

      const { error } = await supabase
        .from("shared_boards")
        .update({ columns, layout })
        .eq("id", boardId);

      if (error) console.warn("[collab] publish failed:", error.message);
    }, 800);

    return () => clearTimeout(timer);
  }, [boardId, isShared, columns, layout]);

  // ── SUBSCRIBE ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isShared || !boardId || !supabase) return;

    const channel = supabase
      .channel(`board-${boardId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "shared_boards", filter: `id=eq.${boardId}` },
        (payload) => {
          if (Date.now() < suppressUntilRef.current) return; // our own echo
          suppressUntilRef.current = Date.now() + 3000; // suppress re-publish of incoming data
          onRemoteUpdate(payload.new.columns, payload.new.layout);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [boardId, isShared, onRemoteUpdate]);

  // ── ACTIONS ──────────────────────────────────────────────────────────────────

  const shareBoard = useCallback(async (name) => {
    if (!boardId || !supabase) return { error: "Supabase not configured" };

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { error: "Not signed in" };

    // Create the shared board record (idempotent)
    const { error: boardErr } = await supabase
      .from("shared_boards")
      .insert({ id: boardId, owner_id: session.user.id, name, mode, columns, layout });

    if (boardErr && boardErr.code !== "23505") return { error: boardErr.message }; // 23505 = already exists

    // Add self as owner in board_members
    const { error: memberErr } = await supabase
      .from("board_members")
      .upsert({ board_id: boardId, user_id: session.user.id, role: "owner" });

    if (memberErr) return { error: memberErr.message };
    return { error: null };
  }, [boardId, mode, columns, layout]);

  const joinBoard = useCallback(async (code) => {
    if (!supabase) return { error: "Supabase not configured" };

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { error: "Not signed in" };

    const { data: board, error: fetchErr } = await supabase
      .from("shared_boards")
      .select("id, name, columns, layout, mode")
      .eq("id", code.trim())
      .single();

    if (fetchErr || !board) return { error: "Board not found. Double-check the code." };

    const { error: memberErr } = await supabase
      .from("board_members")
      .upsert({ board_id: code.trim(), user_id: session.user.id, role: "editor" });

    if (memberErr) return { error: memberErr.message };
    return { error: null, board };
  }, []);

  const leaveBoard = useCallback(async (code) => {
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase
      .from("board_members")
      .delete()
      .eq("board_id", code)
      .eq("user_id", session.user.id);
  }, []);

  const fetchMembers = useCallback(async () => {
    if (!boardId || !supabase) return [];

    const { data: members, error } = await supabase
      .from("board_members")
      .select("user_id, role, created_at")
      .eq("board_id", boardId);

    if (error || !members?.length) return [];

    // Fetch display info from profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, display_name")
      .in("id", members.map(m => m.user_id));

    const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));
    return members.map(m => ({ ...m, profile: profileMap[m.user_id] || null }));
  }, [boardId]);

  return { shareBoard, joinBoard, leaveBoard, fetchMembers };
}
