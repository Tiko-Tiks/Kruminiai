-- Bylaws adopted 2025-12-07: new decisions are checked, historical facts are not rewritten.
-- Application and database guards deliberately agree. Deploy with the matching application.
ALTER TABLE public.members
  ADD COLUMN application_reference text,
  ADD COLUMN admission_reference text,
  ADD COLUMN admission_date date;
ALTER TABLE public.fee_periods ADD COLUMN decision_reference text, ADD COLUMN decision_date date;
ALTER TABLE public.meetings
  ADD COLUMN previous_meeting_id uuid REFERENCES public.meetings(id) ON DELETE RESTRICT,
  ADD COLUMN majority_rule text CHECK (majority_rule IN ('for_against', 'participants')),
  ADD COLUMN majority_reference text;
ALTER TABLE public.resolutions
  ADD COLUMN source_resolution_id uuid REFERENCES public.resolutions(id) ON DELETE RESTRICT,
  ADD COLUMN participants_at_decision integer,
  ADD COLUMN decision_basis jsonb,
  ADD COLUMN ballot_snapshot jsonb,
  ADD COLUMN chair_vote text CHECK (chair_vote IN ('uz', 'pries', 'susilaike'));
CREATE INDEX meetings_previous_meeting_idx ON public.meetings(previous_meeting_id) WHERE previous_meeting_id IS NOT NULL;
CREATE INDEX resolutions_source_resolution_idx ON public.resolutions(source_resolution_id) WHERE source_resolution_id IS NOT NULL;

-- Keep the already stored history; require evidence for new admissions and re-admissions.
CREATE FUNCTION public.bylaws_admission_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NEW.status IN ('aktyvus', 'pasyvus', 'garbes_narys') AND
     (TG_OP = 'INSERT' OR OLD.status NOT IN ('aktyvus', 'pasyvus', 'garbes_narys')) THEN
    IF nullif(btrim(NEW.application_reference), '') IS NULL OR
       nullif(btrim(NEW.admission_reference), '') IS NULL OR NEW.admission_date IS NULL THEN
      RAISE EXCEPTION 'Narystei būtinas raštiško prašymo ir Tarybos sprendimo pagrindas bei data (3.2 p.)';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER bylaws_admission BEFORE INSERT OR UPDATE ON public.members
FOR EACH ROW EXECUTE FUNCTION public.bylaws_admission_guard();

CREATE FUNCTION public.bylaws_fee_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (NEW.amount_cents, NEW.due_date, NEW.fee_type, NEW.year, NEW.decision_reference, NEW.decision_date)
      IS DISTINCT FROM (OLD.amount_cents, OLD.due_date, OLD.fee_type, OLD.year, OLD.decision_reference, OLD.decision_date) THEN
    IF nullif(btrim(NEW.decision_reference), '') IS NULL OR NEW.decision_date IS NULL THEN
      RAISE EXCEPTION 'Mokesčiui būtinas Visuotinio susirinkimo sprendimo pagrindas (3.7, 4.8.5 p.)';
    END IF;
    IF NEW.amount_cents <= 0 THEN RAISE EXCEPTION 'Mokestis turi būti teigiamas'; END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER bylaws_fee BEFORE INSERT OR UPDATE ON public.fee_periods
FOR EACH ROW EXECUTE FUNCTION public.bylaws_fee_guard();

