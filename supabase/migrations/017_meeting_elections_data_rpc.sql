-- ============================================================================
-- 017_meeting_elections_data_rpc
-- RPC rinkimų pranešimo dokumentui – grąžina dabartinius valdymo organus.
-- SECURITY DEFINER – veikia anon kontekste (per balsavimo iframe).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_meeting_elections_data(p_meeting_id UUID)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_meeting meetings%ROWTYPE;
  v_roles JSONB;
BEGIN
  SELECT * INTO v_meeting FROM meetings WHERE id = p_meeting_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'meeting_not_found'); END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'role', cm.role,
        'term_start', cm.term_start,
        'term_end', cm.term_end,
        'sort_order', cm.sort_order,
        'first_name', m.first_name,
        'last_name', m.last_name
      )
      ORDER BY cm.role, cm.sort_order
    ),
    '[]'::jsonb
  )
  INTO v_roles
  FROM community_management cm
  LEFT JOIN members m ON m.id = cm.member_id
  WHERE cm.is_current = true;

  RETURN jsonb_build_object(
    'meeting_id', v_meeting.id,
    'meeting_title', v_meeting.title,
    'meeting_date', v_meeting.meeting_date,
    'chairperson_name', v_meeting.chairperson_name,
    'roles', v_roles
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_meeting_elections_data(UUID) TO anon, authenticated;
