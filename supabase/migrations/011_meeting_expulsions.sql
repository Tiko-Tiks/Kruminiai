-- ============================================================================
-- 011_meeting_expulsions
-- Konkrečiam susirinkimui priklausantis šalinamų narių sąrašas.
-- Naudojamas Tarybos sprendimui apie šalinimą paskelbti per visuotinį.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.meeting_expulsions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id      UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  member_id       UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  debt_cents      INTEGER NOT NULL,
  debt_years      TEXT NOT NULL,        -- pvz. "2024, 2025, 2026"
  reason          TEXT,                 -- laisva pastaba
  sort_order      INTEGER NOT NULL DEFAULT 0,
  added_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (meeting_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_meeting_expulsions_meeting
  ON public.meeting_expulsions (meeting_id, sort_order);

ALTER TABLE public.meeting_expulsions ENABLE ROW LEVEL SECURITY;

-- Skaityti gali aktyvūs nariai + adminai
DROP POLICY IF EXISTS "members_read_expulsions" ON public.meeting_expulsions;
CREATE POLICY "members_read_expulsions"
ON public.meeting_expulsions
FOR SELECT
TO authenticated
USING (true);

-- Rašyti tik adminai
DROP POLICY IF EXISTS "admins_write_expulsions" ON public.meeting_expulsions;
CREATE POLICY "admins_write_expulsions"
ON public.meeting_expulsions
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','super_admin'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','super_admin'))
);

COMMENT ON TABLE public.meeting_expulsions IS
  'Tarybos sprendimu šalinamų narių sąrašas, susiejamas su konkrečiu visuotiniu susirinkimu.';
