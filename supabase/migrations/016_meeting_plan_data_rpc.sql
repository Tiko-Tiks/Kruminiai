-- ============================================================================
-- 016_meeting_plan_data_rpc
-- RPC veiklos plano dokumento agreguotiems duomenims.
-- SECURITY DEFINER – veikia anon kontekste (per balsavimo iframe).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_meeting_plan_data(p_meeting_id UUID)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_meeting meetings%ROWTYPE;
  v_year INT;
  v_member_count INT;
  v_collected_cents INT;
  v_paid_count INT;
  v_debt_rows JSONB;
  v_total_debt_cents INT;
BEGIN
  SELECT * INTO v_meeting FROM meetings WHERE id = p_meeting_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'meeting_not_found'); END IF;

  v_year := EXTRACT(YEAR FROM v_meeting.meeting_date)::INT;

  SELECT COUNT(*) INTO v_member_count
  FROM members WHERE status IN ('aktyvus','pasyvus');

  SELECT COALESCE(SUM(p.amount_cents), 0), COUNT(*)
  INTO v_collected_cents, v_paid_count
  FROM payments p
  JOIN fee_periods fp ON fp.id = p.fee_period_id
  WHERE fp.fee_type = 'metinis' AND fp.year = v_year;

  WITH metiniai AS (SELECT id, year, amount_cents FROM fee_periods WHERE fee_type='metinis'),
  unpaid AS (
    SELECT fp.year, m.id, fp.amount_cents
    FROM members m CROSS JOIN metiniai fp
    WHERE m.status IN ('aktyvus','pasyvus')
      AND fp.year >= EXTRACT(YEAR FROM COALESCE(m.join_date,'2012-01-01'::date))
      AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.member_id = m.id AND p.fee_period_id = fp.id)
  )
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object('year', year, 'count', cnt, 'eur', total/100.0) ORDER BY year), '[]'::jsonb),
    COALESCE(SUM(total), 0)
  INTO v_debt_rows, v_total_debt_cents
  FROM (
    SELECT year, COUNT(*) AS cnt, SUM(amount_cents) AS total
    FROM unpaid GROUP BY year
  ) t;

  RETURN jsonb_build_object(
    'meeting_id', v_meeting.id,
    'meeting_date', v_meeting.meeting_date,
    'year', v_year,
    'member_count', v_member_count,
    'collected_cents', v_collected_cents,
    'paid_count', v_paid_count,
    'debt_rows', v_debt_rows,
    'total_debt_cents', v_total_debt_cents
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_meeting_plan_data(UUID) TO anon, authenticated;
