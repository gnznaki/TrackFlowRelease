-- 1. Add board_members to the Supabase Realtime publication.
--    Without this, the postgres_changes listener on "members-{boardId}"
--    never fires, so new joiners don't appear in the members list live.
alter publication supabase_realtime add table public.board_members;

-- 2. Add a board-level lock flag to shared_boards.
--    When locked = true, all users (including editors) are read-only.
--    Only the owner can toggle this via the ShareModal.
alter table public.shared_boards
  add column if not exists locked boolean not null default false;
