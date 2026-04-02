-- ── Migration 020: Comprehensive idempotent fix ──────────────────────────────
--
-- Fixes in order:
--   1. Storage policies  (016 failed: policy already exists)
--   2. get_board_members (018 failed: cannot change return type)
--   3. board_invites table + invite RPCs (018 never ran)
--   4. stop_sharing_board RPC (replace direct DELETE that hits RLS)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Storage bucket policies (idempotent) ───────────────────────────────────
DO $$
BEGIN
  DROP POLICY IF EXISTS "Avatars are publicly readable"      ON storage.objects;
  DROP POLICY IF EXISTS "Users can upload their own avatar"  ON storage.objects;
  DROP POLICY IF EXISTS "Users can update their own avatar"  ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete their own avatar"  ON storage.objects;
END $$;

CREATE POLICY "Avatars are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ── 2. get_board_members — drop first so return type can change ───────────────
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
    SELECT 1 FROM public.board_members
    WHERE board_id = p_board_id AND user_id = auth.uid()
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

-- ── 3. invites_disabled column on profiles ────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS invites_disabled boolean NOT NULL DEFAULT false;

-- ── 4. board_invites table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.board_invites (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id    text        NOT NULL,
  board_name  text        NOT NULL,
  inviter_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text        NOT NULL DEFAULT 'viewer',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (board_id, invitee_id)
);

ALTER TABLE public.board_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Invitee sees own invites"  ON public.board_invites;
DROP POLICY IF EXISTS "Inviter sees sent invites" ON public.board_invites;

CREATE POLICY "Invitee sees own invites"  ON public.board_invites
  FOR SELECT USING (invitee_id = auth.uid());

CREATE POLICY "Inviter sees sent invites" ON public.board_invites
  FOR SELECT USING (inviter_id = auth.uid());

-- Add to realtime publication (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'board_invites'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.board_invites;
  END IF;
END $$;

-- ── 5. add_member_by_email — creates invite, never direct-inserts ─────────────
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

  -- Caller must be board owner
  IF NOT EXISTS (
    SELECT 1 FROM public.board_members
    WHERE board_id = p_board_id AND user_id = v_inviter_id AND role = 'owner'
  ) THEN
    RETURN jsonb_build_object('error', 'Only the board owner can invite members');
  END IF;

  -- Resolve invitee
  SELECT id INTO v_invitee_id FROM public.profiles WHERE email = p_email;
  IF v_invitee_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No TrackFlow account found with that email');
  END IF;

  -- Cannot invite yourself
  IF v_invitee_id = v_inviter_id THEN
    RETURN jsonb_build_object('error', 'You cannot invite yourself');
  END IF;

  -- Check invites_disabled
  SELECT invites_disabled INTO v_inv_dis FROM public.profiles WHERE id = v_invitee_id;
  IF v_inv_dis THEN
    RETURN jsonb_build_object('error', 'This user has disabled board invitations');
  END IF;

  -- Already a member?
  IF EXISTS (
    SELECT 1 FROM public.board_members WHERE board_id = p_board_id AND user_id = v_invitee_id
  ) THEN
    RETURN jsonb_build_object('error', 'This user is already a member of the board');
  END IF;

  -- Get board name for the invite record
  SELECT name INTO v_board_name FROM public.shared_boards WHERE id = p_board_id;

  -- Upsert (re-invite updates role and timestamp)
  INSERT INTO public.board_invites(board_id, board_name, inviter_id, invitee_id, role)
  VALUES (p_board_id, v_board_name, v_inviter_id, v_invitee_id, p_role)
  ON CONFLICT (board_id, invitee_id) DO UPDATE
    SET role = EXCLUDED.role, created_at = now();

  RETURN jsonb_build_object('error', null);
END;
$$;

-- ── 6. get_my_invites — invitee fetches their own pending invites ─────────────
CREATE OR REPLACE FUNCTION public.get_my_invites()
RETURNS TABLE (
  id           uuid,
  board_id     text,
  board_name   text,
  inviter_name text,
  role         text,
  created_at   timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
    SELECT bi.id, bi.board_id, bi.board_name,
           p.display_name AS inviter_name,
           bi.role, bi.created_at
    FROM public.board_invites bi
    JOIN public.profiles p ON p.id = bi.inviter_id
    WHERE bi.invitee_id = auth.uid()
    ORDER BY bi.created_at DESC;
END;
$$;

-- ── 7. get_sent_invites — owner sees pending invites they sent ────────────────
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
    SELECT 1 FROM public.board_members
    WHERE board_id = p_board_id AND user_id = auth.uid() AND role = 'owner'
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

-- ── 8. respond_to_invite ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.respond_to_invite(
  p_invite_id uuid,
  p_accept    boolean
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_invite public.board_invites;
BEGIN
  SELECT * INTO v_invite
  FROM public.board_invites
  WHERE id = p_invite_id AND invitee_id = auth.uid();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Invite not found');
  END IF;

  -- Remove invite regardless of response
  DELETE FROM public.board_invites WHERE id = p_invite_id;

  IF p_accept THEN
    INSERT INTO public.board_members(board_id, user_id, role)
    VALUES (v_invite.board_id, auth.uid(), v_invite.role)
    ON CONFLICT (board_id, user_id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object('error', null, 'board_id', v_invite.board_id);
END;
$$;

-- ── 9. stop_sharing_board — replaces direct DELETE that triggers RLS 500 ──────
CREATE OR REPLACE FUNCTION public.stop_sharing_board(p_board_id text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  v_owner_id := auth.uid();

  IF NOT EXISTS (
    SELECT 1 FROM public.board_members
    WHERE board_id = p_board_id AND user_id = v_owner_id AND role = 'owner'
  ) THEN
    RETURN jsonb_build_object('error', 'Only the board owner can stop sharing');
  END IF;

  -- Remove all non-owner members
  DELETE FROM public.board_members
  WHERE board_id = p_board_id AND user_id <> v_owner_id;

  -- Cancel all pending invites for this board
  DELETE FROM public.board_invites WHERE board_id = p_board_id;

  RETURN jsonb_build_object('error', null);
END;
$$;
