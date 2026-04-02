-- ─── Migration 015: get_board_members RPC + definitive RLS fix ──────────────────────────────────
-- Replaces direct board_members SELECT (which triggers infinite recursion in RLS)
-- with a single SECURITY DEFINER function that runs as postgres, bypassing RLS entirely.
-- Also contains the full 014 fixes in case 014 was not run.

-- ── 1. Drop every board_members policy that could exist ──────────────────────────────────────────
drop policy if exists "Members can read their own memberships"            on public.board_members;
drop policy if exists "Board members can see all members of their boards" on public.board_members;
drop policy if exists "board_members_select"                              on public.board_members;
drop policy if exists "Users can insert themselves as a member"           on public.board_members;
drop policy if exists "board_members_insert"                              on public.board_members;
drop policy if exists "Users can remove themselves from boards"           on public.board_members;
drop policy if exists "board_members_delete"                              on public.board_members;
drop policy if exists "Owners can update member roles"                    on public.board_members;
drop policy if exists "board_members_update"                              on public.board_members;

-- ── 2. Recreate clean board_members policies using the existing security-definer helper ──────────
create policy "board_members_select"
  on public.board_members for select
  using (public.is_board_member(board_id));

create policy "board_members_insert"
  on public.board_members for insert
  with check (user_id = auth.uid());

create policy "board_members_delete"
  on public.board_members for delete
  using (user_id = auth.uid());

-- ── 3. can_edit_board: lets shared_boards UPDATE policy avoid touching board_members via RLS ──────
create or replace function public.can_edit_board(p_board_id text)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.board_members
    where board_id = p_board_id
      and user_id = auth.uid()
      and role in ('owner', 'editor')
  );
$$;

drop policy if exists "Editors can update shared boards" on public.shared_boards;
drop policy if exists "Owners can update their boards"   on public.shared_boards;

create policy "Editors can update shared boards"
  on public.shared_boards for update
  using (public.can_edit_board(id));

-- ── 4. get_board_members: single SECURITY DEFINER RPC — never touches RLS on board_members ───────
-- The client calls supabase.rpc('get_board_members', { p_board_id }) instead of
-- a direct SELECT on board_members, which used to trigger the recursive RLS policy.
create or replace function public.get_board_members(p_board_id text)
returns table (
  user_id     uuid,
  role        text,
  created_at  timestamptz,
  email       text,
  display_name text,
  avatar_color text
)
language sql
security definer
stable
as $$
  select
    bm.user_id,
    bm.role,
    bm.created_at,
    p.email,
    p.display_name,
    p.avatar_color
  from public.board_members bm
  left join public.profiles p on p.id = bm.user_id
  where bm.board_id = p_board_id
    and exists (
      select 1 from public.board_members
       where board_id = p_board_id
         and user_id = auth.uid()
    );
$$;
