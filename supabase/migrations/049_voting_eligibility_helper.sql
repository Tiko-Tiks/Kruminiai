-- ============================================================================
-- 049: Balso teisė susiejama su konkrečiu susirinkimu – vienas SQL šaltinis
--
-- KODĖL: `cast_votes_as_member` ir `cast_votes_with_token` tikrindavo nario
-- statusą, balsavimo langą ir pilną biuletenį, bet NE:
--   * ar susirinkimas paskelbtas (`is_published`, migr. 045) – SECURITY DEFINER
--     funkcija RLS neprivalo, todėl paslėptame susirinkime buvo galima balsuoti;
--   * ar Tarybos posėdyje (`meeting_type = 'valdybos'`) balsuoja Tarybos narys –
--     SMS tokenai ir portalo sąrašas apima VISUS balso teisę turinčius narius,
--     o įstatų 5.5 p. Taryboje sprendžia tik Tarybos nariai.
-- Tie patys du patikrinimai trūko ir `get_member_active_meetings` /
-- `get_member_voting_history` sąrašuose.
--
-- SPRENDIMAS: `public._member_can_vote(member, meeting)` – VIENAS šaltinis,
-- grąžinantis NULL (galima) arba klaidos kodą (`not_eligible`,
-- `meeting_not_found`, `council_only`, `voting_closed`). Kodai keliauja į nario
-- kalbą per `voteErrorMessage()` (`src/lib/vote-errors.ts` + `voteErrors` i18n).
--
-- Klaidų eiliškumas paliktas toks, koks buvo (statusas → susirinkimas → langas),
-- kad esami nario matomi pranešimai nepasikeistų be reikalo.
--
-- Užraktų tvarka iš migr. 040 nekeičiama: `members` → `meeting_voting_tokens`
-- → `vote_ballots`. Helper'is nario eilutės NErakina – ją rakina kvietėjas
-- PRIEŠ jį iškviesdamas.
--
-- Čia pat šios trys funkcijos gauna ir migr. 048 patvirtinimo vartus
-- (`not_approved`), kad ta pati funkcija nebūtų apibrėžta dukart iš eilės.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Pagalbinės funkcijos
-- ----------------------------------------------------------------------------

-- Ar narys šiuo metu yra valdymo organo narys? Tas pats kriterijus, kurį
-- naudoja posėdžio dalyvių sąrašas (`fetchEligibleAttendees`,
-- src/actions/meetings.ts): bet kuri GALIOJANTI `community_management` rolė –
-- Pirmininkas pagal įstatų 5.3 p. renkamas iš Tarybos narių, tad įeina.
CREATE OR REPLACE FUNCTION public._is_current_council_member(p_member_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.community_management cm
    WHERE cm.member_id = p_member_id
      AND cm.is_current = true
  );
$function$;

REVOKE ALL ON FUNCTION public._is_current_council_member(uuid) FROM PUBLIC, anon, authenticated;

-- Ar narys apskritai mato šį susirinkimą? Naudoja portalo sąrašus.
CREATE OR REPLACE FUNCTION public._member_meeting_visible(p_member_id uuid, p_meeting_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.meetings m
    WHERE m.id = p_meeting_id
      AND m.is_published
      AND (
        m.meeting_type <> 'valdybos'
        OR public._is_current_council_member(p_member_id)
      )
  );
$function$;

