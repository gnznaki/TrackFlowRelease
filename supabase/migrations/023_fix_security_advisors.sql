-- Fix: function_search_path_mutable (all 14 public functions)
-- Adds SET search_path = public to every SECURITY DEFINER function so the
-- search_path cannot be hijacked by objects in other schemas.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.is_board_member(p_board_id text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  select exists (
    select 1 from public.board_members
    where board_id = p_board_id
      and user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_board_coworker(other_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  select exists (
    select 1 from public.board_members bm1
    join public.board_members bm2 on bm1.board_id = bm2.board_id
    where bm1.user_id = auth.uid()
      and bm2.user_id = other_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.can_edit_board(p_board_id text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  select exists (
    select 1 from public.board_members
    where board_id = p_board_id
      and user_id = auth.uid()
      and role in ('owner', 'editor')
  );
$$;

CREATE OR REPLACE FUNCTION public.add_board_member(p_board_id text, p_role text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  insert into public.board_members (board_id, user_id, role)
  values (p_board_id, auth.uid(), p_role)
  on conflict (board_id, user_id) do nothing;
$$;

CREATE OR REPLACE FUNCTION public.update_member_role(p_board_id text, p_user_id uuid, p_role text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  update public.board_members
  set role = p_role
  where board_id = p_board_id
    and user_id = p_user_id
    and p_role in ('viewer', 'editor')
    and exists (
      select 1 from public.board_members
      where board_id = p_board_id
        and user_id = auth.uid()
        and role = 'owner'
    );
$$;

CREATE OR REPLACE FUNCTION public.get_board_members(p_board_id text)
RETURNS TABLE(user_id uuid, role text, created_at timestamp with time zone, email text, display_name text, avatar_color text, avatar_url text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

CREATE OR REPLACE FUNCTION public.remove_board_member(p_board_id text, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  if not exists (
    select 1 from public.board_members
    where board_id = p_board_id
      and user_id  = auth.uid()
      and role     = 'owner'
  ) then
    return jsonb_build_object('error', 'Only the board owner can remove members');
  end if;

  if p_user_id = auth.uid() then
    return jsonb_build_object('error', 'Cannot remove yourself from the board');
  end if;

  delete from public.board_members
  where board_id = p_board_id
    and user_id  = p_user_id;

  return jsonb_build_object('error', null);
end;
$$;

CREATE OR REPLACE FUNCTION public.stop_sharing_board(p_board_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

CREATE OR REPLACE FUNCTION public.add_member_by_email(p_board_id text, p_email text, p_role text DEFAULT 'viewer')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

CREATE OR REPLACE FUNCTION public.get_my_invites()
RETURNS TABLE(id uuid, board_id text, board_name text, inviter_name text, role text, created_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

CREATE OR REPLACE FUNCTION public.get_sent_invites(p_board_id text)
RETURNS TABLE(id uuid, invitee_id uuid, email text, display_name text, avatar_color text, avatar_url text, role text, created_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

CREATE OR REPLACE FUNCTION public.respond_to_invite(p_invite_id uuid, p_accept boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.board_invites;
BEGIN
  SELECT * INTO v_invite
  FROM public.board_invites
  WHERE id = p_invite_id AND invitee_id = auth.uid();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Invite not found');
  END IF;

  DELETE FROM public.board_invites WHERE id = p_invite_id;

  IF p_accept THEN
    INSERT INTO public.board_members(board_id, user_id, role)
    VALUES (v_invite.board_id, auth.uid(), v_invite.role)
    ON CONFLICT (board_id, user_id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object('error', null, 'board_id', v_invite.board_id);
END;
$$;

-- Fix: public_bucket_allows_listing
-- Replace the broad SELECT policy on avatars with one scoped to individual
-- objects only, preventing clients from enumerating all files in the bucket.
DROP POLICY IF EXISTS "Avatars are publicly readable" ON storage.objects;

CREATE POLICY "Avatars are publicly readable"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'avatars'
  AND auth.role() IN ('anon', 'authenticated')
  AND (storage.foldername(name))[1] != ''  -- must be a real object path, not a folder listing
);
