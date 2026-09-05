-- 042: GARBĖS NARYS TURI PILNAS BALSAVIMO TEISES
--
-- Pakeista pradinė prielaida (migr. 036–041): garbės narys balsuoja LYGIAI
-- taip pat kaip įprastas narys – portale, per SMS nuorodą ir gyvai; jis
-- įskaičiuojamas į kvorumą ir bendrą narių skaičių.
--
-- Vienintelis skirtumas lieka **nario mokestis**: garbės nariui stojamasis ir
-- metinis mokestis netaikomi, todėl jis neįtraukiamas į skolų skaičiavimus,
-- mokesčių priminimus, narystės deklaracijas (siunčiamos skolingiems),
-- šalinimo už nemokėjimą sąrašus ir skaidrumo mokesčių statistiką.
--
-- Balso teisės statusų VIENAS šaltinis – `public.is_voting_status()`.
-- Balso teisės NETURI tik `išstojęs`.

CREATE OR REPLACE FUNCTION public.is_voting_status(p_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $function$
  SELECT p_status IN ('aktyvus', 'pasyvus', 'garbes_narys');
$function$;

COMMENT ON FUNCTION public.is_voting_status(text) IS
  'Balso teisę turintys members.status (garbės narys – kaip įprastas narys). Nario mokesčio prievolei naudoti IN (''aktyvus'',''pasyvus'').';

REVOKE EXECUTE ON FUNCTION public.is_voting_status(text) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. cast_votes_as_member – balso teisė per helper'į
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cast_votes_as_member(p_meeting_id uuid, p_votes jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_member_id UUID;
  v_member_status TEXT;
  v_meeting meetings%ROWTYPE;
  v_vote JSONB;
  v_resolution_id UUID;
  v_choice TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT member_id INTO v_member_id FROM profiles WHERE id = v_user_id;
  IF v_member_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_member_link');
  END IF;

  -- FOR UPDATE serializuoja su statuso keitimu (migr. 040)
  SELECT status INTO v_member_status FROM members WHERE id = v_member_id FOR UPDATE;
  IF NOT public.is_voting_status(v_member_status) THEN
    RETURN jsonb_build_object('error', 'not_eligible');
  END IF;

  SELECT * INTO v_meeting FROM meetings WHERE id = p_meeting_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'meeting_not_found');
  END IF;
  IF v_meeting.status IN ('baigtas', 'atšauktas')
     OR NOW() >= v_meeting.meeting_date
     OR (v_meeting.early_voting_start IS NOT NULL AND NOW() < v_meeting.early_voting_start)
     OR (v_meeting.early_voting_end IS NOT NULL AND NOW() > v_meeting.early_voting_end)
  THEN
    RETURN jsonb_build_object('error', 'voting_closed');
  END IF;

  IF public._is_complete_ballot(p_meeting_id, p_votes) IS NOT TRUE THEN
    RETURN jsonb_build_object('error', 'incomplete_ballot');
  END IF;

  IF EXISTS (
    SELECT 1 FROM vote_ballots vb
    JOIN resolutions r ON r.id = vb.resolution_id
    WHERE r.meeting_id = p_meeting_id AND vb.member_id = v_member_id
  ) THEN
    RETURN jsonb_build_object('error', 'already_voted');
  END IF;

  FOR v_vote IN SELECT * FROM jsonb_array_elements(p_votes)
  LOOP
    v_resolution_id := (v_vote->>'resolution_id')::UUID;
    v_choice := v_vote->>'vote';

    IF v_choice NOT IN ('uz', 'pries', 'susilaike') THEN
      RAISE EXCEPTION 'Negaliojantis balsas: %', v_choice;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM resolutions
      WHERE id = v_resolution_id AND meeting_id = p_meeting_id AND is_procedural = FALSE
    ) THEN
      RAISE EXCEPTION 'Klausimas nepriklauso šiam susirinkimui';
    END IF;

    INSERT INTO vote_ballots (resolution_id, member_id, vote, vote_type)
    VALUES (v_resolution_id, v_member_id, v_choice, 'isankstinis');
  END LOOP;

  INSERT INTO meeting_attendance (meeting_id, member_id, attendance_type)
  VALUES (p_meeting_id, v_member_id, 'nuotolinis')
  ON CONFLICT (meeting_id, member_id) DO NOTHING;

  UPDATE resolutions r
  SET
    result_for = (SELECT count(*) FROM vote_ballots WHERE resolution_id = r.id AND vote = 'uz'),
    result_against = (SELECT count(*) FROM vote_ballots WHERE resolution_id = r.id AND vote = 'pries'),
    result_abstain = (SELECT count(*) FROM vote_ballots WHERE resolution_id = r.id AND vote = 'susilaike')
  WHERE r.meeting_id = p_meeting_id
    AND r.id IN (SELECT (v->>'resolution_id')::UUID FROM jsonb_array_elements(p_votes) v);

  UPDATE meeting_voting_tokens
  SET voted_at = NOW()
  WHERE meeting_id = p_meeting_id AND member_id = v_member_id AND voted_at IS NULL;

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- ---------------------------------------------------------------------------
-- 2. cast_votes_with_token – balso teisė per helper'į
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cast_votes_with_token(p_token text, p_email text, p_phone text, p_votes jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_token meeting_voting_tokens%ROWTYPE;
  v_meeting meetings%ROWTYPE;
  v_member_id UUID;
  v_member_status TEXT;
  v_vote JSONB;
  v_resolution_id UUID;
  v_choice TEXT;
  v_comment TEXT;
  v_meeting_id UUID;
BEGIN
  -- Užraktų tvarka: members → meeting_voting_tokens (migr. 040)
  SELECT member_id INTO v_member_id FROM meeting_voting_tokens WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'invalid_token');
  END IF;

  SELECT status INTO v_member_status FROM members WHERE id = v_member_id FOR UPDATE;
  IF NOT public.is_voting_status(v_member_status) THEN
    RETURN jsonb_build_object('error', 'not_eligible');
  END IF;

  SELECT * INTO v_token FROM meeting_voting_tokens WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'invalid_token');
  END IF;

  IF v_token.voted_at IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'already_voted');
  END IF;

  IF v_token.expires_at < NOW() THEN
    RETURN jsonb_build_object('error', 'expired');
  END IF;

  v_meeting_id := v_token.meeting_id;

  SELECT * INTO v_meeting FROM meetings WHERE id = v_meeting_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'meeting_not_found');
  END IF;
  IF v_meeting.status IN ('baigtas', 'atšauktas')
     OR NOW() >= v_meeting.meeting_date
     OR (v_meeting.early_voting_start IS NOT NULL AND NOW() < v_meeting.early_voting_start)
     OR (v_meeting.early_voting_end IS NOT NULL AND NOW() > v_meeting.early_voting_end)
  THEN
    RETURN jsonb_build_object('error', 'voting_closed');
  END IF;

  IF public._is_complete_ballot(v_meeting_id, p_votes) IS NOT TRUE THEN
    RETURN jsonb_build_object('error', 'incomplete_ballot');
  END IF;

  IF p_email IS NOT NULL AND length(trim(p_email)) > 0 THEN
    UPDATE members SET email = trim(p_email) WHERE id = v_token.member_id;
  END IF;
  IF p_phone IS NOT NULL AND length(trim(p_phone)) > 0 THEN
    UPDATE members SET phone = trim(p_phone) WHERE id = v_token.member_id;
  END IF;

  FOR v_vote IN SELECT * FROM jsonb_array_elements(p_votes)
  LOOP
    v_resolution_id := (v_vote->>'resolution_id')::UUID;
    v_choice := v_vote->>'vote';
    v_comment := NULLIF(trim(COALESCE(v_vote->>'comment','')), '');

    IF v_choice NOT IN ('uz', 'pries', 'susilaike') THEN
      RAISE EXCEPTION 'Negaliojantis balso pasirinkimas: %', v_choice;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM resolutions
      WHERE id = v_resolution_id AND meeting_id = v_meeting_id AND is_procedural = FALSE
    ) THEN
      RAISE EXCEPTION 'Klausimas nepriklauso siam susirinkimui';
    END IF;

    INSERT INTO vote_ballots (resolution_id, member_id, vote, vote_type, comment)
    VALUES (v_resolution_id, v_token.member_id, v_choice, 'isankstinis', v_comment)
    ON CONFLICT (resolution_id, member_id) DO UPDATE SET
      vote = EXCLUDED.vote,
      vote_type = EXCLUDED.vote_type,
      comment = EXCLUDED.comment,
      voted_at = NOW();
  END LOOP;

  UPDATE meeting_voting_tokens
  SET voted_at = NOW()
  WHERE id = v_token.id;

  INSERT INTO meeting_attendance (meeting_id, member_id, attendance_type)
  VALUES (v_meeting_id, v_token.member_id, 'nuotolinis')
  ON CONFLICT (meeting_id, member_id) DO NOTHING;

  UPDATE resolutions r
  SET
    result_for = (SELECT count(*) FROM vote_ballots WHERE resolution_id = r.id AND vote = 'uz'),
    result_against = (SELECT count(*) FROM vote_ballots WHERE resolution_id = r.id AND vote = 'pries'),
    result_abstain = (SELECT count(*) FROM vote_ballots WHERE resolution_id = r.id AND vote = 'susilaike')
  WHERE r.meeting_id = v_meeting_id
    AND r.id IN (
      SELECT (v->>'resolution_id')::UUID FROM jsonb_array_elements(p_votes) v
    );

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3. on_member_status_change – balso teisė per helper'į (kvorumas su garbės)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.on_member_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_was_eligible BOOLEAN := public.is_voting_status(OLD.status);
  v_is_eligible  BOOLEAN := public.is_voting_status(NEW.status);
  v_total INT;
  v_res_ids UUID[];
  v_ballots_deleted INT := 0;
  v_att_deleted INT := 0;
