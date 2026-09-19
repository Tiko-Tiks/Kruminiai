-- ============================================================================
-- 050: Balso teisė susiejama su konkrečiu susirinkimu – vienas SQL šaltinis
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
-- Čia pat šios trys funkcijos gauna ir migr. 049 patvirtinimo vartus
-- (`not_approved`), kad ta pati funkcija nebūtų apibrėžta dukart iš eilės.
--
-- PAPILDYTA (Codex recenzija):
--   * `council_only` patikra stabdo tik NAUJUS balsus. Jei Tarybos narys
--     balsavo iš anksto, o paskui iki posėdžio neteko Tarybos nario statuso,
--     jo balsas liktų suskaičiuotas. Todėl pridėta
--     `_purge_council_ineligible_votes()` + trigger'is ant
--     `community_management` ir vienkartinis valymas migracijos pabaigoje
--     (senasis RPC ne Tarybos narių balsus leido).
--   * `get_member_voting_history` filtruoja tik pagal `is_published` – organo
--     patikra istorijoje pašalindavo pasibaigusios kadencijos nario paties
--     Tarybos posėdžius.
--
-- SUDERINTA su įstatų atitikties migracija (`048_bylaws_enforcement`), kuri taikoma
-- PRIEŠ šią produkcijoje:
--   * Tarybos nario kriterijus `_is_current_council_member` toks pat kaip
--     `bylaws_participation_guard`: `pirmininkas`/`tarybos_narys` su jau
--     prasidėjusia kadencija (`term_start <= šiandien`) ir jokio galiojančio
--     `revizorius` (5.1, 5.5, 6.2 p.);
--   * valymas neliečia galutinių (`patvirtintas`/`atmestas`) nutarimų – jų
--     balsų `bylaws_participation_guard` trinti neleidžia, o laukų
--     `bylaws_resolution_guard` keisti neleidžia;
--   * valymas neima `members` eilutės užrakto – `bylaws_council_lock` yra
--     BEFORE trigger'is ir advisory užraktą paima pirmas, todėl eilutės
--     užraktas sudarytų ABBA ciklą su nario statuso keitimu;
--   * valymas NIEKO nerašo į `meetings`: susirinkimo laiko narių bazė
--     (`electorate_snapshot`, `total_members_at_time`, `quorum_required`)
--     fiksuojama posėdžio pradžioje ir `bylaws_meeting_guard` jos keisti
--     neleidžia – Tarybos nario netekimas yra vėlesnis įvykis, ne bazės klaida.
-- Failų eilė sutampa su gamybos eile (048 įstatai → 049 → 050). Migracija veiktų
-- ir taikoma prieš `048_bylaws_enforcement` – tada tų trigger'ių tiesiog dar nėra.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Pagalbinės funkcijos
-- ----------------------------------------------------------------------------