REVOKE ALL ON FUNCTION public._member_meeting_visible(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- NULL = gali balsuoti; kitaip – klaidos kodas.
CREATE OR REPLACE FUNCTION public._member_can_vote(p_member_id uuid, p_meeting_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_status TEXT;
  v_meeting meetings%ROWTYPE;
BEGIN
  IF p_member_id IS NULL THEN
    RETURN 'no_member_link';
  END IF;

  SELECT status INTO v_status FROM members WHERE id = p_member_id;
  IF NOT FOUND OR NOT public.is_voting_status(v_status) THEN
    RETURN 'not_eligible';
  END IF;

  SELECT * INTO v_meeting FROM meetings WHERE id = p_meeting_id;
  -- Nepaskelbtas susirinkimas nariui neegzistuoja (migr. 045).
  IF NOT FOUND OR NOT v_meeting.is_published THEN
    RETURN 'meeting_not_found';
  END IF;

  IF v_meeting.meeting_type = 'valdybos'
     AND NOT public._is_current_council_member(p_member_id)
  THEN
    RETURN 'council_only';
  END IF;

  IF v_meeting.status IN ('baigtas', 'atšauktas')
     OR NOW() >= v_meeting.meeting_date
     OR (v_meeting.early_voting_start IS NOT NULL AND NOW() < v_meeting.early_voting_start)
     OR (v_meeting.early_voting_end IS NOT NULL AND NOW() > v_meeting.early_voting_end)
  THEN
    RETURN 'voting_closed';
  END IF;

  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public._member_can_vote(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Balsavimas iš portalo
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cast_votes_as_member(p_meeting_id uuid, p_votes jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_member_id UUID;
  v_blocked TEXT;
  v_vote JSONB;
  v_resolution_id UUID;
  v_choice TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  IF NOT (public.is_approved_member() OR public.is_admin()) THEN
    RETURN jsonb_build_object('error', 'not_approved');
  END IF;

  SELECT member_id INTO v_member_id FROM profiles WHERE id = v_user_id;
  IF v_member_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_member_link');
  END IF;

  -- Užraktas PRIEŠ patikras (migr. 040): narystės statuso keitimas ir balso
  -- įrašymas turi serializuotis, kitaip trigger'is išvalytų balsus prieš juos
  -- įrašant. Patį statusą tikrina _member_can_vote – jau po užrakto.
  PERFORM 1 FROM members WHERE id = v_member_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'no_member_link');
  END IF;

  v_blocked := public._member_can_vote(v_member_id, p_meeting_id);
  IF v_blocked IS NOT NULL THEN
    RETURN jsonb_build_object('error', v_blocked);
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

REVOKE ALL ON FUNCTION public.cast_votes_as_member(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cast_votes_as_member(uuid, jsonb) TO authenticated;

-- ----------------------------------------------------------------------------
-- Balsavimas per SMS nuorodą
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cast_votes_with_token(p_token text, p_email text, p_phone text, p_votes jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_token meeting_voting_tokens%ROWTYPE;
  v_member_id UUID;
  v_blocked TEXT;
  v_vote JSONB;
  v_resolution_id UUID;
  v_choice TEXT;
  v_comment TEXT;
  v_meeting_id UUID;
BEGIN
  IF p_token IS NULL OR length(p_token) = 0 THEN
    RETURN jsonb_build_object('error', 'invalid_token');
  END IF;

  SELECT member_id INTO v_member_id FROM meeting_voting_tokens WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'invalid_token');
  END IF;

  -- Užraktų tvarka: members → meeting_voting_tokens → vote_ballots (migr. 040).
  -- Statusą po užrakto tikrina _member_can_vote.
  PERFORM 1 FROM members WHERE id = v_member_id FOR UPDATE;
  IF NOT FOUND THEN
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

  v_blocked := public._member_can_vote(v_token.member_id, v_meeting_id);
  IF v_blocked IS NOT NULL THEN
    RETURN jsonb_build_object('error', v_blocked);
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

REVOKE ALL ON FUNCTION public.cast_votes_with_token(text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cast_votes_with_token(text, text, text, jsonb) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- Portalo sąrašai: nepaskelbti ir ne savo organo posėdžiai nerodomi
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_member_active_meetings()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_member_id UUID;
  v_result JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  IF NOT (public.is_approved_member() OR public.is_admin()) THEN
    RETURN jsonb_build_object('error', 'not_approved');
  END IF;

  SELECT member_id INTO v_member_id FROM profiles WHERE id = v_user_id;
  IF v_member_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_member_link');
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'title', m.title,
      'meeting_date', m.meeting_date,
      'location', m.location,
      'status', m.status,
      'early_voting_start', m.early_voting_start,
      'early_voting_end', m.early_voting_end,
      -- has_voted: arba vote_ballots (nuotoliu/portale), arba
      -- meeting_attendance (gyvai). Bet kuriuo būdu jau dalyvavęs.
      'has_voted', (
        EXISTS (
          SELECT 1 FROM vote_ballots vb
          JOIN resolutions r ON r.id = vb.resolution_id
          WHERE r.meeting_id = m.id AND vb.member_id = v_member_id
        )
        OR
        EXISTS (
          SELECT 1 FROM meeting_attendance ma
          WHERE ma.meeting_id = m.id AND ma.member_id = v_member_id
        )
      )
    ) ORDER BY m.meeting_date ASC
  ) INTO v_result
  FROM meetings m
  WHERE m.status IN ('planuojamas', 'registracija', 'vyksta')
    AND m.meeting_date >= NOW() - INTERVAL '1 day'
    AND public._member_meeting_visible(v_member_id, m.id);

  RETURN jsonb_build_object('member_id', v_member_id, 'meetings', COALESCE(v_result, '[]'::jsonb));
END;
$function$;

REVOKE ALL ON FUNCTION public.get_member_active_meetings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_member_active_meetings() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_member_voting_history()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_member_id UUID;
  v_result JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  IF NOT (public.is_approved_member() OR public.is_admin()) THEN
    RETURN jsonb_build_object('error', 'not_approved');
  END IF;

  SELECT member_id INTO v_member_id FROM profiles WHERE id = v_user_id;
  IF v_member_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_member_link');
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'meeting_id', m.id,
      'meeting_title', m.title,
      'meeting_date', m.meeting_date,
      'meeting_status', m.status,
      -- attendance_type: 'fizinis' = gyvai, 'nuotolinis' = nuotoliu,
      -- 'rastu' = raštu. NULL = balsavo per portalą (be attendance įrašo).
      'attendance_type', (
        SELECT ma.attendance_type FROM meeting_attendance ma
        WHERE ma.meeting_id = m.id AND ma.member_id = v_member_id
        LIMIT 1
      ),
      'votes', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'resolution_number', r.resolution_number,
            'resolution_title', r.title,
            'vote', vb.vote,
            'vote_type', vb.vote_type,
            'voted_at', vb.voted_at
          ) ORDER BY r.resolution_number
        )
        FROM vote_ballots vb
        JOIN resolutions r ON r.id = vb.resolution_id
        WHERE r.meeting_id = m.id AND vb.member_id = v_member_id
      )
    ) ORDER BY m.meeting_date DESC
  ) INTO v_result
  FROM meetings m
  WHERE public._member_meeting_visible(v_member_id, m.id)
    AND (
      -- arba balsavo per portalą/SMS
      EXISTS (
        SELECT 1 FROM vote_ballots vb
        JOIN resolutions r ON r.id = vb.resolution_id
        WHERE r.meeting_id = m.id AND vb.member_id = v_member_id
      )
      OR
      -- arba dalyvavo gyvai/nuotoliu/raštu (jokio vote_ballots įrašo)
      EXISTS (
        SELECT 1 FROM meeting_attendance ma
        WHERE ma.meeting_id = m.id AND ma.member_id = v_member_id
      )
    );

  RETURN jsonb_build_object('history', COALESCE(v_result, '[]'::jsonb));
END;
$function$;

REVOKE ALL ON FUNCTION public.get_member_voting_history() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_member_voting_history() TO authenticated;