BEGIN
  -- Balso teisė nepasikeitė (pvz. aktyvus ↔ pasyvus ↔ garbes_narys)
  IF v_was_eligible = v_is_eligible THEN
    RETURN NEW;
  END IF;

  -- Lygiagrečius balso teisės pokyčius vykdom po vieną (migr. 041)
  PERFORM pg_advisory_xact_lock(hashtext('members_voting_eligibility'));

  IF v_was_eligible AND NOT v_is_eligible THEN
    UPDATE meeting_voting_tokens
    SET expires_at = NOW()
    WHERE member_id = NEW.id
      AND voted_at IS NULL
      AND expires_at > NOW();

    SELECT array_agg(vb.resolution_id) INTO v_res_ids
    FROM vote_ballots vb
    JOIN resolutions r ON r.id = vb.resolution_id
    JOIN meetings m ON m.id = r.meeting_id
    WHERE vb.member_id = NEW.id
      AND m.status NOT IN ('baigtas', 'atšauktas')
      AND m.meeting_date > NOW();

    IF v_res_ids IS NOT NULL THEN
      DELETE FROM vote_ballots
      WHERE member_id = NEW.id AND resolution_id = ANY (v_res_ids);
      GET DIAGNOSTICS v_ballots_deleted = ROW_COUNT;

      UPDATE resolutions r
      SET
        result_for = (SELECT count(*) FROM vote_ballots WHERE resolution_id = r.id AND vote = 'uz'),
        result_against = (SELECT count(*) FROM vote_ballots WHERE resolution_id = r.id AND vote = 'pries'),
        result_abstain = (SELECT count(*) FROM vote_ballots WHERE resolution_id = r.id AND vote = 'susilaike')
      WHERE r.id = ANY (v_res_ids);
    END IF;

    DELETE FROM meeting_attendance ma
    USING meetings m
    WHERE ma.meeting_id = m.id
      AND ma.member_id = NEW.id
      AND m.status NOT IN ('baigtas', 'atšauktas')
      AND m.meeting_date > NOW();
    GET DIAGNOSTICS v_att_deleted = ROW_COUNT;

    UPDATE meeting_voting_tokens t
    SET voted_at = NULL, expires_at = NOW()
    FROM meetings m
    WHERE m.id = t.meeting_id
      AND t.member_id = NEW.id
      AND t.voted_at IS NOT NULL
      AND m.status NOT IN ('baigtas', 'atšauktas')
      AND m.meeting_date > NOW();

    IF v_ballots_deleted > 0 OR v_att_deleted > 0 THEN
      INSERT INTO audit_log (user_id, action, table_name, record_id, old_data)
      VALUES (
        NULL, 'DELETE', 'vote_ballots', NEW.id,
        jsonb_build_object(
          'reason', 'member_lost_voting_rights',
          'old_status', OLD.status,
          'new_status', NEW.status,
          'ballots_deleted', v_ballots_deleted,
          'attendance_deleted', v_att_deleted
        )
      );
    END IF;
  ELSE
    UPDATE meeting_voting_tokens t
    SET expires_at = m.meeting_date
    FROM meetings m
    WHERE m.id = t.meeting_id
      AND t.member_id = NEW.id
      AND t.voted_at IS NULL
      AND m.status NOT IN ('baigtas', 'atšauktas')
      AND m.meeting_date > NOW()
      AND t.expires_at < m.meeting_date;
  END IF;

  -- Kvorumo nuotrauka – balso teisę turintys nariai (įsk. garbės narius)
  SELECT count(*) INTO v_total FROM members WHERE public.is_voting_status(status);
  UPDATE meetings
  SET total_members_at_time = v_total,
      quorum_required = CASE WHEN is_repeat THEN 0 ELSE (v_total / 2) + 1 END
  WHERE status NOT IN ('baigtas', 'atšauktas')
    AND meeting_date > NOW();

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.on_member_status_change() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. get_meeting_plan_data – narių skaičius su garbės nariais
--    (skolų dalis LIEKA tik aktyvus/pasyvus – garbės nariui mokestis netaikomas)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_meeting_plan_data(p_meeting_id uuid)
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
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'meeting_not_found');
  END IF;

  v_year := EXTRACT(YEAR FROM v_meeting.meeting_date)::INT;

  -- Narių skaičius – visi balso teisę turintys (aktyvūs, pasyvūs, garbės)
  SELECT COUNT(*) INTO v_member_count
  FROM members
  WHERE public.is_voting_status(status);

  SELECT COALESCE(SUM(p.amount_cents), 0), COUNT(*)
  INTO v_collected_cents, v_paid_count
  FROM payments p
  JOIN fee_periods fp ON fp.id = p.fee_period_id
  WHERE fp.fee_type = 'metinis' AND fp.year = v_year;

  -- Skolos – TIK mokestį mokantys nariai (garbės narys atleistas)
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

-- ---------------------------------------------------------------------------
-- 5. Esamų BŪSIMŲ susirinkimų kvorumo nuotrauka perskaičiuojama pagal naują
--    taisyklę (garbės nariai dabar įskaičiuojami)
-- ---------------------------------------------------------------------------
UPDATE meetings m
SET total_members_at_time = c.total,
    quorum_required = CASE WHEN m.is_repeat THEN 0 ELSE (c.total / 2) + 1 END
FROM (SELECT count(*) AS total FROM members WHERE public.is_voting_status(status)) c
WHERE m.status NOT IN ('baigtas', 'atšauktas')
  AND m.meeting_date > NOW();
