-- Balsavimo modulis – susirinkimai, nutarimai, balsai
-- Pagal KKB įstatus (2025 m. redakcija)

-- Susirinkimai (Meetings)
-- Įstatai 4.1-4.8: VNS yra aukščiausias organas
CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  meeting_date TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  location TEXT NOT NULL DEFAULT 'Beržų g. 8, Krūminių k., Varėnos r.',
  meeting_type TEXT NOT NULL DEFAULT 'visuotinis' CHECK (meeting_type IN ('visuotinis', 'neeilinis', 'pakartotinis', 'valdybos')),
  status TEXT NOT NULL DEFAULT 'planuojamas' CHECK (status IN ('planuojamas', 'registracija', 'vyksta', 'baigtas', 'atšauktas')),

  -- Protokolo duomenys
  protocol_number TEXT,
  chairperson_name TEXT,
  secretary_name TEXT,
  agenda_approved BOOLEAN NOT NULL DEFAULT false,

  -- Kvorumas (4.5: daugiau kaip pusė narių; 4.6: pakartotinis – be kvorumo)
  total_members_at_time INTEGER NOT NULL DEFAULT 0,
  quorum_required INTEGER NOT NULL DEFAULT 0,
  is_repeat BOOLEAN NOT NULL DEFAULT false,

  -- Išankstinis balsavimas (4.4: elektroninėmis ryšio priemonėmis)
  early_voting_start TIMESTAMPTZ,
  early_voting_end TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(id)
);

ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access to meetings" ON meetings FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER meetings_updated_at BEFORE UPDATE ON meetings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Dalyvių registracija (Meeting Attendance)
CREATE TABLE meeting_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  attendance_type TEXT NOT NULL DEFAULT 'fizinis' CHECK (attendance_type IN ('fizinis', 'nuotolinis', 'rastu')),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(meeting_id, member_id)
);

ALTER TABLE meeting_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access to meeting_attendance" ON meeting_attendance FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Darbotvarkės klausimai / Nutarimai (Resolutions)
-- Pirmi 2 klausimai procedūriniai (auto-generuojami):
--   1. Dėl susirinkimo pirmininko ir sekretoriaus rinkimų
--   2. Susirinkimo darbotvarkės tvirtinimas
CREATE TABLE resolutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  resolution_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'projektas' CHECK (status IN ('projektas', 'svarstomas', 'balsuojamas', 'patvirtintas', 'atmestas')),

  -- Tipas
  is_procedural BOOLEAN NOT NULL DEFAULT false,
  procedural_type TEXT CHECK (procedural_type IN ('pirmininkas_sekretorius', 'darbotvarke')),

  -- 4.7: paprasta dauguma vs 2/3 (įstatų keitimas, pertvarkymas, likvidavimas)
  requires_qualified_majority BOOLEAN NOT NULL DEFAULT false,

  -- Protokolui: svarstymo aprašymas ir nutarimo tekstas
  discussion_text TEXT,
  decision_text TEXT,

  -- Išankstinis balsavimas
  early_voting_open BOOLEAN NOT NULL DEFAULT false,

  -- Rezultatai
  result_for INTEGER NOT NULL DEFAULT 0,
  result_against INTEGER NOT NULL DEFAULT 0,
  result_abstain INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES profiles(id)
);

ALTER TABLE resolutions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access to resolutions" ON resolutions FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER resolutions_updated_at BEFORE UPDATE ON resolutions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Balsai (Vote Ballots)
CREATE TABLE vote_ballots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resolution_id UUID NOT NULL REFERENCES resolutions(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  vote TEXT NOT NULL CHECK (vote IN ('uz', 'pries', 'susilaike')),
  vote_type TEXT NOT NULL DEFAULT 'fizinis' CHECK (vote_type IN ('fizinis', 'isankstinis', 'rastu')),
  voted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by UUID REFERENCES profiles(id),
  UNIQUE(resolution_id, member_id)
);

ALTER TABLE vote_ballots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access to vote_ballots" ON vote_ballots FOR ALL TO authenticated USING (true) WITH CHECK (true);
