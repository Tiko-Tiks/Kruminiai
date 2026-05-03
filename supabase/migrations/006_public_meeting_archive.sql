-- RPC: get_public_meeting_data
-- Anoniminis prieigos taškas viešam susirinkimo archyvui (/susirinkimai/[id])
CREATE OR REPLACE FUNCTION get_public_meeting_data(p_meeting_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meeting meetings%ROWTYPE;
  v_resolutions JSONB;
  v_attendance JSONB;
BEGIN
  SELECT * INTO v_meeting FROM meetings WHERE id = p_meeting_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'resolution_number', r.resolution_number,
      'title', r.title,
      'description', r.description,
      'status', r.status,
      'is_procedural', r.is_procedural,
      'procedural_type', r.procedural_type,
      'requires_qualified_majority', r.requires_qualified_majority,
      'discussion_text', r.discussion_text,
      'decision_text', r.decision_text,
      'result_for', r.result_for,
      'result_against', r.result_against,
      'result_abstain', r.result_abstain,
      'documents', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', d.id,
            'title', d.title,
            'file_path', d.file_path,
            'file_name', d.file_name,
            'file_size', d.file_size,
            'category', d.category
          ) ORDER BY rd.sort_order, d.title
        )
        FROM resolution_documents rd
        JOIN documents d ON d.id = rd.document_id
        WHERE rd.resolution_id = r.id
      ), '[]'::jsonb)
    ) ORDER BY r.resolution_number
  ) INTO v_resolutions
  FROM resolutions r
  WHERE r.meeting_id = p_meeting_id;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', ma.id,
      'attendance_type', ma.attendance_type,
      'first_name', m.first_name,
      'last_name', m.last_name
    ) ORDER BY m.first_name, m.last_name
  ) INTO v_attendance
  FROM meeting_attendance ma
  JOIN members m ON m.id = ma.member_id
  WHERE ma.meeting_id = p_meeting_id;

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
    'resolutions', COALESCE(v_resolutions, '[]'::jsonb),
    'attendance', COALESCE(v_attendance, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_public_meeting_data(UUID) TO anon, authenticated;

-- Vieša prieiga prie ne-atšauktų susirinkimų sąrašo
CREATE POLICY "Public read non-cancelled meetings"
  ON meetings FOR SELECT TO anon
  USING (status != 'atšauktas');
