-- ============================================================================
-- 031_project_progress
-- II etapas: statybų eigos įrašai (su nuotraukomis) + viešai matomos išlaidos
-- Aukos surinktos su pertekliumi – dabar bendruomenė stebi, kaip lėšos
-- naudojamos: kiekvienas darbų etapas su nuotraukomis ir kiekviena išlaida.
-- ============================================================================

-- Statybų eigos įrašai (timeline su nuotraukomis)
CREATE TABLE IF NOT EXISTS public.project_updates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES public.fundraising_projects(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  body         TEXT,
  update_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  -- JSONB masyvas storage kelių images bucket'e, pvz. ["projektai/lieptas/....jpg"]
  photos       JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_updates_project_date
  ON public.project_updates (project_id, update_date DESC);

-- Projekto išlaidos (skaidrumui – viešai matomos)
CREATE TABLE IF NOT EXISTS public.project_expenses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES public.fundraising_projects(id) ON DELETE CASCADE,
  description  TEXT NOT NULL,
  supplier     TEXT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  expense_date DATE NOT NULL,
  receipt_ref  TEXT,
  note         TEXT,
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_expenses_project_date
  ON public.project_expenses (project_id, expense_date DESC);

ALTER TABLE public.project_updates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_expenses ENABLE ROW LEVEL SECURITY;

-- Viešas skaitymas: tik publikuoti įrašai viešų projektų
DROP POLICY IF EXISTS "public_read_project_updates" ON public.project_updates;
CREATE POLICY "public_read_project_updates"
ON public.project_updates FOR SELECT TO anon, authenticated
USING (
  is_published = true
  AND EXISTS (
    SELECT 1 FROM public.fundraising_projects p
    WHERE p.id = project_updates.project_id AND p.is_public = true
  )
);

-- Viešas skaitymas: visos viešų projektų išlaidos (skaidrumas)
DROP POLICY IF EXISTS "public_read_project_expenses" ON public.project_expenses;
CREATE POLICY "public_read_project_expenses"
ON public.project_expenses FOR SELECT TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.fundraising_projects p
    WHERE p.id = project_expenses.project_id AND p.is_public = true
  )
);

-- Rašo (ir mato nepublikuotus) tik admin – per is_admin() (migracija 028)
DROP POLICY IF EXISTS "admins_all_project_updates" ON public.project_updates;
CREATE POLICY "admins_all_project_updates"
ON public.project_updates FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins_all_project_expenses" ON public.project_expenses;
CREATE POLICY "admins_all_project_expenses"
ON public.project_expenses FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
