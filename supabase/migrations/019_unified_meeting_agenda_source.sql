-- ============================================================================
-- 019_unified_meeting_agenda_source
-- VIENAS DARBOTVARKĖS ŠALTINIS visiems trims vartotojams:
--   • viešas archyvas    /susirinkimai/[id]   → get_public_meeting_data
--   • SMS balsavimas     /balsuoti/[token]    → get_voting_token_data
--   • admin              /admin/susirinkimai/[id] (per Supabase JS klientą)
--
-- Visi gauna resolutions iš to paties helper'io _meeting_resolutions_jsonb,
-- todėl pertvarkius darbotvarkę negali likti drift'o tarp puslapių.
-- ============================================================================

CREATE OR REPLACE FUNCTION public._meeting_resolutions_jsonb(
  p_meeting_id UUID,
  p_only_standard BOOLEAN DEFAULT FALSE
)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    jsonb_agg(
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
      )
      ORDER BY r.resolution_number
    ),
    '[]'::jsonb
  )
  FROM resolutions r
  WHERE r.meeting_id = p_meeting_id
    AND (NOT p_only_standard OR r.is_procedural = FALSE);
$$;

GRANT EXECUTE ON FUNCTION public._meeting_resolutions_jsonb(UUID, BOOLEAN) TO anon, authenticated;

-- ============================================================================
-- get_public_meeting_data — perrašytas, kad agendą imtų iš shared helper'io
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_public_meeting_data(p_meeting_id UUID)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_meeting meetings%ROWTYPE;
  v_attendance JSONB;
BEGIN
  SELECT * INTO v_meeting FROM meetings WHERE id = p_meeting_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

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
    'resolutions', public._meeting_resolutions_jsonb(p_meeting_id, FALSE),
    'attendance', COALESCE(v_attendance, '[]'::jsonb)
  );
END;
$$;

-- ============================================================================
-- get_voting_token_data — taip pat per shared helper'į (su procedural filter)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_voting_token_data(p_token TEXT)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_token meeting_voting_tokens%ROWTYPE;
  v_meeting meetings%ROWTYPE;
  v_member members%ROWTYPE;
BEGIN
  SELECT * INTO v_token FROM meeting_voting_tokens WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'invalid_token');
  END IF;
  IF v_token.voted_at IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'already_voted', 'voted_at', v_token.voted_at);
  END IF;
  IF v_token.expires_at < NOW() THEN
    RETURN jsonb_build_object('error', 'expired');
  END IF;

  SELECT * INTO v_meeting FROM meetings WHERE id = v_token.meeting_id;
  SELECT * INTO v_member FROM members WHERE id = v_token.member_id;

  RETURN jsonb_build_object(
    'meeting', jsonb_build_object(
      'id', v_meeting.id,
      'title', v_meeting.title,
      'description', v_meeting.description,
      'meeting_date', v_meeting.meeting_date,
      'location', v_meeting.location
    ),
    'member', jsonb_build_object(
      'id', v_member.id,
      'first_name', v_member.first_name,
      'last_name', v_member.last_name,
      'email', v_member.email,
      'phone', v_member.phone
    ),
    'resolutions', public._meeting_resolutions_jsonb(v_meeting.id, TRUE),
    'expires_at', v_token.expires_at,
    'live_intent_at', v_token.live_intent_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_meeting_data(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_voting_token_data(TEXT) TO anon, authenticated;
