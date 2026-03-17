-- Phase 3: Shared boards for real-time collaboration
-- Run this in: Supabase Dashboard → SQL Editor

-- ─────────────────────────────────────────────────────────────
-- SHARED BOARDS
-- One row per board that has been shared. Board ID comes from
-- the app state (producerBoardId / engineerBoardId).
-- ─────────────────────────────────────────────────────────────
create table if not exists public.shared_boards (
  id         text primary key,              -- matches boardId in app state
  owner_id   uuid not null references auth.users(id) on delete cascade,
  name       text not null default 'Shared Board',
  mode       text not null default 'producer' check (mode in ('producer', 'engineer')),
  columns    jsonb not null default '[]',
  layout     jsonb not null default '[[]]',
  updated_at timestamptz not null default now()
);

alter table public.shared_boards enable row level security;

-- Any signed-in user can look up a board by code (needed for join flow)
create policy "Authenticated users can read shared boards"
  on public.shared_boards for select
  to authenticated
  using (true);

-- Only board owners can create new shared boards
create policy "Owners can insert shared boards"
  on public.shared_boards for insert
  with check (owner_id = auth.uid());

-- Editors and owners can push updates
create policy "Editors can update shared boards"
  on public.shared_boards for update
  using (
    exists (
      select 1 from public.board_members bm
      where bm.board_id = shared_boards.id
        and bm.user_id = auth.uid()
        and bm.role in ('owner', 'editor')
    )
  );

-- Only owner can delete
create policy "Owners can delete shared boards"
  on public.shared_boards for delete
  using (owner_id = auth.uid());

-- Auto-update updated_at on writes
create trigger shared_boards_updated_at
  before update on public.shared_boards
  for each row execute procedure public.set_updated_at();

-- Enable Realtime so subscribers receive live updates
alter publication supabase_realtime add table public.shared_boards;

-- ─────────────────────────────────────────────────────────────
-- BOARD_MEMBERS — update policies for better visibility
-- ─────────────────────────────────────────────────────────────

-- Replace the narrow "own rows only" SELECT policy with one that
-- lets any board member see all members on boards they belong to.
drop policy if exists "Members can read their own memberships" on public.board_members;

create policy "Board members can see all members of their boards"
  on public.board_members for select
  using (
    exists (
      select 1 from public.board_members bm2
      where bm2.board_id = board_members.board_id
        and bm2.user_id = auth.uid()
    )
  );

-- Allow any authenticated user to add themselves (needed for join flow)
create policy "Users can insert themselves as a member"
  on public.board_members for insert
  with check (user_id = auth.uid());

-- Allow users to remove themselves from boards they joined
create policy "Users can remove themselves from boards"
  on public.board_members for delete
  using (user_id = auth.uid());
