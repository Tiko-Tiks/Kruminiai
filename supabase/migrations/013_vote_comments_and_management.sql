-- ============================================================================
-- 013_vote_comments_and_management
-- 1) Pridėti 'comment' lauką į vote_ballots
-- 2) Sukurti community_management lentelę
-- ============================================================================

ALTER TABLE public.vote_ballots
  ADD COLUMN IF NOT EXISTS comment TEXT;

COMMENT ON COLUMN public.vote_ballots.comment IS
  'Pasisakymas / nuomonė prie balso (neprivaloma).';

CREATE TABLE IF NOT EXISTS public.community_management (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id    UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  role         TEXT NOT NULL CHECK (role IN ('pirmininkas','tarybos_narys','revizorius')),
  term_start   DATE,
  term_end     DATE,
  is_current   BOOLEAN NOT NULL DEFAULT true,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (member_id, role, term_start)
);

CREATE INDEX IF NOT EXISTS idx_community_management_current
  ON public.community_management (role, sort_order) WHERE is_current = true;

ALTER TABLE public.community_management ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_read_management" ON public.community_management;
CREATE POLICY "members_read_management"
ON public.community_management FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admins_write_management" ON public.community_management;
CREATE POLICY "admins_write_management"
ON public.community_management FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','super_admin')))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','super_admin')));

COMMENT ON TABLE public.community_management IS
  'Dabartiniai ir buvę bendruomenės valdymo organų nariai.';