-- Ar narys šiuo metu turi balso teisę Tarybos posėdyje?
--
-- Kriterijus VIENODAS su `bylaws_participation_guard` (įstatų atitikties
-- migracija): galiojanti `pirmininkas` arba `tarybos_narys` rolė (5.1 p. –
-- Pirmininkas renkamas iš Tarybos narių, 5.5 p. – posėdyje sprendžia Taryba),
-- IR jokios galiojančios `revizorius` rolės (6.2 p. – Revizorius negali būti
-- valdymo organo nariu). Tą patį rolių sąrašą naudoja ir dalyvių sąrašas
-- `fetchEligibleAttendees` (src/actions/meetings.ts).
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
      AND cm.role IN ('pirmininkas', 'tarybos_narys')
      -- Pareigos turi būti prasidėjusios: įstatų atitikties migracijos
      -- `bylaws_participation_guard` ir bazės fiksavimas reikalauja
      -- `term_start <= šiandien` (NULL term_start – dar ne Tarybos narys).
      AND cm.term_start <= (now() AT TIME ZONE 'Europe/Vilnius')::date
  ) AND NOT EXISTS (
    SELECT 1 FROM public.community_management cm
    WHERE cm.member_id = p_member_id
      AND cm.is_current = true
      AND cm.role = 'revizorius'
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
-- Jau įrašytų balsų valymas, kai narys nebėra Tarybos narys
-- ----------------------------------------------------------------------------
-- `_member_can_vote` stabdo tik NAUJĄ balsą. Jei narys balsavo iš anksto, o
-- paskui iki posėdžio neteko Tarybos nario statuso, jo `vote_ballots` ir
-- `resolutions.result_*` liktų suskaičiuoti. Tai tas pats scenarijus, kurį
-- narystės statusui tvarko `on_member_status_change` (migr. 038–040), todėl
-- elgiamės lygiai taip pat – tik apimtis siauresnė: BŪSIMI Tarybos posėdžiai
-- (`meeting_date > NOW()`). Jau prasidėjęs posėdis (`vyksta` – pagal
-- `bylaws_meeting_guard` jis prasideda tik atėjus jo laikui) į apimtį nepatenka
-- lygiai kaip ir `on_member_status_change` atveju; ten balso teisę netekusį
-- dalyvį uždarant nutarimą sustabdo `bylaws_resolution_guard`.
--
-- KVORUMO (`total_members_at_time`, `quorum_required`) šis valymas NELIEČIA:
-- Tarybos posėdžio kvorumo bazė yra Tarybos nariai, o `on_member_status_change`
-- perskaičiuoja bendruomenės narių bazę. Prasidėjusio posėdžio bazę
-- `bylaws_meeting_guard` užfiksuoja `electorate_snapshot` lauke ir vėliau
-- keisti neleidžia – tai posėdžio momento faktas, ne formulė (CLAUDE.md
-- „Posėdžio dalyvių registracija ir kvorumas").
CREATE OR REPLACE FUNCTION public._purge_council_ineligible_votes(p_member_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_res_ids UUID[];
  v_ballots_deleted INT := 0;
  v_att_deleted INT := 0;
BEGIN
  IF p_member_id IS NULL THEN
    RETURN;
  END IF;

  -- UŽRAKTAS: TIK advisory, jokio `members ... FOR UPDATE`.
  --
  -- Serializacija su balsavimu remiasi tuo, kad įstatų atitikties migracijos
  -- `bylaws_ballot` / `bylaws_attendance` BEFORE trigger'iai ima TĄ PATĮ
  -- advisory užraktą kiekvienam `vote_ballots` / `meeting_attendance` įrašui,
  -- o `bylaws_council_lock` – kiekvienam `community_management` pakeitimui.
  -- Todėl balsas negali „prasprūsti" tarp patikros ir valymo.
  --
  -- Eilutės užrakto čia sąmoningai NEIMAM: `bylaws_council_lock` yra BEFORE
  -- trigger'is, t. y. Tarybos sudėties transakcija advisory jau laiko, o nario
  -- statuso transakcija eina atvirkščiai (eilutė → advisory). Paėmus čia dar ir
  -- eilutės užraktą susidarytų ABBA ciklas. Advisory yra re-entrant, todėl
  -- pakartotinis paėmimas toje pačioje transakcijoje nieko nekainuoja.
  PERFORM pg_advisory_xact_lock(hashtext('members_voting_eligibility'));

  IF NOT EXISTS (SELECT 1 FROM members WHERE id = p_member_id) THEN
    -- Nario įrašo nebėra (ištrintas) – susietas eilutes jau sutvarkė FK, o
    -- bandymas trinti jas dar kartą užkliūtų už `bylaws_ballot` sargybos.
    RETURN;
  END IF;

  -- Sprendimas priimamas TIK po užrakto – kitaip tarp patikros ir valymo
  -- galėtų įsiterpti Tarybos sudėties pakeitimas.
  IF public._is_current_council_member(p_member_id) THEN
    RETURN;
  END IF;

  UPDATE meeting_voting_tokens t
  SET expires_at = NOW()
  FROM meetings m
  WHERE m.id = t.meeting_id
    AND t.member_id = p_member_id
    AND t.voted_at IS NULL
    AND t.expires_at > NOW()
    AND m.meeting_type = 'valdybos'
    AND m.status NOT IN ('baigtas', 'atšauktas')
    AND m.meeting_date > NOW();

  -- GALUTINIAI NUTARIMAI NELIEČIAMI. `bylaws_participation_guard` neleidžia
  -- trinti balso iš `patvirtintas`/`atmestas` nutarimo, o `bylaws_resolution_guard`
  -- atmeta bet kokį tokio nutarimo laukų keitimą. Tai ne kliūtis, o ta pati
  -- taisyklė: priimtas sprendimas yra užfiksuotas faktas ir taisomas atskiru
  -- protokolo taisymu, ne šiuo valymu.
  SELECT array_agg(vb.resolution_id) INTO v_res_ids
  FROM vote_ballots vb
  JOIN resolutions r ON r.id = vb.resolution_id
  JOIN meetings m ON m.id = r.meeting_id
  WHERE vb.member_id = p_member_id
    AND r.status NOT IN ('patvirtintas', 'atmestas')
    AND m.meeting_type = 'valdybos'
    AND m.status NOT IN ('baigtas', 'atšauktas')
    AND m.meeting_date > NOW();

  IF v_res_ids IS NOT NULL THEN
    DELETE FROM vote_ballots
    WHERE member_id = p_member_id AND resolution_id = ANY (v_res_ids);
    GET DIAGNOSTICS v_ballots_deleted = ROW_COUNT;

    UPDATE resolutions r
    SET
      result_for = (SELECT count(*) FROM vote_ballots WHERE resolution_id = r.id AND vote = 'uz'),
      result_against = (SELECT count(*) FROM vote_ballots WHERE resolution_id = r.id AND vote = 'pries'),
      result_abstain = (SELECT count(*) FROM vote_ballots WHERE resolution_id = r.id AND vote = 'susilaike')
    WHERE r.id = ANY (v_res_ids)
      -- Ta pati sąlyga pakartojama ir čia: tarp dviejų komandų statusas galėjo
      -- pasikeisti, o galutinio nutarimo UPDATE'as būtų atmestas su klaida.
      AND r.status NOT IN ('patvirtintas', 'atmestas');
  END IF;

  DELETE FROM meeting_attendance ma
  USING meetings m
  WHERE ma.meeting_id = m.id
    AND ma.member_id = p_member_id
    AND m.meeting_type = 'valdybos'
    AND m.status NOT IN ('baigtas', 'atšauktas')
    AND m.meeting_date > NOW();
  GET DIAGNOSTICS v_att_deleted = ROW_COUNT;

  -- Panaudotas tokenas grąžinamas į „nebalsuotą-anuliuotą" būseną – lygiai
  -- kaip migr. 039, kad jo nebūtų galima panaudoti dar kartą.
  UPDATE meeting_voting_tokens t
  SET voted_at = NULL, expires_at = NOW()
  FROM meetings m
  WHERE m.id = t.meeting_id
    AND t.member_id = p_member_id
    AND t.voted_at IS NOT NULL
    AND m.meeting_type = 'valdybos'
    AND m.status NOT IN ('baigtas', 'atšauktas')
    AND m.meeting_date > NOW();

  IF v_ballots_deleted > 0 OR v_att_deleted > 0 THEN
    INSERT INTO audit_log (user_id, action, table_name, record_id, old_data)
    VALUES (
      NULL, 'DELETE', 'vote_ballots', p_member_id,
      jsonb_build_object(
        'reason', 'member_not_council_anymore',
        'ballots_deleted', v_ballots_deleted,
        'attendance_deleted', v_att_deleted
      )
    );
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public._purge_council_ineligible_votes(uuid) FROM PUBLIC, anon, authenticated;

-- Trigger'is: bet koks `community_management` pasikeitimas gali atimti balso
-- teisę Tarybos posėdyje. AFTER – kad `_is_current_council_member` jau matytų
-- naują būseną.
--
-- Atvirkštinės pusės (narys TAPO Tarybos nariu) atstatyti nereikia: Tarybos
-- posėdžiui SMS tokenai išvis negeneruojami (`RemoteVotingPanel` jame
-- nerodomas), todėl nėra ko grąžinti.
CREATE OR REPLACE FUNCTION public.on_council_membership_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_old UUID := NULL;
  v_new UUID := NULL;
BEGIN
  -- OLD/NEW imami TIK ten, kur jie priskirti: DELETE atveju `NEW` neegzistuoja,
  -- INSERT atveju – `OLD`. Todėl jokių CASE išraiškų su abiem įrašais.
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_old := OLD.member_id;
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_new := NEW.member_id;
  END IF;

  IF v_old IS NOT NULL THEN
    PERFORM public._purge_council_ineligible_votes(v_old);
  END IF;
  IF v_new IS NOT NULL AND v_new IS DISTINCT FROM v_old THEN
    PERFORM public._purge_council_ineligible_votes(v_new);
  END IF;

  RETURN NULL; -- AFTER trigger'io grąžinama reikšmė nenaudojama
END;
$function$;

REVOKE ALL ON FUNCTION public.on_council_membership_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS council_membership_change_sync ON public.community_management;
CREATE TRIGGER council_membership_change_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.community_management
  FOR EACH ROW
  EXECUTE FUNCTION public.on_council_membership_change();

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
  -- ISTORIJOJE tikrinam TIK `is_published` (migr. 045 vartai lieka), o NE
  -- `_member_meeting_visible`. Organo patikra čia netinka: pasibaigus kadencijai
  -- narys nustoja būti Tarybos nariu, ir visi jo praėję Tarybos posėdžiai
  -- dingtų iš jo paties istorijos. Teisę dalyvauti TUOMET įrodo pats faktas,
  -- kurį žemiau ir tikrinam – jo balsas arba dalyvavimo įrašas.
  WHERE m.is_published
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

-- ----------------------------------------------------------------------------
-- Vienkartinis valymas
-- ----------------------------------------------------------------------------
-- Senasis RPC ne Tarybos nariams balsuoti Tarybos posėdyje leido, todėl vien
-- naujos taisyklės nepakanka – jau įrašyti balsai lieka. Praeinam per visus
-- narius, kurie turi balsą arba dalyvavimo įrašą BŪSIMAME Tarybos posėdyje;
-- pats helper'is dabartinius Tarybos narius praleidžia.
--
-- ĮVYKUSIŲ (baigtų) posėdžių ir GALUTINIŲ nutarimų NELIEČIAM: protokolas
-- pasirašytas, rezultatai paskelbti – tai istorinis faktas, o ne taisytini
-- duomenys. Jei ten būtų klaida, ji sprendžiama Tarybos sprendimu, ne
-- migracija. Tą patį saugo `bylaws_participation_guard`, todėl be šio filtro
-- migracija tiesiog nulūžtų.
DO $$
DECLARE
  v_member_id UUID;
BEGIN
  FOR v_member_id IN
    SELECT vb.member_id
    FROM public.vote_ballots vb
    JOIN public.resolutions r ON r.id = vb.resolution_id
    JOIN public.meetings m ON m.id = r.meeting_id
    WHERE r.status NOT IN ('patvirtintas', 'atmestas')
      AND m.meeting_type = 'valdybos'
      AND m.status NOT IN ('baigtas', 'atšauktas')
      AND m.meeting_date > NOW()
    UNION
    SELECT ma.member_id
    FROM public.meeting_attendance ma
    JOIN public.meetings m ON m.id = ma.meeting_id
    WHERE m.meeting_type = 'valdybos'
      AND m.status NOT IN ('baigtas', 'atšauktas')
      AND m.meeting_date > NOW()
  LOOP
    PERFORM public._purge_council_ineligible_votes(v_member_id);
  END LOOP;
END
$$;