CREATE FUNCTION public.bylaws_meeting_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE expected integer;
BEGIN
  IF TG_OP = 'UPDATE' AND EXISTS (SELECT 1 FROM public.meetings WHERE previous_meeting_id = OLD.id) AND
      (NEW.status, NEW.meeting_date, NEW.total_members_at_time, NEW.meeting_type) IS DISTINCT FROM
      (OLD.status, OLD.meeting_date, OLD.total_members_at_time, OLD.meeting_type) THEN
    RAISE EXCEPTION 'Susirinkimas naudojamas kaip pakartotinio pagrindas; keisti jo faktų negalima';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.total_members_at_time, NEW.quorum_required, NEW.meeting_type, NEW.previous_meeting_id, NEW.majority_rule, NEW.majority_reference)
     IS NOT DISTINCT FROM (OLD.total_members_at_time, OLD.quorum_required, OLD.meeting_type, OLD.previous_meeting_id, OLD.majority_rule, OLD.majority_reference) THEN
    RETURN NEW;
  END IF;
  expected := CASE WHEN NEW.meeting_type = 'pakartotinis' OR NEW.total_members_at_time = 0 THEN 0 ELSE NEW.total_members_at_time / 2 + 1 END;
  IF NEW.total_members_at_time < 0 OR NEW.quorum_required IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'Kvorumas turi atitikti įstatų formulę (4.5, 5.5 p.)';
  END IF;
  IF NEW.previous_meeting_id = NEW.id THEN RAISE EXCEPTION 'Susirinkimas negali kartoti pats savęs'; END IF;
  NEW.is_repeat := NEW.meeting_type = 'pakartotinis';
  RETURN NEW;
END; $$;
CREATE TRIGGER bylaws_meeting BEFORE INSERT OR UPDATE ON public.meetings
FOR EACH ROW EXECUTE FUNCTION public.bylaws_meeting_guard();

-- All participation / ballot writes serialize against their meeting and final decision.
-- Covers both token RPCs, account RPCs, manual entry and direct Data API writes.
CREATE FUNCTION public.bylaws_participation_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE mid uuid; memberid uuid; mt text; ms text; rs text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('members_voting_eligibility'));
  IF TG_TABLE_NAME = 'vote_ballots' THEN
    IF TG_OP = 'DELETE' THEN
      SELECT r.meeting_id, r.status INTO mid, rs FROM public.resolutions r WHERE r.id = OLD.resolution_id FOR UPDATE;
      memberid := OLD.member_id;
    ELSE
      IF TG_OP = 'UPDATE' AND (NEW.resolution_id, NEW.member_id) IS DISTINCT FROM (OLD.resolution_id, OLD.member_id) THEN
        RAISE EXCEPTION 'Balso tapatybės keisti negalima';
      END IF;
      SELECT r.meeting_id, r.status INTO mid, rs FROM public.resolutions r WHERE r.id = NEW.resolution_id FOR UPDATE;
      memberid := NEW.member_id;
    END IF;
    IF rs IN ('patvirtintas', 'atmestas') THEN RAISE EXCEPTION 'Nutarimas jau uždarytas'; END IF;
  ELSE
    IF TG_OP = 'DELETE' THEN mid := OLD.meeting_id; memberid := OLD.member_id;
    ELSE
      IF TG_OP = 'UPDATE' AND (NEW.meeting_id, NEW.member_id) IS DISTINCT FROM (OLD.meeting_id, OLD.member_id) THEN
        RAISE EXCEPTION 'Dalyvavimo tapatybės keisti negalima';
      END IF;
      mid := NEW.meeting_id; memberid := NEW.member_id;
    END IF;
  END IF;
  SELECT meeting_type, status INTO mt, ms FROM public.meetings WHERE id = mid FOR UPDATE;
  IF NOT FOUND THEN
    -- Cascading deletion of an unused draft is allowed.
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'Susirinkimas nerastas';
  END IF;
  IF ms IN ('baigtas', 'atšauktas') THEN RAISE EXCEPTION 'Susirinkimas uždarytas'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.members WHERE id = memberid AND status IN ('aktyvus', 'pasyvus', 'garbes_narys')) THEN
    RAISE EXCEPTION 'Asmuo neturi galiojančios narystės';
  END IF;
  IF mt = 'valdybos' AND (NOT EXISTS (
    SELECT 1 FROM public.community_management WHERE member_id = memberid AND is_current AND role IN ('pirmininkas', 'tarybos_narys')
  ) OR EXISTS (
    SELECT 1 FROM public.community_management WHERE member_id = memberid AND is_current AND role = 'revizorius'
  )) THEN RAISE EXCEPTION 'Tarybos posėdyje balsuoja tik Tarybos nariai (5.1, 5.5, 6.2 p.)'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER bylaws_ballot BEFORE INSERT OR UPDATE OR DELETE ON public.vote_ballots
