-- Add covering indexes for unindexed foreign keys.
-- These columns are used in JOINs and WHERE clauses frequently.

CREATE INDEX IF NOT EXISTS board_invites_invitee_id_idx ON public.board_invites (invitee_id);
CREATE INDEX IF NOT EXISTS board_invites_inviter_id_idx ON public.board_invites (inviter_id);
CREATE INDEX IF NOT EXISTS board_members_user_id_idx    ON public.board_members (user_id);
CREATE INDEX IF NOT EXISTS board_members_invited_by_idx ON public.board_members (invited_by);
CREATE INDEX IF NOT EXISTS shared_boards_owner_id_idx   ON public.shared_boards (owner_id);
