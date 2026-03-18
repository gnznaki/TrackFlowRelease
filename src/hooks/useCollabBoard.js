import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";

/**
 * Handles real-time collaboration for a single board.
 *
 * Sync strategy:
 *  - Broadcast channel (`board-{boardId}`): low-latency peer-to-peer sync.
 *    Local changes are broadcast immediately; { self: false } prevents echo.
 *  - Debounced DB write to `shared_boards`: persistence only, not used for sync.
 *
 * Returns: shareBoard, joinBoard, leaveBoard, deleteBoard, fetchMembers, members, myRole
 */
export function useCollabBoard({ boardId, isShared, columns, layout, mode, onRemoteUpdate }) {
  const channelRef = useRef(null);
  const membersChannelRef = useRef(null);
  const isInitialMount = useRef(true);

  const [members, setMembers] = useState([]);
  const [myRole, setMyRole] = useState(null);

  // ── FETCH MEMBERS ────────────────────────────────────────────────────────────
  const fetchMembers = useCallback(async () => {
    if (!boardId || !supabase) return [];

    const { data: rows, error } = await supabase
      .from("board_members")
      .select("user_id, role, created_at")
      .eq("board_id", boardId);

    if (error || !rows?.length) return [];

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, display_name, avatar_color")
      .in("id", rows.map(m => m.user_id));

    const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));
    return rows.map(m => ({ ...m, profile: profileMap[m.user_id] || null }));
  }, [boardId]);

  // Auto-fetch members and my role when board becomes shared
  useEffect(() => {
    if (!isShared || !boardId || !supabase) { setMembers([]); setMyRole(null); return; }

    fetchMembers().then(list => {
      setMembers(list);
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) return;
        const me = list.find(m => m.user_id === session.user.id);
        setMyRole(me?.role ?? "editor");
      });
    });
  }, [isShared, boardId, fetchMembers]);

  // ── BROADCAST CHANNEL (receive) ──────────────────────────────────────────────
  useEffect(() => {
    if (!isShared || !boardId || !supabase) return;

    const channel = supabase
      .channel(`board-${boardId}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "page_update" }, ({ payload }) => {
        onRemoteUpdate(payload.columns, payload.layout);
      })
      .subscribe();

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); channelRef.current = null; };
  }, [boardId, isShared, onRemoteUpdate]);

  // ── BOARD_MEMBERS LIVE UPDATES ───────────────────────────────────────────────
  useEffect(() => {
    if (!isShared || !boardId || !supabase) return;

    const ch = supabase
      .channel(`members-${boardId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "board_members", filter: `board_id=eq.${boardId}` },
        () => fetchMembers().then(setMembers)
      )
      .subscribe();

    membersChannelRef.current = ch;
    return () => { supabase.removeChannel(ch); membersChannelRef.current = null; };
  }, [boardId, isShared, fetchMembers]);

  // ── BROADCAST LOCAL CHANGES + PERSIST ────────────────────────────────────────
  useEffect(() => {
    // Skip the very first render — don't broadcast stale initial state
    if (isInitialMount.current) { isInitialMount.current = false; return; }
    if (!isShared || !boardId || !supabase) return;
    if (myRole === "viewer") return; // viewers cannot push changes

    // Broadcast immediately to peers (no debounce needed — Realtime is cheap)
    channelRef.current?.send({
      type: "broadcast",
      event: "page_update",
      payload: { columns, layout },
    });

    // Debounced DB persist for durability
    const timer = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { error } = await supabase
        .from("shared_boards")
        .update({ columns, layout })
        .eq("id", boardId);
      if (error) console.warn("[collab] persist failed:", error.message);
    }, 800);

    return () => clearTimeout(timer);
  }, [boardId, isShared, columns, layout, myRole]);

  // ── ACTIONS ──────────────────────────────────────────────────────────────────

  const shareBoard = useCallback(async (name) => {
    if (!boardId || !supabase) return { error: "Supabase not configured" };
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { error: "Not signed in" };

    const { error: boardErr } = await supabase
      .from("shared_boards")
      .insert({ id: boardId, owner_id: session.user.id, name, mode, columns, layout });

    if (boardErr && boardErr.code !== "23505") return { error: boardErr.message };

    const { error: memberErr } = await supabase
      .from("board_members")
      .upsert({ board_id: boardId, user_id: session.user.id, role: "owner" });

    if (memberErr) return { error: memberErr.message };
    setMyRole("owner");
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
    setMyRole("editor");
    return { error: null, board };
  }, []);

  const leaveBoard = useCallback(async (bId) => {
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from("board_members").delete().eq("board_id", bId).eq("user_id", session.user.id);
  }, []);

  const deleteBoard = useCallback(async (bId) => {
    if (!supabase) return { error: "Supabase not configured" };
    const { error } = await supabase.from("shared_boards").delete().eq("id", bId);
    return { error: error?.message ?? null };
  }, []);

  return { shareBoard, joinBoard, leaveBoard, deleteBoard, fetchMembers, members, myRole };
}