FOR EACH ROW EXECUTE FUNCTION public.bylaws_participation_guard();
CREATE TRIGGER bylaws_attendance BEFORE INSERT OR UPDATE OR DELETE ON public.meeting_attendance
FOR EACH ROW EXECUTE FUNCTION public.bylaws_participation_guard();

CREATE FUNCTION public.bylaws_resolution_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE m public.meetings%ROWTYPE; previous public.meetings%ROWTYPE; source public.resolutions%ROWTYPE;
  participants integer; prior_participants integer; live_capacity integer;
  f integer; a integer; s integer; passed boolean; threshold integer;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IN ('patvirtintas', 'atmestas') THEN
    IF (NEW.status, NEW.meeting_id, NEW.title, NEW.description, NEW.decision_text, NEW.requires_qualified_majority,
        NEW.result_for, NEW.result_against, NEW.result_abstain, NEW.source_resolution_id, NEW.chair_vote, NEW.participants_at_decision, NEW.decision_basis)
       IS DISTINCT FROM
       (OLD.status, OLD.meeting_id, OLD.title, OLD.description, OLD.decision_text, OLD.requires_qualified_majority,
        OLD.result_for, OLD.result_against, OLD.result_abstain, OLD.source_resolution_id, OLD.chair_vote, OLD.participants_at_decision, OLD.decision_basis) THEN
      RAISE EXCEPTION 'Galutinis sprendimas užfiksuotas; reikia atskiro protokolo taisymo';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.status NOT IN ('patvirtintas', 'atmestas') THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('members_voting_eligibility'));
  SELECT * INTO m FROM public.meetings WHERE id = NEW.meeting_id FOR UPDATE;
  IF NOT FOUND OR m.status IN ('baigtas', 'atšauktas') THEN RAISE EXCEPTION 'Susirinkimas nerastas arba uždarytas'; END IF;
  IF EXISTS (SELECT 1 FROM public.meeting_attendance ma JOIN public.members mb ON mb.id = ma.member_id
    WHERE ma.meeting_id = m.id AND (mb.status NOT IN ('aktyvus', 'pasyvus', 'garbes_narys') OR
      (m.meeting_type = 'valdybos' AND (NOT EXISTS (SELECT 1 FROM public.community_management cm WHERE cm.member_id = mb.id AND cm.is_current AND cm.role IN ('pirmininkas', 'tarybos_narys'))
        OR EXISTS (SELECT 1 FROM public.community_management cm WHERE cm.member_id = mb.id AND cm.is_current AND cm.role = 'revizorius'))))) THEN
    RAISE EXCEPTION 'Dalyvių sąraše yra asmenų be šio susirinkimo balso teisės; patikrinkite dalyvavimą';
  END IF;
  IF EXISTS (SELECT 1 FROM public.vote_ballots vb WHERE vb.resolution_id = NEW.id
      AND NOT EXISTS (SELECT 1 FROM public.meeting_attendance ma WHERE ma.meeting_id = m.id AND ma.member_id = vb.member_id)) THEN
    RAISE EXCEPTION 'Balsavęs narys neįregistruotas dalyvių sąraše';
  END IF;
  SELECT count(DISTINCT member_id) INTO participants FROM public.meeting_attendance WHERE meeting_id = m.id;
  IF participants < 1 OR m.total_members_at_time < 1 OR participants > m.total_members_at_time THEN
    RAISE EXCEPTION 'Neteisingas narių arba registruotų dalyvių skaičius';
  END IF;
  IF m.meeting_type = 'pakartotinis' THEN
    SELECT * INTO previous FROM public.meetings WHERE id = m.previous_meeting_id FOR SHARE;
    IF NOT FOUND OR previous.meeting_type NOT IN ('visuotinis', 'neeilinis') OR previous.status <> 'baigtas'
       OR previous.meeting_date >= m.meeting_date OR previous.total_members_at_time < 1
       OR EXISTS (SELECT 1 FROM public.resolutions WHERE meeting_id = previous.id AND status IN ('patvirtintas', 'atmestas')) THEN
      RAISE EXCEPTION 'Nėra ankstesnio neįvykusio susirinkimo pagrindo (4.6 p.)';
    END IF;
    SELECT count(DISTINCT member_id) INTO prior_participants FROM public.meeting_attendance WHERE meeting_id = previous.id;
    IF 2 * prior_participants > previous.total_members_at_time THEN RAISE EXCEPTION 'Ankstesniame susirinkime buvo kvorumas'; END IF;
    SELECT * INTO source FROM public.resolutions WHERE id = NEW.source_resolution_id AND meeting_id = previous.id;
    IF NOT FOUND OR (NEW.title, coalesce(NEW.description, ''), NEW.requires_qualified_majority)
        IS DISTINCT FROM (source.title, coalesce(source.description, ''), source.requires_qualified_majority) THEN
      RAISE EXCEPTION 'Pakartotiniame susirinkime leidžiami tik ankstesnės darbotvarkės klausimai (4.6 p.)';
    END IF;
  ELSIF participants * 2 <= m.total_members_at_time THEN
    RAISE EXCEPTION 'Nėra kvorumo: reikia daugiau kaip pusės narių';
  END IF;
  IF nullif(btrim(NEW.decision_text), '') IS NULL THEN RAISE EXCEPTION 'Būtinas NUTARTA tekstas'; END IF;
  IF least(NEW.result_for, NEW.result_against, NEW.result_abstain) < 0 OR
      NEW.result_for IS NULL OR NEW.result_against IS NULL OR NEW.result_abstain IS NULL OR
      NEW.result_for + NEW.result_against + NEW.result_abstain NOT BETWEEN 1 AND participants THEN
    RAISE EXCEPTION 'Balsų suma turi būti teigiama ir neviršyti dalyvių skaičiaus';
  END IF;
  SELECT count(*) FILTER (WHERE vote = 'uz'), count(*) FILTER (WHERE vote = 'pries'), count(*) FILTER (WHERE vote = 'susilaike')
    INTO f, a, s FROM public.vote_ballots WHERE resolution_id = NEW.id;
  IF NEW.ballot_snapshot IS DISTINCT FROM jsonb_build_object('uz', f, 'pries', a, 'susilaike', s) THEN
    RAISE EXCEPTION 'Balsų duomenys pasikeitė. Atnaujinkite puslapį ir pakartokite rezultatų įrašymą';
  END IF;
  SELECT count(*) INTO live_capacity FROM public.meeting_attendance ma
    WHERE ma.meeting_id = m.id AND ma.attendance_type = 'fizinis'
    AND NOT EXISTS (SELECT 1 FROM public.vote_ballots vb WHERE vb.resolution_id = NEW.id AND vb.member_id = ma.member_id);
  IF NEW.result_for < f OR NEW.result_against < a OR NEW.result_abstain < s OR
      NEW.result_for + NEW.result_against + NEW.result_abstain - f - a - s > live_capacity THEN
    RAISE EXCEPTION 'Papildomi gyvi balsai viršija dar nebalsavusių gyvų dalyvių skaičių';
  END IF;
  IF NEW.requires_qualified_majority THEN
    passed := NEW.result_for * 3 >= participants * 2;
  ELSE
    IF m.majority_rule IS NULL OR nullif(btrim(m.majority_reference), '') IS NULL THEN
      RAISE EXCEPTION 'Būtina patvirtinta paprastos daugumos tvarka ir jos pagrindas';
    END IF;
    IF m.meeting_type = 'valdybos' AND NEW.result_for = NEW.result_against THEN
      IF NEW.chair_vote IS NULL OR nullif(btrim(m.chairperson_name), '') IS NULL OR
         (NEW.chair_vote = 'uz' AND NEW.result_for < 1) OR (NEW.chair_vote = 'pries' AND NEW.result_against < 1) OR
         (NEW.chair_vote = 'susilaike' AND NEW.result_abstain < 1) THEN
        RAISE EXCEPTION 'Būtinas posėdžio pirmininkas ir jo jau įskaičiuotas balsas (5.5 p.)';
      END IF;
      passed := NEW.chair_vote = 'uz';
    ELSE
      passed := CASE m.majority_rule WHEN 'participants' THEN NEW.result_for * 2 > participants ELSE NEW.result_for > NEW.result_against END;
    END IF;
  END IF;
  IF (NEW.status = 'patvirtintas') IS DISTINCT FROM passed THEN RAISE EXCEPTION 'Nutarimo statusas neatitinka balsų daugumos'; END IF;
  IF NEW.procedural_type = 'pranesimas' AND NEW.status = 'patvirtintas' AND m.meeting_type <> 'valdybos' THEN
    threshold := CASE WHEN m.meeting_type = 'neeilinis' THEN 7 ELSE 14 END;
    IF NOT EXISTS (SELECT 1 FROM public.meeting_announcements WHERE meeting_id = m.id
        AND channel IN ('web', 'facebook', 'email', 'paper', 'rc')
        AND published_at <= m.meeting_date - make_interval(days => threshold)) THEN
      RAISE EXCEPTION 'Nėra laiku paskelbto pranešimo įstatų 8.1 p. kanalu';
    END IF;
  END IF;
  NEW.participants_at_decision := participants;
  NEW.decision_basis := jsonb_build_object('bylaws', '2025-12-07', 'total_members', m.total_members_at_time,
    'participants', participants, 'meeting_type', m.meeting_type, 'majority_rule', m.majority_rule,
    'majority_reference', m.majority_reference, 'previous_meeting_id', m.previous_meeting_id,
    'recorded_at', now());
  NEW.early_voting_open := false;
  RETURN NEW;
