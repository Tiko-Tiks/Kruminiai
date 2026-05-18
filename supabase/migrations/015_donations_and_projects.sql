-- ============================================================================
-- 015_donations_and_projects
-- Lėšų rinkimo projektai + viešai matomos aukos (pradedant nuo liepto)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.fundraising_projects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE NOT NULL,
  title         TEXT NOT NULL,
  short_desc    TEXT,
  story_md      TEXT,
  goal_cents    INTEGER NOT NULL DEFAULT 0,
  iban          TEXT NOT NULL,
  recipient     TEXT NOT NULL,
  purpose_text  TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  is_public     BOOLEAN NOT NULL DEFAULT true,
  hero_image    TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.donations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES public.fundraising_projects(id) ON DELETE CASCADE,
  donor_name    TEXT,
  amount_cents  INTEGER NOT NULL CHECK (amount_cents > 0),
  method        TEXT NOT NULL CHECK (method IN ('sepa','cash','card','other')),
  donated_at    DATE NOT NULL,
  is_anonymous  BOOLEAN NOT NULL DEFAULT false,
  donor_message TEXT,
  external_ref  TEXT,
  source_note   TEXT,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_donations_project_date
  ON public.donations (project_id, donated_at DESC);

ALTER TABLE public.fundraising_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_projects" ON public.fundraising_projects;
CREATE POLICY "public_read_projects"
ON public.fundraising_projects FOR SELECT TO anon, authenticated
USING (is_public = true);

DROP POLICY IF EXISTS "public_read_donations" ON public.donations;
CREATE POLICY "public_read_donations"
ON public.donations FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.fundraising_projects p WHERE p.id = donations.project_id AND p.is_public = true));

DROP POLICY IF EXISTS "admins_write_projects" ON public.fundraising_projects;
CREATE POLICY "admins_write_projects"
ON public.fundraising_projects FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','super_admin')))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','super_admin')));

DROP POLICY IF EXISTS "admins_write_donations" ON public.donations;
CREATE POLICY "admins_write_donations"
ON public.donations FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','super_admin')))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','super_admin')));
