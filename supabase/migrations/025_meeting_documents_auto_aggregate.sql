-- Automatinis dokumentų agregavimas iš dviejų šaltinių:
-- 1) documents.meeting_id – tiesiogiai priskirti susirinkimui (signed PDF'ai)
-- 2) resolution_documents → resolutions → meetings – prikabinti prie nutarimų
--    (veiklos ataskaita, finansinis rinkinys, veiklos planai jau yra ten)
--
-- Anksčiau admin'ui reikėjo įkelti tuos pačius dokumentus DU kartus:
-- vieną kartą prie nutarimo, kitą prie meeting'o. Dabar viskas automatiškai.

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
