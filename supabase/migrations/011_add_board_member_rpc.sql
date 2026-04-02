-- Security definer function to insert a board member, bypassing RLS.
-- This sidesteps the infinite recursion on board_members SELECT policy entirely
-- because the function runs as the postgres role, not the calling user.

create or replace function public.add_board_member(p_board_id text, p_role text)
returns void
language sql
security definer
as $$
  insert into public.board_members (board_id, user_id, role)
  values (p_board_id, auth.uid(), p_role)
  on conflict (board_id, user_id) do nothing;
$$;
