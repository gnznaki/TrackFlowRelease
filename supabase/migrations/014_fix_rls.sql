-- ─── Migration 014: Fix board_members infinite recursion & shared_boards UPDATE ──────────────────
-- The board_members SELECT policy was self-referential (42P17).
-- Fix: drop ALL policies and recreate them using the existing SECURITY DEFINER function.
-- Also create can_edit_board() so the shared_boards UPDATE policy never touches board_members directly.

-- 1. Drop every known board_members policy (belt-and-suspenders — names varied across migrations)
drop policy if exists "Members can read their own memberships"           on public.board_members;
drop policy if exists "Board members can see all members of their boards" on public.board_members;
drop policy if exists "board_members_select"                              on public.board_members;
drop policy if exists "Users can insert themselves as a member"           on public.board_members;
drop policy if exists "board_members_insert"                              on public.board_members;
drop policy if exists "Users can remove themselves from boards"           on public.board_members;
drop policy if exists "board_members_delete"                              on public.board_members;
drop policy if exists "Owners can update member roles"                    on public.board_members;
drop policy if exists "board_members_update"                              on public.board_members;

-- 2. Recreate clean policies that use the security-definer helper (avoids recursion)
create policy "board_members_select"
  on public.board_members for select
  using (public.is_board_member(board_id));

create policy "board_members_insert"
  on public.board_members for insert
  with check (user_id = auth.uid());

create policy "board_members_delete"
  on public.board_members for delete
  using (user_id = auth.uid());

-- 3. Create can_edit_board() so shared_boards UPDATE never queries board_members via RLS
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

-- 4. Fix shared_boards UPDATE policy to use the new function
drop policy if exists "Editors can update shared boards" on public.shared_boards;
drop policy if exists "Owners can update their boards"   on public.shared_boards;

create policy "Editors can update shared boards"
  on public.shared_boards for update
  using (public.can_edit_board(id));
