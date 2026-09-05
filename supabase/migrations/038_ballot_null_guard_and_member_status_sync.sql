-- 038: Codex PR #2 antros peržiūros pataisymai
--
-- 1. `_is_complete_ballot` – NULL / ne-masyvo saugi. Anksčiau `p_votes = NULL`
--    grąžindavo SQL NULL, o PL/pgSQL `IF NOT NULL` nevykdomas → RPC praleisdavo
--    balsų ciklą, bet registruodavo nuotolinį dalyvavimą (kvorumo infliacija).
--    Naudojamas CASE (garantuota vertinimo tvarka – `jsonb_array_length`
--    nekviečiama ne masyvui), o kvietėjai tikrina `IS NOT TRUE`.
-- 2. Vienas `members` statuso keitimo trigger'is `members_status_change_sync`
--    (pakeičia 037 `members_revoke_voting_tokens`):
--      a) balso teisės netekimas (aktyvus/pasyvus → kita) → neišnaudoti SMS
--         tokenai anuliuojami (`expires_at = NOW()`);
--      b) balso teisės atgavimas (→ aktyvus/pasyvus) → neišnaudotų tokenų
--         galiojimas grąžinamas iki susirinkimo pradžios (anksčiau anuliuotas
--         tokenas likdavo negaliojantis visam laikui, o UNIQUE(meeting, member)
--         neleisdavo sukurti naujo);
--      c) dar neprasidėjusių susirinkimų (`planuojamas`/`registracija`,
--         `meeting_date > NOW()`) kvorumo nuotrauka persiskaičiuoja –
--         `total_members_at_time` = aktyvūs+pasyvūs, `quorum_required` =
--         floor(N/2)+1 (pakartotiniam – 0), kaip `createMeeting`.

-- ---------------------------------------------------------------------------
-- 1. _is_complete_ballot – NULL-safe
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._is_complete_ballot(p_meeting_id uuid, p_votes jsonb)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN p_votes IS NULL THEN FALSE
    WHEN jsonb_typeof(p_votes) <> 'array' THEN FALSE
    WHEN jsonb_array_length(p_votes) = 0 THEN FALSE
    ELSE (
      jsonb_array_length(p_votes) = (
        SELECT count(*) FROM resolutions r
        WHERE r.meeting_id = p_meeting_id AND r.is_procedural = FALSE
      )
      AND (
        SELECT count(DISTINCT v->>'resolution_id') FROM jsonb_array_elements(p_votes) v
      ) = jsonb_array_length(p_votes)
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_votes) v
        WHERE NOT EXISTS (
          SELECT 1 FROM resolutions r
          WHERE r.id = (v->>'resolution_id')::uuid
            AND r.meeting_id = p_meeting_id
            AND r.is_procedural = FALSE
        )
      )
    )
  END;
$function$;

-- Kvietėjai: `IS NOT TRUE` (papildoma apsauga, jei helper'is kada grąžintų NULL)
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

  SELECT status INTO v_member_status FROM members WHERE id = v_member_id;
  IF v_member_status IS NULL OR v_member_status NOT IN ('aktyvus', 'pasyvus') THEN
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

CREATE OR REPLACE FUNCTION public.cast_votes_with_token(p_token text, p_email text, p_phone text, p_votes jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_token meeting_voting_tokens%ROWTYPE;
  v_member_status TEXT;
  v_vote JSONB;
  v_resolution_id UUID;
  v_choice TEXT;
  v_comment TEXT;
  v_meeting_id UUID;
BEGIN
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

  SELECT status INTO v_member_status FROM members WHERE id = v_token.member_id;
  IF v_member_status IS NULL OR v_member_status NOT IN ('aktyvus', 'pasyvus') THEN
    RETURN jsonb_build_object('error', 'not_eligible');
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
-- 2. Nario statuso keitimas → tokenai (anuliuoti / atstatyti) + kvorumo nuotrauka
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
BEGIN
  -- Balso teisė nepasikeitė (pvz. aktyvus ↔ pasyvus) – nieko nedarom
  IF v_was_eligible = v_is_eligible THEN
    RETURN NEW;
  END IF;

  IF v_was_eligible AND NOT v_is_eligible THEN
    -- a) neteko balso teisės → neišnaudoti tokenai anuliuojami
    UPDATE meeting_voting_tokens
    SET expires_at = NOW()
    WHERE member_id = NEW.id
      AND voted_at IS NULL
      AND expires_at > NOW();
  ELSE
    -- b) atgavo balso teisę → neišnaudoti tokenai vėl galioja iki susirinkimo
    UPDATE meeting_voting_tokens t
    SET expires_at = m.meeting_date
    FROM meetings m
    WHERE m.id = t.meeting_id
      AND t.member_id = NEW.id
      AND t.voted_at IS NULL
      AND m.meeting_date > NOW()
      AND t.expires_at < m.meeting_date;
  END IF;

  -- c) kvorumo nuotrauka dar neprasidėjusiems susirinkimams (kaip createMeeting)
  SELECT count(*) INTO v_total FROM members WHERE status IN ('aktyvus', 'pasyvus');
  UPDATE meetings
  SET total_members_at_time = v_total,
      quorum_required = CASE WHEN is_repeat THEN 0 ELSE (v_total / 2) + 1 END
  WHERE status IN ('planuojamas', 'registracija')
    AND meeting_date > NOW();

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.on_member_status_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS members_revoke_voting_tokens ON public.members;
DROP FUNCTION IF EXISTS public.revoke_voting_tokens_on_status_change();

DROP TRIGGER IF EXISTS members_status_change_sync ON public.members;
CREATE TRIGGER members_status_change_sync
  AFTER UPDATE OF status ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.on_member_status_change();
