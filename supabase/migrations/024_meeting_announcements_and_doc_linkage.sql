-- Susirinkimo skelbimų sekimas + dokumentų priskyrimas susirinkimui.
-- Pagrindas:
--   • LR Asociacijų įstatymo 8 str. – susirinkimai šaukiami pagal įstatus
--   • Įstatai nustato min. iš anksto pranešimo terminą (tipiškai 14 d.)
--   • Protokole turi būti įrodymas, kad pranešimas paskelbtas tinkamai
--
-- meeting_announcements lentelė saugo skelbimų istoriją: kokiame kanale
-- (kruminiai.lt, Facebook, el. paštas, SMS), kada paskelbta, ir URL į
-- originalų skelbimą (FB post'as, naujienos straipsnis).
--
-- documents.meeting_id FK leidžia organizuoti dokumentus pagal susirinkimus
-- (kiekvienas susirinkimas = „papkė" /dokumentai puslapyje).

-- 1) meeting_announcements lentelė
CREATE TABLE IF NOT EXISTS meeting_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN (
    'web',       -- kruminiai.lt svetainė (naujienos straipsnis)
    'facebook',  -- Facebook puslapio post'as
    'email',     -- masinis el. laiškas nariams
    'sms',       -- masinis SMS
    'paper',     -- skelbimas skelbimų lentoje / paštu
    'other'      -- kitas kanalas
  )),
  url TEXT NULL,                       -- nuoroda į originalų skelbimą
  published_at TIMESTAMPTZ NOT NULL,   -- paskelbimo data ir laikas
  notes TEXT NULL,                     -- papildomi komentarai admin'ui
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_meeting_announcements_meeting_id
  ON meeting_announcements(meeting_id);

-- 2) documents.meeting_id – susiejimas su susirinkimu (nullable, nes ne visi
--    dokumentai priklauso susirinkimui – pvz., įstatai, sutartys)
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS meeting_id UUID NULL REFERENCES meetings(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_documents_meeting_id ON documents(meeting_id);

-- 3) RLS politikos
ALTER TABLE meeting_announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meeting_announcements_public_read" ON meeting_announcements;
CREATE POLICY "meeting_announcements_public_read"
  ON meeting_announcements FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "meeting_announcements_admin_write" ON meeting_announcements;
CREATE POLICY "meeting_announcements_admin_write"
  ON meeting_announcements FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'super_admin')
    )
  );

-- 4) Atnaujinam get_public_meeting_data RPC – įtraukiam skelbimus ir
--    meeting_documents į susirinkimo archyvą.
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

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', d.id,
      'title', d.title,
      'file_path', d.file_path,
      'file_size', d.file_size,
      'category', d.category
    ) ORDER BY d.published_at DESC NULLS LAST
  ) INTO v_documents
  FROM documents d
  WHERE d.meeting_id = p_meeting_id
    AND d.is_public = TRUE;

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
