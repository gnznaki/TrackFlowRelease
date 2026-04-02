-- ── Migration 018: Invite system + avatar_url in members + invites_disabled ────

-- 1. Add invites_disabled preference to profiles
alter table public.profiles
  add column if not exists invites_disabled boolean not null default false;

-- 2. Update get_board_members to return avatar_url so member avatars render in ShareModal
create or replace function public.get_board_members(p_board_id text)
returns table (
  user_id      uuid,
  role         text,
  created_at   timestamptz,
  email        text,
  display_name text,
  avatar_color text,
  avatar_url   text
)
language sql security definer stable as $$
  select
    bm.user_id,
    bm.role,
    bm.created_at,
    p.email,
    p.display_name,
    p.avatar_color,
    p.avatar_url
  from public.board_members bm
  left join public.profiles p on p.id = bm.user_id
  where bm.board_id = p_board_id
    and exists (
      select 1 from public.board_members
      where board_id = p_board_id and user_id = auth.uid()
    );
$$;

-- 3. board_invites table — pending invites before user accepts/declines
create table if not exists public.board_invites (
  id          uuid        primary key default gen_random_uuid(),
  board_id    text        not null references public.shared_boards(id) on delete cascade,
  board_name  text        not null default '',
  inviter_id  uuid        not null references auth.users(id) on delete cascade,
  invitee_id  uuid        not null references auth.users(id) on delete cascade,
  role        text        not null default 'viewer',
  created_at  timestamptz not null default now(),
  unique(board_id, invitee_id)
);

alter table public.board_invites enable row level security;

-- Invitee can view and delete their own invites
create policy "Invitee can view their invites"
  on public.board_invites for select
  using (invitee_id = auth.uid());

create policy "Invitee can delete invite"
  on public.board_invites for delete
  using (invitee_id = auth.uid());

-- Inviter can view and rescind invites they sent
create policy "Inviter can view sent invites"
  on public.board_invites for select
  using (inviter_id = auth.uid());

create policy "Inviter can delete invite"
  on public.board_invites for delete
  using (inviter_id = auth.uid());

-- Enable realtime on board_invites so clients get live notifications
alter publication supabase_realtime add table public.board_invites;

-- 4. Update add_member_by_email to create an invite instead of directly adding
create or replace function public.add_member_by_email(
  p_board_id  text,
  p_email     text,
  p_role      text default 'viewer'
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_user_id    uuid;
  v_email      text;
  v_display    text;
  v_color      text;
  v_disabled   boolean;
  v_board_name text;
begin
  -- Only the board owner may invite
  if not exists (
    select 1 from public.board_members
    where board_id = p_board_id
      and user_id  = auth.uid()
      and role     = 'owner'
  ) then
    return jsonb_build_object('error', 'Only the board owner can add members');
  end if;

  -- Get board name for the invite notification
  select name into v_board_name from public.shared_boards where id = p_board_id;

  -- Find user by email (case-insensitive) in auth.users
  select id, email into v_user_id, v_email
  from auth.users
  where lower(email) = lower(trim(p_email))
  limit 1;

  if v_user_id is null then
    return jsonb_build_object('error', 'No TrackFlow account found with that email');
  end if;

  if v_user_id = auth.uid() then
    return jsonb_build_object('error', 'You are already the owner of this board');
  end if;

  -- Already a member?
  if exists (
    select 1 from public.board_members
    where board_id = p_board_id and user_id = v_user_id
  ) then
    return jsonb_build_object('error', 'This person is already a member of this board');
  end if;

  -- Check invites_disabled preference
  select invites_disabled into v_disabled from public.profiles where id = v_user_id;
  if coalesce(v_disabled, false) then
    return jsonb_build_object('error', 'This user has disabled board invitations');
  end if;

  -- Pull invitee profile details
  select display_name, avatar_color into v_display, v_color
  from public.profiles where id = v_user_id;

  -- Upsert invite — re-inviting updates the role without spamming
  insert into public.board_invites (board_id, board_name, inviter_id, invitee_id, role)
  values (p_board_id, coalesce(v_board_name, p_board_id), auth.uid(), v_user_id, p_role)
  on conflict (board_id, invitee_id) do update set role = excluded.role;

  return jsonb_build_object(
    'error',        null,
    'user_id',      v_user_id,
    'email',        v_email,
    'display_name', v_display,
    'avatar_color', v_color,
    'role',         p_role,
    'invite_sent',  true
  );
end;
$$;

-- 5. get_my_invites — returns all pending invites for the current user
create or replace function public.get_my_invites()
returns table (
  id           uuid,
  board_id     text,
  board_name   text,
  inviter_id   uuid,
  inviter_name text,
  role         text,
  created_at   timestamptz
)
language sql security definer stable as $$
  select
    bi.id,
    bi.board_id,
    bi.board_name,
    bi.inviter_id,
    p.display_name as inviter_name,
    bi.role,
    bi.created_at
  from public.board_invites bi
  left join public.profiles p on p.id = bi.inviter_id
  where bi.invitee_id = auth.uid();
$$;

-- 6. respond_to_invite — accept (joins board) or decline (deletes invite)
create or replace function public.respond_to_invite(
  p_invite_id uuid,
  p_accept    boolean
)
returns jsonb
language plpgsql security definer as $$
declare
  v_invite public.board_invites;
begin
  select * into v_invite
  from public.board_invites
  where id = p_invite_id and invitee_id = auth.uid();

  if not found then
    return jsonb_build_object('error', 'Invite not found');
  end if;

  -- Always delete the invite record
  delete from public.board_invites where id = p_invite_id;

  if p_accept then
    -- Add to board_members
    insert into public.board_members (board_id, user_id, role)
    values (v_invite.board_id, auth.uid(), v_invite.role)
    on conflict (board_id, user_id) do update set role = excluded.role;

    return jsonb_build_object(
      'error',      null,
      'accepted',   true,
      'board_id',   v_invite.board_id,
      'board_name', v_invite.board_name,
      'role',       v_invite.role
    );
  else
    return jsonb_build_object('error', null, 'accepted', false);
  end if;
end;
$$;
