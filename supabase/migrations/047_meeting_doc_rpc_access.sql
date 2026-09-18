-- ============================================================================
-- 047: Susirinkimo dokumentų RPC – prieigos patikra funkcijos viduje
--
-- KODĖL: `get_meeting_plan_data`, `get_meeting_expulsions_data` ir
-- `get_meeting_elections_data` yra SECURITY DEFINER (apeina RLS) ir anon-callable,
-- o viduje tikrindavo tik tai, ar susirinkimas egzistuoja. Prieigos taisyklė
-- gyveno TIK Next.js route'uose (`canViewMeetingDoc`, migr. 034), todėl ta pati
-- funkcija per PostgREST elgdavosi kitaip nei per svetainę. Taisyklė turi būti
-- ten, kur yra duomenys.
--
-- NUO ŠIOL kiekviena iš trijų funkcijų pati reikalauja vienos iš dviejų sąlygų:
--   (a) prisijungęs PATVIRTINTAS narys arba administratorius, ARBA
--   (b) galiojantis BALSAVIMO tokenas būtent tam susirinkimui (naujas
--       neprivalomas parametras `p_token`; tokeno galiojimą tikrina
--       `voting_token_meeting()`, žr. migr. 046).
--
-- Nepaskelbtas (`is_published = false`) susirinkimas ne-administratoriui
-- atsako lygiai taip pat kaip neegzistuojantis (`meeting_not_found`) – kad
-- atsakymas nepatvirtintų jo egzistavimo.
--
-- SIGNATŪROS KEITIMAS: senos vieno argumento versijos DROP'inamos, o ne
-- paliekamos šalia – kitaip be patikros likusi perkrova toliau būtų kviečiama.
-- Naujosios turi `DEFAULT NULL`, todėl senas vieno argumento kvietimas ir
-- toliau veikia (tik be tokeno, t. y. reikalauja sesijos).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Bendras vidinis vartų helper'is – VIENAS šaltinis visoms trims funkcijoms
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._can_view_meeting_doc(p_meeting_id uuid, p_token text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    public.is_admin()
    OR public.is_approved_member()
    OR (
      p_token IS NOT NULL
      AND p_meeting_id IS NOT NULL
      AND public.voting_token_meeting(p_token) = p_meeting_id
    );
$function$;

REVOKE ALL ON FUNCTION public._can_view_meeting_doc(uuid, text) FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 1) Veiklos planas
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_meeting_plan_data(uuid);

