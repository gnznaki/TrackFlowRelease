-- Error logs table for automatic crash and runtime error reporting
CREATE TABLE IF NOT EXISTS public.error_logs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  user_id      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email   text,
  error_type   text        NOT NULL CHECK (error_type IN ('crash', 'runtime', 'manual')),
  message      text,
  stack        text,
  app_version  text,
  context      jsonb       DEFAULT '{}'
);

-- Indexes for querying
CREATE INDEX IF NOT EXISTS error_logs_created_at_idx  ON public.error_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS error_logs_user_id_idx     ON public.error_logs (user_id);
CREATE INDEX IF NOT EXISTS error_logs_error_type_idx  ON public.error_logs (error_type);
CREATE INDEX IF NOT EXISTS error_logs_app_version_idx ON public.error_logs (app_version);

-- RLS: anyone can insert (captures errors before/without login), nobody can read via client
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "error_logs_insert" ON public.error_logs
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- No SELECT policy → only service role (used by Claude/dashboard) can read
