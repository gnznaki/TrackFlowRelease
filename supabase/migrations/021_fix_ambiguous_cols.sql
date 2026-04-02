-- ── Migration 021: Fix ambiguous column references ────────────────────────────
-- PL/pgSQL resolves bare column names against RETURNS TABLE output columns first,
-- making `user_id` and `role` ambiguous in WHERE clauses inside functions that
-- return a table with those column names. Fix: use explicit table aliases.

-- ── get_board_members ─────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_board_members(text);

CREATE FUNCTION public.get_board_members(p_board_id text)
RETURNS TABLE (
  user_id      uuid,
  role         text,
  created_at   timestamptz,
  email        text,
  display_name text,
  avatar_color text,
  avatar_url   text
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.board_members chk
    WHERE chk.board_id = p_board_id AND chk.user_id = auth.uid()
  ) THEN RETURN; END IF;

  RETURN QUERY
    SELECT bm.user_id, bm.role, bm.created_at,
           p.email::text, p.display_name, p.avatar_color, p.avatar_url
    FROM public.board_members bm
    JOIN public.profiles p ON p.id = bm.user_id
    WHERE bm.board_id = p_board_id
    ORDER BY bm.created_at;
END;
$$;

-- ── get_sent_invites ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_sent_invites(p_board_id text)
RETURNS TABLE (
  id           uuid,
  invitee_id   uuid,
  email        text,
  display_name text,
  avatar_color text,
  avatar_url   text,
  role         text,
  created_at   timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.board_members chk
    WHERE chk.board_id = p_board_id AND chk.user_id = auth.uid() AND chk.role = 'owner'
  ) THEN RETURN; END IF;

  RETURN QUERY
    SELECT bi.id, bi.invitee_id,
           p.email::text, p.display_name, p.avatar_color, p.avatar_url,
           bi.role, bi.created_at
    FROM public.board_invites bi
    JOIN public.profiles p ON p.id = bi.invitee_id
    WHERE bi.board_id = p_board_id
    ORDER BY bi.created_at;
END;
$$;

-- ── add_member_by_email — also fix ambiguous role check ───────────────────────
CREATE OR REPLACE FUNCTION public.add_member_by_email(
  p_board_id text,
  p_email    text,
  p_role     text DEFAULT 'viewer'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_invitee_id  uuid;
  v_inviter_id  uuid;
  v_board_name  text;
  v_inv_dis     boolean;
BEGIN
  v_inviter_id := auth.uid();

  IF NOT EXISTS (
    SELECT 1 FROM public.board_members chk
    WHERE chk.board_id = p_board_id AND chk.user_id = v_inviter_id AND chk.role = 'owner'
  ) THEN
    RETURN jsonb_build_object('error', 'Only the board owner can invite members');
  END IF;

  SELECT id INTO v_invitee_id FROM public.profiles WHERE email = p_email;
  IF v_invitee_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No TrackFlow account found with that email');
  END IF;

  IF v_invitee_id = v_inviter_id THEN
    RETURN jsonb_build_object('error', 'You cannot invite yourself');
  END IF;

  SELECT invites_disabled INTO v_inv_dis FROM public.profiles WHERE id = v_invitee_id;
  IF v_inv_dis THEN
    RETURN jsonb_build_object('error', 'This user has disabled board invitations');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.board_members chk
    WHERE chk.board_id = p_board_id AND chk.user_id = v_invitee_id
  ) THEN
    RETURN jsonb_build_object('error', 'This user is already a member of the board');
  END IF;

  SELECT name INTO v_board_name FROM public.shared_boards WHERE id = p_board_id;

  INSERT INTO public.board_invites(board_id, board_name, inviter_id, invitee_id, role)
  VALUES (p_board_id, v_board_name, v_inviter_id, v_invitee_id, p_role)
  ON CONFLICT (board_id, invitee_id) DO UPDATE
    SET role = EXCLUDED.role, created_at = now();

  RETURN jsonb_build_object('error', null);
END;
$$;

-- ── stop_sharing_board — fix ambiguous role check ─────────────────────────────
CREATE OR REPLACE FUNCTION public.stop_sharing_board(p_board_id text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  v_owner_id := auth.uid();

  IF NOT EXISTS (
    SELECT 1 FROM public.board_members chk
    WHERE chk.board_id = p_board_id AND chk.user_id = v_owner_id AND chk.role = 'owner'
  ) THEN
    RETURN jsonb_build_object('error', 'Only the board owner can stop sharing');
  END IF;

  DELETE FROM public.board_members
  WHERE board_id = p_board_id AND user_id <> v_owner_id;

  DELETE FROM public.board_invites WHERE board_id = p_board_id;

  RETURN jsonb_build_object('error', null);
END;
$$;
