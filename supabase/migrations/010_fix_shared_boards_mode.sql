-- shared_boards.mode check constraint is stale — app moved from two fixed modes
-- (producer/engineer) to arbitrary pages. Drop the constraint so any string is valid.

alter table public.shared_boards drop constraint if exists shared_boards_mode_check;

-- Fix profiles RLS infinite recursion from migration 007.
-- The policy joined board_members with itself, causing recursive RLS evaluation.
-- Replace with a security definer function that bypasses RLS for the inner check.

create or replace function public.is_board_coworker(other_user_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.board_members bm1
    join public.board_members bm2 on bm1.board_id = bm2.board_id
    where bm1.user_id = auth.uid()
      and bm2.user_id = other_user_id
  );
$$;

drop policy if exists "Board members can read co-member profiles" on public.profiles;

create policy "Board members can read co-member profiles"
  on public.profiles for select
  using (
    id = auth.uid()
    or public.is_board_coworker(id)
  );
