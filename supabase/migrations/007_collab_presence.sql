-- Phase 5: Collaboration presence improvements
-- Run this in: Supabase Dashboard → SQL Editor

-- Allow board members to read profiles of co-members
-- (needed to show avatars and display names of collaborators)
drop policy if exists "Board members can read co-member profiles" on public.profiles;

create policy "Board members can read co-member profiles"
  on public.profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1 from public.board_members bm1
      join public.board_members bm2 on bm1.board_id = bm2.board_id
      where bm1.user_id = auth.uid()
        and bm2.user_id = profiles.id
    )
  );

-- Enable Realtime on board_members so member joins/leaves
-- update the members list live for all collaborators
alter publication supabase_realtime add table public.board_members;
