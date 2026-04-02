-- Fix self-referential RLS on board_members (same infinite-recursion pattern as profiles).
-- The old policy queried board_members to check membership, triggering itself → 500 error.
-- Replace with a security definer function that bypasses RLS for the inner check.

create or replace function public.is_board_member(p_board_id text)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.board_members
    where board_id = p_board_id
      and user_id = auth.uid()
  );
$$;

drop policy if exists "Board members can see all members of their boards" on public.board_members;

create policy "Board members can see all members of their boards"
  on public.board_members for select
  using (public.is_board_member(board_id));
