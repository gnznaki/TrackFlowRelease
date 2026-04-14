-- Rate limiting table and enforcement.
-- Tracks action counts per user per 1-hour bucket.

CREATE TABLE IF NOT EXISTS public.rate_limits (
  user_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action  text        NOT NULL,
  bucket  timestamptz NOT NULL,
  count   int         NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, action, bucket)
);

CREATE INDEX IF NOT EXISTS rate_limits_bucket_idx ON public.rate_limits (bucket);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rate_limits_own" ON public.rate_limits
  FOR ALL USING (user_id = (select auth.uid()));

-- add_member_by_email: max 10 invites per user per hour
CREATE OR REPLACE FUNCTION public.add_member_by_email(
  p_board_id text,
  p_email    text,
  p_role     text DEFAULT 'viewer'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitee_id  uuid;
  v_inviter_id  uuid;
  v_board_name  text;
  v_inv_dis     boolean;
  v_rate_count  int;
BEGIN
  v_inviter_id := auth.uid();

  INSERT INTO public.rate_limits (user_id, action, bucket, count)
  VALUES (v_inviter_id, 'invite', date_trunc('hour', now()), 1)
  ON CONFLICT (user_id, action, bucket) DO UPDATE
    SET count = rate_limits.count + 1
  RETURNING count INTO v_rate_count;

  IF v_rate_count > 10 THEN
    RETURN jsonb_build_object('error', 'Too many invites sent. Please try again in an hour.');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.board_members chk
    WHERE chk.board_id = p_board_id AND chk.user_id = v_inviter_id AND chk.role = 'owner'
  ) THEN
    RETURN jsonb_build_object('error', 'Only the board owner can invite members');
  END IF;

  SELECT id INTO v_invitee_id FROM public.profiles WHERE email = p_email;
  IF v_invitee_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No TrackFlow account found with that email');
  END IF;

  IF v_invitee_id = v_inviter_id THEN
    RETURN jsonb_build_object('error', 'You cannot invite yourself');
  END IF;

  SELECT invites_disabled INTO v_inv_dis FROM public.profiles WHERE id = v_invitee_id;
  IF v_inv_dis THEN
    RETURN jsonb_build_object('error', 'This user has disabled board invitations');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.board_members chk
    WHERE chk.board_id = p_board_id AND chk.user_id = v_invitee_id
  ) THEN
    RETURN jsonb_build_object('error', 'This user is already a member of the board');
  END IF;

  SELECT name INTO v_board_name FROM public.shared_boards WHERE id = p_board_id;

  INSERT INTO public.board_invites(board_id, board_name, inviter_id, invitee_id, role)
  VALUES (p_board_id, v_board_name, v_inviter_id, v_invitee_id, p_role)
  ON CONFLICT (board_id, invitee_id) DO UPDATE
    SET role = EXCLUDED.role, created_at = now();

  RETURN jsonb_build_object('error', null);
END;
$$;

-- error_logs: max 20 inserts per source per hour
CREATE OR REPLACE FUNCTION public.check_error_log_rate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v_count int;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.error_logs
  WHERE created_at > now() - interval '1 hour'
    AND (
      (NEW.user_id    IS NOT NULL AND user_id    = NEW.user_id)
      OR (NEW.user_email IS NOT NULL AND user_email = NEW.user_email)
    );

  IF v_count >= 20 THEN
    RAISE EXCEPTION 'rate_limit_exceeded';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS error_logs_rate_limit ON public.error_logs;
CREATE TRIGGER error_logs_rate_limit
  BEFORE INSERT ON public.error_logs
  FOR EACH ROW EXECUTE FUNCTION public.check_error_log_rate();
