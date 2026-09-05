-- 040: Codex PR #2 ketvirtos peržiūros P1 pataisymai
--
-- 1. LENKTYNIŲ SĄLYGA tarp balso įrašymo ir statuso keitimo.
--    Anksčiau abu RPC skaitė `members.status` be užrakto (MVCC snapshot).
--    Scenarijus: narys pradeda balsavimą (mato `aktyvus`), tuo pat metu admin
--    pakeičia statusą į `garbes_narys` – trigger'is išvalo BŪSIMŲ susirinkimų
--    balsus PRIEŠ tai, kai balsavimo transakcija juos įrašo. Rezultatas –
--    balso teisės netekusio nario balsas lieka oficialiose sumose.
--    Sprendimas: `SELECT ... FOR UPDATE` ant nario eilutės. Tada:
--      * jei pirmas commit'ina balsavimas – admin'o UPDATE laukia, po to
--        trigger'is mato ir išvalo ką tik įrašytus balsus;
--      * jei pirmas commit'ina statuso keitimas – balsavimo RPC atsirakina,
--        perskaito NAUJĄ statusą (READ COMMITTED) ir grąžina `not_eligible`.
--    Užraktų tvarka VISUR vienoda: members → meeting_voting_tokens →
--    vote_ballots. Todėl `cast_votes_with_token` pirmiausia be užrakto
--    nuskaito tokeno savininką, užrakina narį ir tik tada užrakina tokeną
--    (anksčiau buvo tokenas → narys, o trigger'is – narys → tokenas, t. y.
--    priešinga tvarka = potencialus deadlock'as).
--
-- 2. `vyksta` SUSIRINKIMAI VALYME. `cast_votes_as_member` priima balsus, kol
--    `NOW() < meeting_date` ir statusas ne `baigtas`/`atšauktas` – įskaitant
--    `vyksta` (admin gali paspausti „Pradėti susirinkimą" anksčiau laiko).
--    039 valymas apėmė tik `planuojamas`/`registracija`, todėl tokiame
--    susirinkime balso teisės netekusio nario balsas ir dalyvavimas likdavo.
--    Dabar valymas ir kvorumo perskaičiavimas naudoja TĄ PATĮ rinkinį kaip
--    RPC: `status NOT IN ('baigtas','atšauktas') AND meeting_date > NOW()`.

-- ---------------------------------------------------------------------------
-- 1. cast_votes_as_member – nario eilutės užraktas
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

  -- Balso teisę turi tik aktyvus/pasyvus narys (garbės narys – patariamasis).
  -- FOR UPDATE serializuoja su statuso keitimu (žr. migracijos komentarą).
  SELECT status INTO v_member_status FROM members WHERE id = v_member_id FOR UPDATE;
  IF v_member_status IS NULL OR v_member_status NOT IN ('aktyvus', 'pasyvus') THEN
    RETURN jsonb_build_object('error', 'not_eligible');
  END IF;

  -- Balsavimo langas
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

  -- Pilnas biuletenis – prieš BET KOKĮ rašymą
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
-- 2. cast_votes_with_token – užraktų tvarka members → tokens
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cast_votes_with_token(p_token text, p_email text, p_phone text, p_votes jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_token meeting_voting_tokens%ROWTYPE;
  v_member_id UUID;
  v_member_status TEXT;
  v_vote JSONB;
  v_resolution_id UUID;
  v_choice TEXT;
  v_comment TEXT;
  v_meeting_id UUID;
BEGIN
  -- Tokeno savininkas BE užrakto – tik tam, kad užraktus imtume ta pačia
  -- tvarka kaip statuso keitimo trigger'is (members → meeting_voting_tokens).
  SELECT member_id INTO v_member_id FROM meeting_voting_tokens WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'invalid_token');
  END IF;

  -- Dabartinis nario statusas su eilutės užraktu (tokenas galėjo būti išduotas,
  -- kol narys dar buvo aktyvus; taip pat serializuoja su statuso keitimu)
  SELECT status INTO v_member_status FROM members WHERE id = v_member_id FOR UPDATE;
  IF v_member_status IS NULL OR v_member_status NOT IN ('aktyvus', 'pasyvus') THEN
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
-- 3. on_member_status_change – valymas VISIEMS būsimiems susirinkimams
--    (tas pats rinkinys, kurį priima balsavimo RPC – įsk. `vyksta`)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.on_member_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_was_eligible BOOLEAN := OLD.status IN ('aktyvus', 'pasyvus');
  v_is_eligible  BOOLEAN := NEW.status IN ('aktyvus', 'pasyvus');
  v_total INT;
  v_res_ids UUID[];
  v_ballots_deleted INT := 0;
  v_att_deleted INT := 0;
BEGIN
  -- Balso teisė nepasikeitė (pvz. aktyvus ↔ pasyvus) – nieko nedarom
  IF v_was_eligible = v_is_eligible THEN
    RETURN NEW;
  END IF;

  IF v_was_eligible AND NOT v_is_eligible THEN
    -- a1) neišnaudoti tokenai anuliuojami
    UPDATE meeting_voting_tokens
    SET expires_at = NOW()
    WHERE member_id = NEW.id
      AND voted_at IS NULL
      AND expires_at > NOW();

    -- a2) būsimų susirinkimų išankstiniai balsai pašalinami, suvestinės perskaičiuojamos
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

    -- a3) būsimų susirinkimų dalyvavimo įrašai pašalinami (kvorumas)
    DELETE FROM meeting_attendance ma
    USING meetings m
    WHERE ma.meeting_id = m.id
      AND ma.member_id = NEW.id
      AND m.status NOT IN ('baigtas', 'atšauktas')
      AND m.meeting_date > NOW();
    GET DIAGNOSTICS v_att_deleted = ROW_COUNT;

    -- a4) „balsuota" tokenai būsimiems susirinkimams → nebalsuoti, bet anuliuoti
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
    -- b) atgavo balso teisę → neišnaudoti tokenai vėl galioja iki susirinkimo
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

  -- c) kvorumo nuotrauka visiems dar neprasidėjusiems susirinkimams
  SELECT count(*) INTO v_total FROM members WHERE status IN ('aktyvus', 'pasyvus');
  UPDATE meetings
  SET total_members_at_time = v_total,
      quorum_required = CASE WHEN is_repeat THEN 0 ELSE (v_total / 2) + 1 END
  WHERE status NOT IN ('baigtas', 'atšauktas')
    AND meeting_date > NOW();

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.on_member_status_change() FROM PUBLIC, anon, authenticated;
