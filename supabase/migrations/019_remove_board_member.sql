-- ── Migration 019: remove_board_member RPC ───────────────────────────────────
-- Allows a board owner to kick any non-owner member.
-- SECURITY DEFINER so it bypasses the RLS policies on board_members.

create or replace function public.remove_board_member(
  p_board_id text,
  p_user_id  uuid
)
returns jsonb
language plpgsql security definer as $$
begin
  -- Caller must be the board owner
  if not exists (
    select 1 from public.board_members
    where board_id = p_board_id
      and user_id  = auth.uid()
      and role     = 'owner'
  ) then
    return jsonb_build_object('error', 'Only the board owner can remove members');
  end if;

  -- Cannot remove yourself
  if p_user_id = auth.uid() then
    return jsonb_build_object('error', 'Cannot remove yourself from the board');
  end if;

  delete from public.board_members
  where board_id = p_board_id
    and user_id  = p_user_id;

  return jsonb_build_object('error', null);
end;
$$;