END; $$;
CREATE TRIGGER bylaws_resolution BEFORE INSERT OR UPDATE ON public.resolutions
FOR EACH ROW EXECUTE FUNCTION public.bylaws_resolution_guard();

-- Explicit RC channel; SMS remains available as supplementary communication.
ALTER TABLE public.meeting_announcements DROP CONSTRAINT IF EXISTS meeting_announcements_channel_check;
ALTER TABLE public.meeting_announcements ADD CONSTRAINT meeting_announcements_channel_check
CHECK (channel IN ('web', 'facebook', 'email', 'sms', 'paper', 'rc', 'other'));

REVOKE ALL ON FUNCTION public.bylaws_admission_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bylaws_fee_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bylaws_meeting_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bylaws_participation_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bylaws_resolution_guard() FROM PUBLIC, anon, authenticated;

-- Existing membership-status synchronization must not rewrite final decisions or
-- replace council membership counts with the whole association's member count.
CREATE OR REPLACE FUNCTION public.on_member_status_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE was_eligible boolean := OLD.status IN ('aktyvus', 'pasyvus', 'garbes_narys');
  eligible boolean := NEW.status IN ('aktyvus', 'pasyvus', 'garbes_narys');
  res_ids uuid[]; deleted_votes integer := 0; deleted_attendance integer := 0;
