-- Fix auth_rls_initplan: wrap auth.uid() as (select auth.uid()) so Postgres
-- evaluates it once per query instead of once per row.
-- Fix multiple_permissive_policies: consolidate overlapping policies.

-- ── app_state ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can read own state"   ON public.app_state;
DROP POLICY IF EXISTS "Users can upsert own state" ON public.app_state;

CREATE POLICY "app_state_all"
ON public.app_state FOR ALL
USING ((select auth.uid()) = id)
WITH CHECK ((select auth.uid()) = id);

-- ── profiles ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can read own profile"                ON public.profiles;
DROP POLICY IF EXISTS "Board members can read co-member profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile"              ON public.profiles;

CREATE POLICY "profiles_select"
ON public.profiles FOR SELECT
USING (
  (id = (select auth.uid()))
  OR is_board_coworker(id)
);

CREATE POLICY "profiles_update"
ON public.profiles FOR UPDATE
USING ((select auth.uid()) = id)
WITH CHECK ((select auth.uid()) = id);

-- ── board_invites ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Invitee sees own invites" ON public.board_invites;
DROP POLICY IF EXISTS "Inviter sees sent invites" ON public.board_invites;

CREATE POLICY "board_invites_select"
ON public.board_invites FOR SELECT
USING (
  invitee_id = (select auth.uid())
  OR inviter_id = (select auth.uid())
);

-- ── board_members ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Owners can manage board memberships" ON public.board_members;
DROP POLICY IF EXISTS "board_members_select"               ON public.board_members;
DROP POLICY IF EXISTS "board_members_insert"               ON public.board_members;
DROP POLICY IF EXISTS "board_members_delete"               ON public.board_members;

CREATE POLICY "board_members_select"
ON public.board_members FOR SELECT
USING (is_board_member(board_id));

CREATE POLICY "board_members_insert"
ON public.board_members FOR INSERT
WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "board_members_delete"
ON public.board_members FOR DELETE
USING (user_id = (select auth.uid()));

-- ── shared_boards ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Owners can delete shared boards" ON public.shared_boards;
DROP POLICY IF EXISTS "Owners can insert shared boards" ON public.shared_boards;
DROP POLICY IF EXISTS "Editors can update shared boards" ON public.shared_boards;

CREATE POLICY "shared_boards_insert"
ON public.shared_boards FOR INSERT
WITH CHECK (owner_id = (select auth.uid()));

CREATE POLICY "shared_boards_update"
ON public.shared_boards FOR UPDATE
USING (can_edit_board(id));

CREATE POLICY "shared_boards_delete"
ON public.shared_boards FOR DELETE
USING (owner_id = (select auth.uid()));

-- ── error_logs ────────────────────────────────────────────────
DROP POLICY IF EXISTS "error_logs_insert" ON public.error_logs;

CREATE POLICY "error_logs_insert"
ON public.error_logs FOR INSERT
TO anon, authenticated
WITH CHECK (
  error_type IS NOT NULL
  AND (
    ((select auth.role()) = 'authenticated' AND (user_id = (select auth.uid()) OR user_id IS NULL))
    OR
    ((select auth.role()) = 'anon' AND user_id IS NULL)
  )
);
