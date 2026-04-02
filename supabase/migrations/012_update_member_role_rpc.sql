-- Security definer function to update a board member's role.
-- Only the board owner can call this effectively (the WHERE checks ownership).
-- Uses security definer to bypass RLS on board_members.

create or replace function public.update_member_role(p_board_id text, p_user_id uuid, p_role text)
returns void
language sql
security definer
as $$
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