CREATE OR REPLACE FUNCTION public.get_meeting_plan_data(
  p_meeting_id uuid,
  p_token text DEFAULT NULL
)
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
  IF NOT public._can_view_meeting_doc(p_meeting_id, p_token) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT * INTO v_meeting FROM meetings WHERE id = p_meeting_id;
  IF NOT FOUND OR (NOT v_meeting.is_published AND NOT public.is_admin()) THEN
    RETURN jsonb_build_object('error', 'meeting_not_found');
  END IF;

  v_year := EXTRACT(YEAR FROM v_meeting.meeting_date)::INT;

  SELECT COUNT(*) INTO v_member_count
  FROM members
  WHERE public.is_voting_status(status);

  SELECT COALESCE(SUM(p.amount_cents), 0), COUNT(*)
  INTO v_collected_cents, v_paid_count
  FROM payments p
  JOIN fee_periods fp ON fp.id = p.fee_period_id
  WHERE fp.fee_type = 'metinis' AND fp.year = v_year;

  WITH metiniai AS (SELECT id, year, amount_cents FROM fee_periods WHERE fee_type='metinis'),
  unpaid AS (
    SELECT fp.year, m.id, fp.amount_cents
    FROM members m
    CROSS JOIN metiniai fp
    WHERE m.status IN ('aktyvus','pasyvus')
      AND fp.year >= EXTRACT(YEAR FROM COALESCE(m.join_date,'2012-01-01'::date))
      AND NOT EXISTS (
        SELECT 1 FROM payments p WHERE p.member_id = m.id AND p.fee_period_id = fp.id
      )
  )
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object(
      'year', year, 'count', cnt, 'eur', total/100.0
    ) ORDER BY year), '[]'::jsonb),
    COALESCE(SUM(total), 0)
  INTO v_debt_rows, v_total_debt_cents
  FROM (
    SELECT year, COUNT(*) AS cnt, SUM(amount_cents) AS total
    FROM unpaid
    GROUP BY year
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

REVOKE ALL ON FUNCTION public.get_meeting_plan_data(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_meeting_plan_data(uuid, text) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2) Šalinamų narių sąrašas (duomenų minimizavimas iš migr. 033 išlieka)
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_meeting_expulsions_data(uuid);

CREATE OR REPLACE FUNCTION public.get_meeting_expulsions_data(
  p_meeting_id uuid,
  p_token text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_meeting meetings%ROWTYPE;
  v_year INT;
  v_year_start TIMESTAMPTZ;
  v_candidates JSONB;
BEGIN
  IF NOT public._can_view_meeting_doc(p_meeting_id, p_token) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT * INTO v_meeting FROM meetings WHERE id = p_meeting_id;
  IF NOT FOUND OR (NOT v_meeting.is_published AND NOT public.is_admin()) THEN
    RETURN jsonb_build_object('error', 'meeting_not_found');
  END IF;

  v_year := EXTRACT(YEAR FROM v_meeting.meeting_date)::INT;
  v_year_start := (v_year || '-01-01')::TIMESTAMPTZ;

  WITH cands AS (
    SELECT
      me.id,
      me.member_id,
      me.debt_cents,
      me.debt_years,
      me.reason,
      me.sort_order,
      m.first_name,
      m.last_name,
      -- SAUGUMAS: neatskleidžiam telefono/el. pašto; tik ar narys apskritai
      -- turi kontaktų (pagrindimui „nepasiekiamas")
      (m.phone IS NOT NULL OR m.email IS NOT NULL) AS has_contacts
    FROM meeting_expulsions me
    LEFT JOIN members m ON m.id = me.member_id
    WHERE me.meeting_id = p_meeting_id
  ),
  notif AS (
    SELECT
      n.member_id,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'sent_at', n.sent_at,
            'channel', n.channel,
            'kind', n.kind,
            'status', n.status
          )
          ORDER BY n.sent_at
        ),
        '[]'::jsonb
      ) AS events
    FROM notification_log n
    WHERE n.member_id IN (SELECT member_id FROM cands)
      AND n.sent_at >= v_year_start
    GROUP BY n.member_id
  ),
  decls AS (
    SELECT
      d.member_id,
      jsonb_build_object(
        'sent_at', d.sent_at,
        'viewed_at', d.viewed_at,
        'view_count', d.view_count,
        'submitted_at', d.submitted_at,
        'intent', d.intent
      ) AS decl
    FROM membership_declarations d
    WHERE d.member_id IN (SELECT member_id FROM cands)
  ),
  roles AS (
    SELECT
      cm.member_id,
      jsonb_agg(cm.role) AS role_list
    FROM community_management cm
    WHERE cm.is_current = true
      AND cm.member_id IN (SELECT member_id FROM cands)
    GROUP BY cm.member_id
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'member_id', c.member_id,
        'debt_cents', c.debt_cents,
        'debt_years', c.debt_years,
        'reason', c.reason,
        'first_name', c.first_name,
        'last_name', c.last_name,
        'has_contacts', c.has_contacts,
        'events', COALESCE(n.events, '[]'::jsonb),
        'declaration', d.decl,
        'roles', COALESCE(r.role_list, '[]'::jsonb)
      )
      ORDER BY c.sort_order
    ),
    '[]'::jsonb
  )
  INTO v_candidates
  FROM cands c
  LEFT JOIN notif n ON n.member_id = c.member_id
  LEFT JOIN decls d ON d.member_id = c.member_id
  LEFT JOIN roles r ON r.member_id = c.member_id;

  RETURN jsonb_build_object(
    'meeting_id', v_meeting.id,
    'meeting_title', v_meeting.title,
    'meeting_date', v_meeting.meeting_date,
    'year', v_year,
    'candidates', v_candidates
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_meeting_expulsions_data(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_meeting_expulsions_data(uuid, text) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3) Rinkimų pranešimas
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_meeting_elections_data(uuid);

CREATE OR REPLACE FUNCTION public.get_meeting_elections_data(
  p_meeting_id uuid,
  p_token text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_meeting meetings%ROWTYPE;
  v_roles JSONB;
BEGIN
  IF NOT public._can_view_meeting_doc(p_meeting_id, p_token) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT * INTO v_meeting FROM meetings WHERE id = p_meeting_id;
  IF NOT FOUND OR (NOT v_meeting.is_published AND NOT public.is_admin()) THEN
    RETURN jsonb_build_object('error', 'meeting_not_found');
  END IF;

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

REVOKE ALL ON FUNCTION public.get_meeting_elections_data(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_meeting_elections_data(uuid, text) TO anon, authenticated;
