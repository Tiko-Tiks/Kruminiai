-- Anonimizuojam viešo susirinkimo archyvo dalyvių sąrašą.
-- Pagal GDPR ir balsavimo slaptumo principą – pavardės nebūna grąžinamos
-- į /susirinkimai/[id] viešą puslapį ar /portalas/susirinkimai/[id].
-- Vardai/pavardės lieka TIK pasirašytame dalyvių sąrašo PDF
-- (oficialus protokolo priedas, prieinamas tik per /dokumentai authorized
-- nariams) ir admin srityje pilnam susirinkimo valdymui.
CREATE OR REPLACE FUNCTION public.get_public_meeting_data(p_meeting_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_meeting meetings%ROWTYPE;
  v_attendance JSONB;
BEGIN
  SELECT * INTO v_meeting FROM meetings WHERE id = p_meeting_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  -- TIK attendance_type'ai – be vardų, pavardžių, member_id.
  -- UI gali skaičiuoti iš masyvo (length + filter pagal type).
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', ma.id,
      'attendance_type', ma.attendance_type
    ) ORDER BY ma.id
  ) INTO v_attendance
  FROM meeting_attendance ma
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
$function$;
