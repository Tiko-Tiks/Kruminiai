-- 045: Susirinkimo matomumo vėliavėlė – `meetings.is_published`
--
-- KODĖL: 2026-09-13 Tarybos posėdis turėjo likti vidinis, bet buvo pasiekiamas
-- VIEŠAI. Puslapis /susirinkimai yra už middleware, tačiau duomenys – ne:
--   • `meetings` RLS anon politika leido `status <> 'atšauktas'`, todėl bet kas
--     su viešu anon raktu galėjo išvardyti visų posėdžių pavadinimus ir datas;
--   • `get_public_meeting_data` (anon EXECUTE) pagal meeting_id grąžindavo
--     PILNĄ darbotvarkę su nutarimais.
--
-- SPRENDIMAS: viena vėliavėlė. `is_published = false` – susirinkimą mato TIK
-- administratorius (nei anon, nei prisijungęs narys).
--
-- NUMATYTOJI reikšmė – `true`, todėl VISŲ kitų susirinkimų elgsena nesikeičia.
-- Paslepiamas tik konkretus įrašas; paskelbti atgal – vienas UPDATE.

ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.meetings.is_published IS
  'Ar susirinkimas matomas už admin panelės ribų. FALSE – mato tik administratorius (nei anon, nei narys).';

-- ---------------------------------------------------------------------------
-- RLS: anon ir nariai mato tik paskelbtus.
-- Administratoriui prieiga lieka per `meetings_admin_all` (ALL, is_admin()),
-- todėl atskiros admin išimties čia nereikia.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read non-cancelled meetings" ON public.meetings;
CREATE POLICY "Public read published meetings" ON public.meetings
  FOR SELECT TO anon
  USING (status <> 'atšauktas' AND is_published);

DROP POLICY IF EXISTS meetings_select_authenticated ON public.meetings;
CREATE POLICY meetings_select_authenticated ON public.meetings
  FOR SELECT TO authenticated
  USING (status <> 'atšauktas' AND is_published);

-- ---------------------------------------------------------------------------
-- Nutarimai ir jų dokumentai seka susirinkimą: paslėpus susirinkimą, jo
-- darbotvarkė neturi likti pasiekiama tiesiogine užklausa.
--
-- EXISTS užklausai galioja `meetings` RLS, todėl nepaskelbto susirinkimo
-- eilutė čia nematoma ir sąlyga savaime tampa FALSE. Admin'ui `meetings_admin_all`
-- eilutę atiduoda, todėl jam viskas lieka matoma.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS resolutions_select_authenticated ON public.resolutions;
CREATE POLICY resolutions_select_authenticated ON public.resolutions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.meetings m WHERE m.id = resolutions.meeting_id));

DROP POLICY IF EXISTS resolution_documents_select_authenticated ON public.resolution_documents;
CREATE POLICY resolution_documents_select_authenticated ON public.resolution_documents
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.resolutions r
    WHERE r.id = resolution_documents.resolution_id
  ));

-- ---------------------------------------------------------------------------
-- `get_public_meeting_data` yra SECURITY DEFINER, todėl RLS jo nestabdo –
-- vėliavėlę tikrinam viduje. Be šito nepaskelbtas susirinkimas liktų
-- pasiekiamas anon raktu, jei kas nors žinotų meeting_id.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_meeting_data(p_meeting_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_meeting meetings%ROWTYPE;
  v_attendance JSONB;
  v_announcements JSONB;
  v_documents JSONB;
BEGIN
  SELECT * INTO v_meeting FROM meetings WHERE id = p_meeting_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  -- Nepaskelbtas susirinkimas neegzistuoja niekam, išskyrus administratorių.
  -- Grąžinam būtent 'not_found', o ne 'forbidden': kitaip atsakymas patvirtintų,
  -- kad toks susirinkimas yra.
  IF NOT v_meeting.is_published AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object('id', ma.id, 'attendance_type', ma.attendance_type)
    ORDER BY ma.id
  ) INTO v_attendance
  FROM meeting_attendance ma
  WHERE ma.meeting_id = p_meeting_id;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', a.id,
      'channel', a.channel,
      'url', a.url,
      'published_at', a.published_at,
      'notes', a.notes
    ) ORDER BY a.published_at ASC
  ) INTO v_announcements
  FROM meeting_announcements a
  WHERE a.meeting_id = p_meeting_id;

  -- UNION dviejų šaltinių, DISTINCT pagal documents.id, kad nedublikuotųsi
  -- jei dokumentas yra ir tiesiogiai priskirtas, ir per resolution.
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', d.id,
      'title', d.title,
      'file_path', d.file_path,
      'file_size', d.file_size,
      'category', d.category,
      'source', d.source
    ) ORDER BY d.published_at DESC NULLS LAST, d.title ASC
  ) INTO v_documents
  FROM (
    -- Source 1: direct meeting attachment (signed post-meeting docs)
    SELECT DISTINCT
      d.id, d.title, d.file_path, d.file_size, d.category, d.published_at,
      'meeting' AS source
    FROM documents d
    WHERE d.meeting_id = p_meeting_id
      AND d.is_public = TRUE

    UNION

    -- Source 2: attached via resolutions (pre-meeting agenda docs)
    SELECT DISTINCT
      d.id, d.title, d.file_path, d.file_size, d.category, d.published_at,
      'resolution' AS source
    FROM documents d
    JOIN resolution_documents rd ON rd.document_id = d.id
    JOIN resolutions r ON r.id = rd.resolution_id
    WHERE r.meeting_id = p_meeting_id
      AND d.is_public = TRUE
      -- jei jau yra meeting-level, neimam dublikato per resolution
      AND NOT EXISTS (
        SELECT 1 FROM documents d2
        WHERE d2.id = d.id AND d2.meeting_id = p_meeting_id
      )
  ) d;

  RETURN jsonb_build_object(
    'meeting', jsonb_build_object(
      'id', v_meeting.id,
      'title', v_meeting.title,
      'description', v_meeting.description,
      'meeting_date', v_meeting.meeting_date,
      'ended_at', v_meeting.ended_at,
      'location', v_meeting.location,
      'meeting_type', v_meeting.meeting_type,
      'status', v_meeting.status,
      'protocol_number', v_meeting.protocol_number,
      'chairperson_name', v_meeting.chairperson_name,
      'secretary_name', v_meeting.secretary_name,
      'total_members_at_time', v_meeting.total_members_at_time,
      'quorum_required', v_meeting.quorum_required
    ),
    'resolutions', public._meeting_resolutions_jsonb(p_meeting_id, FALSE),
    'attendance', COALESCE(v_attendance, '[]'::jsonb),
    'announcements', COALESCE(v_announcements, '[]'::jsonb),
    'meeting_documents', COALESCE(v_documents, '[]'::jsonb)
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- Paslepiamas TIK 2026-09-13 Tarybos posėdis. Kiti susirinkimai lieka `true`.
-- Paskelbti atgal:
--   UPDATE public.meetings SET is_published = TRUE WHERE id = '20e34071-…';
-- ---------------------------------------------------------------------------
UPDATE public.meetings
SET is_published = FALSE
WHERE id = '20e34071-e2ce-42f1-901a-5651baf133e6';
