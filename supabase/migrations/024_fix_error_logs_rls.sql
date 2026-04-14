-- Fix: error_logs_insert WITH CHECK (true) was overly permissive.
-- authenticated users can only insert rows tied to their own uid (or null uid)
-- anon users can insert but user_id must be null (can't spoof another user's id)
-- Both require a non-null error_type, blocking empty/junk inserts.

DROP POLICY IF EXISTS "error_logs_insert" ON public.error_logs;

CREATE POLICY "error_logs_insert" ON public.error_logs
FOR INSERT
TO anon, authenticated
WITH CHECK (
  error_type IS NOT NULL
  AND (
    (auth.role() = 'authenticated' AND (user_id = auth.uid() OR user_id IS NULL))
    OR
    (auth.role() = 'anon' AND user_id IS NULL)
  )
);
