import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";

/**
 * Handles real-time collaboration for a single board.
 *
 * Sync strategy:
 *  - Broadcast channel (`board-{boardId}`): low-latency peer-to-peer sync.
 *    Local changes are broadcast immediately; { self: false } prevents echo.
 *  - suppressBroadcastRef: when we apply a remote update we set this flag so
 *    the subsequent React re-render does NOT re-broadcast back — preventing the
 *    ping-pong feedback loop that glitches multi-column boards.
 *  - Debounced DB write to `shared_boards`: persistence only, not used for sync.
 *
 * Role resolution order (highest priority first):
 *  1. shareBoard() / joinBoard() set myRole immediately from the action result.
 *  2. fetchMembers() updates myRole only when the user is found in the list —
 *     never falls back to a default, preventing the owner from being misidentified.
 *  3. postgres_changes on board_members refreshes the list live (role promotions).
 */
// Stable client ID for this session — used to filter echoes as a second safety
// layer on top of Supabase's { self: false } channel option.
const CLIENT_ID = crypto.randomUUID();

export function useCollabBoard({ boardId, isShared, columns, layout, tags, mode, onRemoteUpdate }) {
  const channelRef = useRef(null);
  const isInitialMount = useRef(true);
  const boardLockedRef = useRef(false);
  // Prevents re-broadcasting a state update that came from a remote peer.
  const suppressBroadcastRef = useRef(false);
  // Debounce timer for the live broadcast (keeps drag gestures as one network event).
  const broadcastTimerRef = useRef(null);

  const [members, setMembers] = useState([]);
  const [myRole, setMyRole] = useState(null);
  const [boardLocked, setBoardLocked] = useState(false);
  const [boardDeletedByOwner, setBoardDeletedByOwner] = useState(false);

  useEffect(() => { boardLockedRef.current = boardLocked; }, [boardLocked]);

  // ── FETCH MEMBERS ─────────────────────────────────────────────────────────────
  // Uses a SECURITY DEFINER RPC to bypass the board_members RLS policies entirely —
  // direct table selects caused 42P17 infinite recursion via the self-referential policy.
  const fetchMembers = useCallback(async () => {
    if (!boardId || !supabase) return [];

    const { data, error } = await supabase
      .rpc("get_board_members", { p_board_id: boardId });

    if (error) { console.warn("[collab] get_board_members error:", error.message); return []; }
    if (!data?.length) return [];

    return data.map(m => ({
      user_id: m.user_id,
      role: m.role,
      created_at: m.created_at,
      profile: {
        id: m.user_id,
        email: m.email,
        display_name: m.display_name,
        avatar_color: m.avatar_color,
        avatar_url: m.avatar_url ?? null,
      },
    }));
  }, [boardId]);

  // ── INITIALISE WHEN BOARD BECOMES SHARED ──────────────────────────────────────
  useEffect(() => {
    if (!isShared || !boardId || !supabase) {
      setMembers([]); setMyRole(null); setBoardLocked(false); return;
    }

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Fetch board metadata (owner_id + locked) in one query
      const { data: boardRow } = await supabase
        .from("shared_boards")
        .select("owner_id, locked")
        .eq("id", boardId)
        .single();

      if (boardRow) setBoardLocked(boardRow.locked ?? false);

      // Resolve role: prefer board_members row (most accurate), fall back to
      // owner_id check so the creator is never misidentified on app reload.
      const list = await fetchMembers();
      setMembers(list);

      const me = list.find(m => m.user_id === session.user.id);
      if (me) {
        setMyRole(me.role);
      } else if (boardRow?.owner_id === session.user.id) {
        // We're the owner but our row wasn't found in board_members yet
        setMyRole("owner");
      }
      // Otherwise keep whatever shareBoard/joinBoard already set
    };

    init();
  }, [isShared, boardId, fetchMembers]);

  // ── BROADCAST CHANNEL ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isShared || !boardId || !supabase) return;

    const channel = supabase
      .channel(`board-${boardId}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "page_update" }, ({ payload }) => {
        // Discard our own echoes (belt-and-suspenders on top of { self: false })
        if (payload.clientId === CLIENT_ID) return;
        // Mark as remote so the broadcast effect skips the next render
        suppressBroadcastRef.current = true;
        onRemoteUpdate(payload.columns, payload.layout, payload.tags);
        if (payload.locked !== undefined) setBoardLocked(payload.locked);
      })
      .on("broadcast", { event: "board_lock" }, ({ payload }) => {
        setBoardLocked(payload.locked);
      })
      .on("broadcast", { event: "member_joined" }, () => {
        fetchMembers().then(setMembers);
      })
      .on("broadcast", { event: "board_deleted" }, () => {
        setBoardDeletedByOwner(true);
      })
      .subscribe();

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); channelRef.current = null; };
  }, [boardId, isShared, onRemoteUpdate, fetchMembers]);

  // ── BOARD_MEMBERS LIVE UPDATES ─────────────────────────────────────────────────
  // postgres_changes on board_members was removed — Supabase Realtime's row-level
  // filter check still hits the RLS policy and can fail. Instead we refresh via a
  // periodic poll when the ShareModal is open, plus on every member_joined broadcast.
  // The broadcast channel already handles member_joined → fetchMembers() above.

  // ── ANNOUNCE ARRIVAL (viewer → lets owner refresh members list) ───────────────
  useEffect(() => {
    if (!isShared || !boardId || myRole !== "viewer") return;
    const timer = setTimeout(() => {
      channelRef.current?.send({ type: "broadcast", event: "member_joined", payload: {} });
    }, 600);
    return () => clearTimeout(timer);
  }, [isShared, boardId, myRole]);

  // ── BROADCAST LOCAL CHANGES + PERSIST ────────────────────────────────────────
  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return; }
    if (!isShared || !boardId || !supabase) return;
    // Only owners and editors may broadcast. Block unknown/null role too —
    // it's briefly null on first render and must not create a spurious send.
    if (!myRole || myRole === "viewer") return;

    // If this render was caused by a remote update, skip broadcasting back.
    // This breaks the ping-pong feedback loop that glitches multi-column boards.
    if (suppressBroadcastRef.current) {
      suppressBroadcastRef.current = false;
      return;
    }

    // Debounced broadcast — coalesces rapid drag/edit events into one network
    // send per gesture (≈150 ms window). Peers feel near-instant updates while
    // intermediate partial states never hit the wire.
    clearTimeout(broadcastTimerRef.current);
    broadcastTimerRef.current = setTimeout(() => {
      channelRef.current?.send({
        type: "broadcast",
        event: "page_update",
        payload: { clientId: CLIENT_ID, columns, layout, tags, locked: boardLockedRef.current },
      });
    }, 150);

    // Debounced DB persist (longer window — DB write is for durability only)
    const persistTimer = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { error } = await supabase
        .from("shared_boards")
        .update({ columns, layout })
        .eq("id", boardId);
      if (error) console.warn("[collab] persist failed:", error.message);
    }, 800);

    return () => { clearTimeout(broadcastTimerRef.current); clearTimeout(persistTimer); };
  }, [boardId, isShared, columns, layout, tags, myRole]);

  // ── ACTIONS ───────────────────────────────────────────────────────────────────

  const shareBoard = useCallback(async (name) => {
    if (!boardId || !supabase) return { error: "Supabase not configured" };
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { error: "Not signed in" };

    const { error: boardErr } = await supabase
      .from("shared_boards")
      .upsert({ id: boardId, owner_id: session.user.id, name, mode, columns, layout }, { onConflict: "id" });

    if (boardErr) return { error: boardErr.message };

    const { error: memberErr } = await supabase
      .rpc("add_board_member", { p_board_id: boardId, p_role: "owner" });

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
      .select("id, name, columns, layout, mode, locked")
      .eq("id", code.trim())
      .single();

    if (fetchErr || !board) {
      return {
        error: fetchErr?.code === "PGRST116"
          ? "Board not found. Double-check the code."
          : (fetchErr?.message ?? "Board not found. Double-check the code."),
      };
    }

    const { error: memberErr } = await supabase
      .rpc("add_board_member", { p_board_id: code.trim(), p_role: "viewer" });

    if (memberErr) return { error: memberErr.message };
    setMyRole("viewer");
    setBoardLocked(board.locked ?? false);
    return { error: null, board };
  }, []);

  const updateMemberRole = useCallback(async (bId, userId, role) => {
    if (!supabase) return { error: "Supabase not configured" };
    const { error } = await supabase.rpc("update_member_role", {
      p_board_id: bId, p_user_id: userId, p_role: role,
    });
    if (error) return { error: error.message };
    const updated = await fetchMembers();
    setMembers(updated);
    return { error: null };
  }, [fetchMembers]);

  const refreshMembers = useCallback(async () => {
    const list = await fetchMembers();
    setMembers(list);
  }, [fetchMembers]);

  const toggleBoardLock = useCallback(async () => {
    if (!supabase || !boardId) return;
    const newLocked = !boardLockedRef.current;
    setBoardLocked(newLocked);
    await supabase.from("shared_boards").update({ locked: newLocked }).eq("id", boardId);
    channelRef.current?.send({
      type: "broadcast", event: "board_lock", payload: { locked: newLocked },
    });
  }, [boardId]);

  const removeMember = useCallback(async (bId, userId) => {
    if (!supabase) return { error: "Not configured" };
    const { data, error } = await supabase.rpc("remove_board_member", {
      p_board_id: bId,
      p_user_id: userId,
    });
    if (error) return { error: error.message };
    if (data?.error) return { error: data.error };
    const updated = await fetchMembers();
    setMembers(updated);
    return { error: null };
  }, [fetchMembers]);

  const addMemberByEmail = useCallback(async (email, role = "viewer") => {
    if (!supabase || !boardId) return { error: "Not configured" };
    const { data, error } = await supabase.rpc("add_member_by_email", {
      p_board_id: boardId,
      p_email: email.trim(),
      p_role: role,
    });
    if (error) return { error: error.message };
    if (data?.error) return { error: data.error };
    // Refresh members list after successful add
    const updated = await fetchMembers();
    setMembers(updated);
    return { error: null, member: data };
  }, [boardId, fetchMembers]);

  const leaveBoard = useCallback(async (bId) => {
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from("board_members").delete().eq("board_id", bId).eq("user_id", session.user.id);
  }, []);

  const stopSharing = useCallback(async (bId) => {
    if (!supabase) return { error: "Supabase not configured" };
    // Notify collaborators first so they receive it while still on the channel
    channelRef.current?.send({ type: "broadcast", event: "board_deleted", payload: {} });
    await new Promise(r => setTimeout(r, 300));
    // Use SECURITY DEFINER RPC — direct DELETE on board_members triggers RLS (500)
    const { data, error } = await supabase.rpc("stop_sharing_board", { p_board_id: bId });
    return { error: data?.error ?? error?.message ?? null };
  }, []);

  const getSentInvites = useCallback(async () => {
    if (!boardId || !supabase) return [];
    const { data, error } = await supabase.rpc("get_sent_invites", { p_board_id: boardId });
    if (error) { console.warn("[collab] get_sent_invites error:", error.message); return []; }
    return data ?? [];
  }, [boardId]);

  // Hard-delete the board (owner fully removes it from shared_boards)
  const deleteBoard = useCallback(async (bId) => {
    if (!supabase) return { error: "Supabase not configured" };
    channelRef.current?.send({ type: "broadcast", event: "board_deleted", payload: {} });
    await new Promise(r => setTimeout(r, 300));
    const { error } = await supabase.from("shared_boards").delete().eq("id", bId);
    return { error: error?.message ?? null };
  }, []);

  return {
    shareBoard, joinBoard, leaveBoard, stopSharing, deleteBoard,
    fetchMembers, refreshMembers, updateMemberRole, removeMember, addMemberByEmail, toggleBoardLock,
    getSentInvites,
    members, myRole, boardLocked, boardDeletedByOwner,
  };
}
