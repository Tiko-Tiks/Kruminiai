-- 041: Codex PR #2 penktos peržiūros pataisymai
--
-- 1. (P1) `cast_votes_with_token` tikrino TIK `expires_at`, todėl SMS nuoroda
--    priimdavo balsus ir tada, kai balsavimo langas dar neatsidaręs
--    (`early_voting_start` ateityje), jau užsidaręs (`early_voting_end` prieš
--    `meeting_date`) arba susirinkimas pažymėtas `baigtas`/`atšauktas`, o data
--    dar ateityje. Dabar – tas pats langas kaip `cast_votes_as_member`
--    (`voting_closed`).
-- 2. (P1/UI) `get_voting_token_data` grąžina `voting_open` – forma paslepia
--    „Balsuoti nuotoliu" variantą, kai langas uždarytas, bet PALIEKA
--    „Dalyvausiu gyvai" (ta intencija galioja iki susirinkimo pradžios).
-- 3. (P2) `get_voting_token_data` grąžina nario `language` (taip pat ir prie
--    `already_voted`/`expired` klaidų) – SMS gavėjo naršyklėje nėra
--    `NEXT_LOCALE` cookie, todėl anglakalbis narys matydavo lietuviškus
--    klaidų tekstus.
-- 4. (P2) `on_member_status_change` ima `pg_advisory_xact_lock` – du
--    lygiagretūs balso teisės keitimai anksčiau galėjo perskaičiuoti kvorumą
--    nematydami vienas kito ir palikti pasenusį `total_members_at_time`.

-- ---------------------------------------------------------------------------
-- 1. get_voting_token_data – nario kalba + balsavimo lango požymis
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_voting_token_data(p_token TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_token meeting_voting_tokens%ROWTYPE;
  v_meeting meetings%ROWTYPE;
  v_member members%ROWTYPE;
BEGIN
  SELECT * INTO v_token FROM meeting_voting_tokens WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'invalid_token');
  END IF;

  SELECT * INTO v_member FROM members WHERE id = v_token.member_id;

  IF v_token.voted_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'error', 'already_voted',
      'voted_at', v_token.voted_at,
      'language', COALESCE(v_member.language, 'lt')
    );
  END IF;
  IF v_token.expires_at < NOW() THEN
    RETURN jsonb_build_object(
      'error', 'expired',
      'language', COALESCE(v_member.language, 'lt')
    );
  END IF;

  SELECT * INTO v_meeting FROM meetings WHERE id = v_token.meeting_id;

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
      'phone', v_member.phone,
      'language', COALESCE(v_member.language, 'lt')
    ),
    'resolutions', public._meeting_resolutions_jsonb(v_meeting.id, TRUE),
    'expires_at', v_token.expires_at,
    'live_intent_at', v_token.live_intent_at,
    -- Tas pats langas, kurį enforce'ina cast_votes_with_token
    'voting_open', (
      v_meeting.status NOT IN ('baigtas', 'atšauktas')
      AND NOW() < v_meeting.meeting_date
      AND (v_meeting.early_voting_start IS NULL OR NOW() >= v_meeting.early_voting_start)
      AND (v_meeting.early_voting_end IS NULL OR NOW() <= v_meeting.early_voting_end)
    )
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- 2. cast_votes_with_token – balsavimo langas (kaip cast_votes_as_member)
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
  -- Tokeno savininkas BE užrakto – tik tam, kad užraktus imtume ta pačia
  -- tvarka kaip statuso keitimo trigger'is (members → meeting_voting_tokens).
  SELECT member_id INTO v_member_id FROM meeting_voting_tokens WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'invalid_token');
  END IF;

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

  -- Balsavimo langas – identiškas cast_votes_as_member (tokeno `expires_at`
  -- vieno nepakanka: jis nustatomas išsiuntimo metu ir nežino nei
  -- `early_voting_*`, nei vėlesnio susirinkimo statuso pakeitimo)
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
-- 3. on_member_status_change – lygiagrečių balso teisės keitimų serializavimas
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

  -- Balso teisės pokyčiai vykdomi po vieną: kitaip du lygiagretūs keitimai
  -- suskaičiuotų kvorumo vardiklį nematydami vienas kito ir abu įrašytų tą
  -- patį (pasenusį) `total_members_at_time`.
  PERFORM pg_advisory_xact_lock(hashtext('members_voting_eligibility'));

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
