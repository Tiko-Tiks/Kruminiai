-- SAUGUMO TAISYMAS (auditas 2026-07-20): get_meeting_expulsions_data yra anon-callable
-- (naudojamas /api/salinami balsavimo iframe). Anksčiau grąžindavo phone + email
-- kiekvienam šalinimo kandidatui – tai leisdavo bet kam, turinčiam meeting_id (viešas
-- pagrindiniame puslapyje ir balsavimo nuorodose), ištraukti narių kontaktus (GDPR).
--
-- Duomenų minimizavimas: telefonas/el. paštas nebegrąžinami. Vietoj jų – has_contacts
-- boolean, kad išliktų „nepasiekiamas (neturi kontaktų)" pagrindimo eilutė.
-- Admin srautas (getMeetingExpulsions) naudoja tiesiogines RLS-apsaugotas užklausas,
-- NE šį RPC, tad nepaliečiamas.

CREATE OR REPLACE FUNCTION public.get_meeting_expulsions_data(p_meeting_id uuid)
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
  SELECT * INTO v_meeting FROM meetings WHERE id = p_meeting_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'meeting_not_found'); END IF;

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
