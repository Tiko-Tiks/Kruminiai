-- 037: balsavimo RPC užveržimas (Codex PR #2 peržiūros pastabos)
--
-- 1. `_is_complete_ballot` – bendra patikra: p_votes turi PO VIENĄ balsą už
--    KIEKVIENĄ neprocedūrinį susirinkimo klausimą (be dublikatų, be svetimų
--    ar procedūrinių ID, ne tuščias). Anksčiau tuščias/dalinis masyvas vis
--    tiek užregistruodavo nuotolinį dalyvavimą (kvorumo statistika) ir
--    užrakindavo tokeną, o dalinis – blokuodavo likusius klausimus per
--    `already_voted`.
-- 2. `cast_votes_as_member` – papildomai tikrina BALSAVIMO LANGĄ: susirinkimas
--    egzistuoja, ne baigtas/atšauktas, dar neprasidėjęs (kaip ir SMS tokenai,
--    kurie galioja iki `meeting_date`), o jei nustatytas išankstinio balsavimo
--    laikotarpis – NOW() jame. Anksčiau buvo galima balsuoti už bet kurį
--    susirinkimą, kurio nutarimų ID žinomi.
-- 3. `cast_votes_with_token` – tikrina DABARTINĮ nario statusą (tokenas galėjo
--    būti išduotas, kol narys dar buvo aktyvus) + pilną biuletenį.
-- 4. Trigger'is `members_revoke_voting_tokens` – pakeitus statusą iš
--    balsuojančio (aktyvus/pasyvus) į nebalsuojantį (garbes_narys/išstojęs)
--    neišnaudoti tokenai iškart pasibaigia (`expires_at = NOW()`).

-- ---------------------------------------------------------------------------
-- 1. Pilno biuletenio patikra (vidinė, kviečiama tik iš SECURITY DEFINER RPC)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._is_complete_ballot(p_meeting_id uuid, p_votes jsonb)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT jsonb_typeof(p_votes) = 'array'
    AND jsonb_array_length(p_votes) > 0
    AND jsonb_array_length(p_votes) = (
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
    );
$function$;

REVOKE EXECUTE ON FUNCTION public._is_complete_ballot(uuid, jsonb) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. cast_votes_as_member – statusas + balsavimo langas + pilnas biuletenis
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

  -- Balso teisę turi tik aktyvus/pasyvus narys (garbės narys – patariamasis)
  SELECT status INTO v_member_status FROM members WHERE id = v_member_id;
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
  IF NOT public._is_complete_ballot(p_meeting_id, p_votes) THEN
    RETURN jsonb_build_object('error', 'incomplete_ballot');
  END IF;

  -- Patikrinti, ar narys jau balsavo per kažkurį šio susirinkimo nutarimą
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

  -- Auto-registruoti kaip nuotolinį dalyvį
  INSERT INTO meeting_attendance (meeting_id, member_id, attendance_type)
  VALUES (p_meeting_id, v_member_id, 'nuotolinis')
  ON CONFLICT (meeting_id, member_id) DO NOTHING;

  -- Atnaujinti rezultatų suvestines
  UPDATE resolutions r
  SET
    result_for = (SELECT count(*) FROM vote_ballots WHERE resolution_id = r.id AND vote = 'uz'),
    result_against = (SELECT count(*) FROM vote_ballots WHERE resolution_id = r.id AND vote = 'pries'),
    result_abstain = (SELECT count(*) FROM vote_ballots WHERE resolution_id = r.id AND vote = 'susilaike')
  WHERE r.meeting_id = p_meeting_id
    AND r.id IN (SELECT (v->>'resolution_id')::UUID FROM jsonb_array_elements(p_votes) v);

  -- Užrakinti SMS tokeną, jei yra (kad narys nepasielgtų antrą kartą per SMS)
  UPDATE meeting_voting_tokens
  SET voted_at = NOW()
  WHERE meeting_id = p_meeting_id AND member_id = v_member_id AND voted_at IS NULL;

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3. cast_votes_with_token – dabartinis nario statusas + pilnas biuletenis
-- ---------------------------------------------------------------------------
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

  -- Tokenas galėjo būti išduotas, kol narys dar buvo aktyvus – tikrinam
  -- DABARTINĮ statusą (garbės narys / išstojęs balso teisės neturi)
  SELECT status INTO v_member_status FROM members WHERE id = v_token.member_id;
  IF v_member_status IS NULL OR v_member_status NOT IN ('aktyvus', 'pasyvus') THEN
    RETURN jsonb_build_object('error', 'not_eligible');
  END IF;

  v_meeting_id := v_token.meeting_id;

  -- Pilnas biuletenis – prieš BET KOKĮ rašymą (įsk. kontaktų atnaujinimą)
  IF NOT public._is_complete_ballot(v_meeting_id, p_votes) THEN
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
-- 4. Statuso pakeitimas → neišnaudotų SMS tokenų anuliavimas
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revoke_voting_tokens_on_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.status IN ('aktyvus', 'pasyvus') AND NEW.status NOT IN ('aktyvus', 'pasyvus') THEN
    UPDATE meeting_voting_tokens
    SET expires_at = NOW()
    WHERE member_id = NEW.id
      AND voted_at IS NULL
      AND expires_at > NOW();
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS members_revoke_voting_tokens ON public.members;
CREATE TRIGGER members_revoke_voting_tokens
  AFTER UPDATE OF status ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.revoke_voting_tokens_on_status_change();

-- Higiena (kaip migr. 029): trigger funkcija nekviečiama tiesiogiai
REVOKE EXECUTE ON FUNCTION public.revoke_voting_tokens_on_status_change() FROM PUBLIC, anon, authenticated;