BEGIN
  IF was_eligible = eligible THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('members_voting_eligibility'));
  IF was_eligible AND NOT eligible THEN
    UPDATE public.meeting_voting_tokens SET expires_at = now() WHERE member_id = NEW.id AND expires_at > now();
    SELECT array_agg(vb.resolution_id) INTO res_ids FROM public.vote_ballots vb
      JOIN public.resolutions r ON r.id = vb.resolution_id JOIN public.meetings m ON m.id = r.meeting_id
      WHERE vb.member_id = NEW.id AND m.status NOT IN ('baigtas', 'atšauktas') AND m.meeting_date > now()
        AND r.status NOT IN ('patvirtintas', 'atmestas');
    IF res_ids IS NOT NULL THEN
      DELETE FROM public.vote_ballots WHERE member_id = NEW.id AND resolution_id = ANY(res_ids);
      GET DIAGNOSTICS deleted_votes = ROW_COUNT;
      UPDATE public.resolutions r SET
        result_for = (SELECT count(*) FROM public.vote_ballots WHERE resolution_id = r.id AND vote = 'uz'),
        result_against = (SELECT count(*) FROM public.vote_ballots WHERE resolution_id = r.id AND vote = 'pries'),
        result_abstain = (SELECT count(*) FROM public.vote_ballots WHERE resolution_id = r.id AND vote = 'susilaike')
        WHERE id = ANY(res_ids);
    END IF;
    DELETE FROM public.meeting_attendance ma USING public.meetings m
      WHERE ma.meeting_id = m.id AND ma.member_id = NEW.id AND m.status NOT IN ('baigtas', 'atšauktas') AND m.meeting_date > now();
    GET DIAGNOSTICS deleted_attendance = ROW_COUNT;
    IF deleted_votes > 0 OR deleted_attendance > 0 THEN
      INSERT INTO public.audit_log(user_id, action, table_name, record_id, old_data)
      VALUES (NULL, 'DELETE', 'vote_ballots', NEW.id, jsonb_build_object('reason', 'member_lost_voting_rights',
        'old_status', OLD.status, 'new_status', NEW.status, 'ballots_deleted', deleted_votes, 'attendance_deleted', deleted_attendance));
    END IF;
  END IF;
  -- No automatic token resurrection on re-admission: expired invitations remain expired.
  WITH counts AS (
    SELECT m.id, count(DISTINCT mb.id)::integer AS total FROM public.meetings m
    LEFT JOIN public.members mb ON mb.status IN ('aktyvus', 'pasyvus', 'garbes_narys') AND
      (m.meeting_type <> 'valdybos' OR EXISTS (SELECT 1 FROM public.community_management cm
       WHERE cm.member_id = mb.id AND cm.is_current AND cm.role IN ('pirmininkas', 'tarybos_narys')))
    WHERE m.status NOT IN ('baigtas', 'atšauktas') AND m.meeting_date > now()
      AND NOT EXISTS (SELECT 1 FROM public.resolutions r WHERE r.meeting_id = m.id AND r.status IN ('patvirtintas', 'atmestas'))
    GROUP BY m.id
  )
  UPDATE public.meetings m SET total_members_at_time = c.total,
    quorum_required = CASE WHEN m.meeting_type = 'pakartotinis' OR c.total = 0 THEN 0 ELSE c.total / 2 + 1 END
    FROM counts c WHERE m.id = c.id;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.on_member_status_change() FROM PUBLIC, anon, authenticated;

-- Serialize council composition edits with eligibility checks. No term-end cutoff:
-- Article 5.7 preserves authority until successors take office.
CREATE FUNCTION public.bylaws_council_lock() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('members_voting_eligibility'));
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER bylaws_council_lock BEFORE INSERT OR UPDATE OR DELETE ON public.community_management
FOR EACH ROW EXECUTE FUNCTION public.bylaws_council_lock();
REVOKE ALL ON FUNCTION public.bylaws_council_lock() FROM PUBLIC, anon, authenticated;
