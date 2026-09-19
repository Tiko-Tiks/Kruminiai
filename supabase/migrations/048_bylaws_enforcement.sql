-- Bylaws adopted 2025-12-07: new decisions are checked, historical facts are not rewritten.
-- Application and database guards deliberately agree. Deploy with the matching application.
-- Renamed from 20260918185337_bylaws_enforcement.sql so that file order equals apply order (048 → 049 → 050); production already holds it under the MCP timestamp version, so the rename changes nothing there.
ALTER TABLE public.members
  ADD COLUMN application_reference text,
  ADD COLUMN admission_reference text,
  ADD COLUMN admission_date date;
ALTER TABLE public.documents ADD COLUMN deletion_pending boolean NOT NULL DEFAULT false;
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


ALTER TABLE public.members ADD COLUMN archived_at timestamptz;
ALTER TABLE public.meetings
  ADD COLUMN electorate_snapshot jsonb,
  ADD COLUMN convening_snapshot jsonb,
  ADD COLUMN convening_date date,
  ADD COLUMN convening_same_day_reference text,
  ADD COLUMN convening_total_members integer CHECK (convening_total_members > 0);

-- Evidence that cannot be inferred from an administrator's status checkbox.
ALTER TABLE public.members
  ADD COLUMN termination_kind text CHECK (termination_kind IN ('withdrawal', 'expulsion')),
  ADD COLUMN termination_reference text,
  ADD COLUMN termination_date date,
  ADD COLUMN expulsion_ground text CHECK (expulsion_ground IN ('3.4.1', '3.4.2', '3.4.3')),
  ADD COLUMN appeal_reference text;
ALTER TABLE public.meetings
  ADD COLUMN notice_channels text[] CHECK (notice_channels <@ ARRAY['web','facebook','email','paper','rc']::text[] AND array_position(notice_channels,NULL) IS NULL),
  ADD COLUMN notice_reference text,
  ADD COLUMN notice_day_rule text CHECK (notice_day_rule IN ('vilnius_calendar','elapsed_hours')),
  ADD COLUMN notice_day_reference text,
  ADD COLUMN repeat_notice_days integer CHECK (repeat_notice_days >= 0),
  ADD COLUMN repeat_notice_reference text,
  ADD COLUMN convening_kind text CHECK (convening_kind IN ('council', 'members')),
  ADD COLUMN convening_reference text,
  ADD COLUMN convening_requesters uuid[],
  ADD COLUMN chairperson_member_id uuid REFERENCES public.members(id);
ALTER TABLE public.resolutions ADD COLUMN decision_type text
  CHECK (decision_type IN ('ordinary','statutes','transformation','liquidation','council_election','council_removal','auditor_election','reports','fees','seat'));
CREATE INDEX meetings_chairperson_member_idx ON public.meetings(chairperson_member_id) WHERE chairperson_member_id IS NOT NULL;

-- Keep the already stored history; require evidence for new admissions and re-admissions.
-- Closed membership periods are evidence, inaccessible through the Data API.
CREATE TABLE public.bylaws_membership_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
  started_on date,
  ended_on date NOT NULL,
  application_reference text,
  admission_reference text,
  termination_reference text,
  termination_kind text,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bylaws_membership_periods_member_idx ON public.bylaws_membership_periods(member_id,started_on,ended_on);
ALTER TABLE public.bylaws_membership_periods ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bylaws_membership_periods FROM PUBLIC,anon,authenticated;

-- Annual fees may not cover entire years when membership did not exist.
-- This preserves existing annual-period amounts; it does not invent proration.
CREATE FUNCTION public.bylaws_fee_applies(p_member_id uuid,p_year integer) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM public.members m WHERE m.id=p_member_id
    AND coalesce(m.admission_date,m.join_date,DATE '2012-01-01') <= make_date(p_year,12,31)
    AND (m.status IN ('aktyvus','pasyvus','garbes_narys') OR m.termination_date>=make_date(p_year,1,1)))
    OR EXISTS(SELECT 1 FROM public.bylaws_membership_periods mp WHERE mp.member_id=p_member_id
      AND mp.started_on<=make_date(p_year,12,31) AND mp.ended_on>=make_date(p_year,1,1));
$$;
REVOKE ALL ON FUNCTION public.bylaws_fee_applies(uuid,integer) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.bylaws_fee_eligibility(p_member_ids uuid[] DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF public.is_admin() IS NOT TRUE THEN RAISE EXCEPTION 'Tik administratorius'; END IF;
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('member_id',m.id,'fee_period_ids',
    (SELECT coalesce(jsonb_agg(fp.id),'[]'::jsonb) FROM public.fee_periods fp WHERE public.bylaws_fee_applies(m.id,fp.year)))),'[]'::jsonb)
    FROM public.members m WHERE p_member_ids IS NULL OR m.id=ANY(p_member_ids));
END; $$;
REVOKE ALL ON FUNCTION public.bylaws_fee_eligibility(uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bylaws_fee_eligibility(uuid[]) TO authenticated;

CREATE FUNCTION public.bylaws_admission_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('members_voting_eligibility'));
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Nario istorijos ištrinti negalima; pasibaigusią narystę archyvuokite';
  END IF;
  IF NEW.archived_at IS NOT NULL AND NEW.status IN ('aktyvus','pasyvus','garbes_narys') THEN
    RAISE EXCEPTION 'Pirmiausia dokumentuokite narystės pabaigą';
  END IF;
  IF TG_OP='UPDATE' AND OLD.termination_kind IS NOT NULL
      AND NOT (OLD.status IN ('aktyvus','pasyvus','garbes_narys') AND NEW.status='išstojęs')
      AND (NEW.termination_kind,NEW.termination_reference,NEW.termination_date,NEW.expulsion_ground,NEW.appeal_reference)
        IS DISTINCT FROM (OLD.termination_kind,OLD.termination_reference,OLD.termination_date,OLD.expulsion_ground,OLD.appeal_reference) THEN
    RAISE EXCEPTION 'Narystės pabaigos pagrindas užfiksuotas; būtinas atskiras dokumentuotas taisymas';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IN ('aktyvus', 'pasyvus', 'garbes_narys') AND NEW.status = 'išstojęs' THEN
    IF NEW.termination_kind IS NULL OR nullif(btrim(NEW.termination_reference), '') IS NULL OR NEW.termination_date IS NULL THEN
      RAISE EXCEPTION 'Būtinas narystės pabaigos būdas, raštiško išstojimo prašymo arba Tarybos sprendimo pagrindas ir taikymo data';
    END IF;
    IF NEW.termination_date > (now() AT TIME ZONE 'Europe/Vilnius')::date THEN RAISE EXCEPTION 'Narystės pabaigos data dar neatėjo'; END IF;
    IF NEW.termination_kind = 'expulsion' AND (NEW.expulsion_ground IS NULL OR nullif(btrim(NEW.appeal_reference), '') IS NULL) THEN
      RAISE EXCEPTION 'Pašalinimui būtinas 3.4 p. pagrindas ir pranešimo apie teisę skųsti įrodymas (3.5 p.)';
    END IF;
    INSERT INTO public.audit_log(user_id, action, table_name, record_id, old_data, new_data)
      VALUES(auth.uid(), 'UPDATE', 'members', OLD.id, to_jsonb(OLD), to_jsonb(NEW));
  END IF;
  IF TG_OP = 'UPDATE' AND nullif(btrim(OLD.application_reference), '') IS NOT NULL
      AND nullif(btrim(OLD.admission_reference), '') IS NOT NULL AND OLD.admission_date IS NOT NULL
      AND (nullif(btrim(NEW.application_reference), '') IS NULL OR
           nullif(btrim(NEW.admission_reference), '') IS NULL OR NEW.admission_date IS NULL) THEN
    RAISE EXCEPTION 'Užregistruoto priėmimo pagrindo ištrinti negalima';
  END IF;
  IF NEW.status IN ('aktyvus', 'pasyvus', 'garbes_narys') AND
     (TG_OP = 'INSERT' OR OLD.status NOT IN ('aktyvus', 'pasyvus', 'garbes_narys')) THEN
    IF TG_OP='UPDATE' AND (OLD.termination_date IS NULL OR NEW.admission_date < OLD.termination_date
      OR btrim(NEW.admission_reference) IS NOT DISTINCT FROM btrim(OLD.admission_reference)
      OR btrim(NEW.application_reference) IS NOT DISTINCT FROM btrim(OLD.application_reference)) THEN
      RAISE EXCEPTION 'Pakartotiniam priėmimui būtinas naujas prašymas ir naujas Tarybos sprendimas po ankstesnės narystės pabaigos';
    END IF;
    IF nullif(btrim(NEW.application_reference), '') IS NULL OR
       nullif(btrim(NEW.admission_reference), '') IS NULL OR NEW.admission_date IS NULL THEN
      RAISE EXCEPTION 'Narystei būtinas raštiško prašymo ir Tarybos sprendimo pagrindas bei data (3.2 p.)';
    END IF;
  END IF;
  IF TG_OP='UPDATE' AND OLD.status='išstojęs' AND NEW.status IN ('aktyvus','pasyvus','garbes_narys') THEN
    INSERT INTO public.bylaws_membership_periods(member_id,started_on,ended_on,application_reference,admission_reference,termination_reference,termination_kind)
      VALUES(OLD.id,coalesce(OLD.admission_date,OLD.join_date),OLD.termination_date,OLD.application_reference,OLD.admission_reference,OLD.termination_reference,OLD.termination_kind);
    INSERT INTO public.audit_log(user_id,action,table_name,record_id,old_data,new_data)
      VALUES(auth.uid(),'UPDATE','members',OLD.id,to_jsonb(OLD),to_jsonb(NEW)||jsonb_build_object('reason','readmission'));
  ELSIF TG_OP='UPDATE' AND (NEW.application_reference,NEW.admission_reference,NEW.admission_date) IS DISTINCT FROM (OLD.application_reference,OLD.admission_reference,OLD.admission_date) THEN
    INSERT INTO public.audit_log(user_id,action,table_name,record_id,old_data,new_data) VALUES(auth.uid(),'UPDATE','members',OLD.id,to_jsonb(OLD),to_jsonb(NEW)||jsonb_build_object('reason','admission_evidence_correction'));
  END IF;
  IF NEW.status IN ('aktyvus','pasyvus','garbes_narys') AND NEW.admission_date > (now() AT TIME ZONE 'Europe/Vilnius')::date THEN
    RAISE EXCEPTION 'Priėmimo sprendimo data dar neatėjo';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER bylaws_admission BEFORE INSERT OR UPDATE OR DELETE ON public.members
FOR EACH ROW EXECUTE FUNCTION public.bylaws_admission_guard();

CREATE FUNCTION public.bylaws_fee_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD.due_date <= (now() AT TIME ZONE 'Europe/Vilnius')::date OR EXISTS(SELECT 1 FROM public.payments WHERE fee_period_id=OLD.id) THEN
      RAISE EXCEPTION 'Panaudoto mokesčio laikotarpio trinti negalima; būtinas dokumentuotas taisymas';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP='UPDATE' AND (
    (NEW.amount_cents,NEW.due_date,NEW.fee_type,NEW.year) IS DISTINCT FROM (OLD.amount_cents,OLD.due_date,OLD.fee_type,OLD.year)
    OR (OLD.decision_reference IS NOT NULL AND NEW.decision_reference IS DISTINCT FROM OLD.decision_reference)
    OR (OLD.decision_date IS NOT NULL AND NEW.decision_date IS DISTINCT FROM OLD.decision_date)) THEN
    RAISE EXCEPTION 'Mokesčio prievolė ir sprendimo pagrindas užfiksuoti; būtinas dokumentuotas taisymas';
  END IF;
  IF TG_OP = 'INSERT' OR (NEW.amount_cents, NEW.due_date, NEW.fee_type, NEW.year, NEW.decision_reference, NEW.decision_date)
      IS DISTINCT FROM (OLD.amount_cents, OLD.due_date, OLD.fee_type, OLD.year, OLD.decision_reference, OLD.decision_date) THEN
    IF nullif(btrim(NEW.decision_reference), '') IS NULL OR NEW.decision_date IS NULL THEN
      RAISE EXCEPTION 'Mokesčiui būtinas Visuotinio susirinkimo sprendimo pagrindas (3.7, 4.8.5 p.)';
    END IF;
    IF NEW.decision_date > (now() AT TIME ZONE 'Europe/Vilnius')::date THEN RAISE EXCEPTION 'Mokesčio sprendimo data dar neatėjo'; END IF;
    IF NEW.amount_cents <= 0 THEN RAISE EXCEPTION 'Mokestis turi būti teigiamas'; END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER bylaws_fee BEFORE INSERT OR UPDATE OR DELETE ON public.fee_periods
FOR EACH ROW EXECUTE FUNCTION public.bylaws_fee_guard();

CREATE FUNCTION public.bylaws_meeting_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE expected integer; ids uuid[]; signers uuid[]; total integer; capture boolean;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('members_voting_eligibility'));
  IF TG_OP='UPDATE' AND OLD.electorate_snapshot IS NOT NULL AND
    (NEW.electorate_snapshot, NEW.total_members_at_time, NEW.quorum_required, NEW.meeting_date) IS DISTINCT FROM
    (OLD.electorate_snapshot, OLD.total_members_at_time, OLD.quorum_required, OLD.meeting_date) THEN
    RAISE EXCEPTION 'Susirinkimo laiko narių bazė užfiksuota; būtinas atskiras dokumentuotas taisymas';
  END IF;
  IF TG_OP='UPDATE' AND OLD.status IN ('baigtas','atšauktas') AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Uždaryto susirinkimo atidaryti negalima; būtinas atskiras dokumentuotas taisymas';
  END IF;
  IF TG_OP='UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status NOT IN ('vyksta','baigtas')
    AND EXISTS(SELECT 1 FROM public.resolutions WHERE meeting_id=OLD.id AND status IN ('patvirtintas','atmestas')) THEN
    RAISE EXCEPTION 'Priėmus nutarimą susirinkimo atšaukti ar grąžinti į ankstesnę būseną negalima';
  END IF;
  IF TG_OP='UPDATE' AND OLD.status='baigtas' AND NEW.ended_at IS DISTINCT FROM OLD.ended_at THEN RAISE EXCEPTION 'Protokolo pabaigos laikas užfiksuotas'; END IF;
  capture := NEW.electorate_snapshot IS NULL AND NEW.status='vyksta' AND (TG_OP='INSERT' OR OLD.status<>'vyksta');
  IF capture OR ((TG_OP='INSERT' OR OLD.electorate_snapshot IS NULL) AND NEW.electorate_snapshot IS NOT NULL) THEN
    IF capture OR NEW.electorate_snapshot = '{"capture":true}'::jsonb THEN
      IF NEW.meeting_date > now() OR (NEW.meeting_date AT TIME ZONE 'Europe/Vilnius')::date <> (now() AT TIME ZONE 'Europe/Vilnius')::date THEN
        RAISE EXCEPTION 'Dabartinę narių bazę fiksuokite susirinkimo dieną jam prasidėjus; istoriniam reikia dokumento';
      END IF;
      IF NEW.status='baigtas' THEN RAISE EXCEPTION 'Istoriniam susirinkimui reikia dokumentuoto to laiko narių skaičiaus'; END IF;
      SELECT array_agg(DISTINCT mb.id) INTO ids FROM public.members mb
        WHERE mb.status IN ('aktyvus','pasyvus','garbes_narys') AND
          (NEW.meeting_type<>'valdybos' OR (EXISTS (SELECT 1 FROM public.community_management cm WHERE cm.member_id=mb.id AND cm.is_current AND cm.term_start <= (now() AT TIME ZONE 'Europe/Vilnius')::date AND cm.role IN ('pirmininkas','tarybos_narys'))
            AND NOT EXISTS (SELECT 1 FROM public.community_management cm WHERE cm.member_id=mb.id AND cm.is_current AND cm.role='revizorius')));
      total := coalesce(cardinality(ids),0);
      NEW.electorate_snapshot := jsonb_build_object('total',total,'member_ids',ids,'basis','registry','recorded_at',now());
    ELSE
      IF (NEW.meeting_date AT TIME ZONE 'Europe/Vilnius')::date >= (now() AT TIME ZONE 'Europe/Vilnius')::date THEN
        RAISE EXCEPTION 'Dokumentinis narių skaičius leidžiamas tik istoriniam susirinkimui; šiandien naudokite registrą';
      END IF;
      IF nullif(btrim(NEW.electorate_snapshot->>'reference'),'') IS NULL OR jsonb_typeof(NEW.electorate_snapshot->'total')<>'number' THEN
        RAISE EXCEPTION 'Istorinei narių bazei būtinas dokumento pagrindas ir narių skaičius';
      END IF;
      total := (NEW.electorate_snapshot->>'total')::integer;
      IF jsonb_typeof(NEW.electorate_snapshot->'member_ids') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Istoriniam išrašui būtinas visas narių sąrašas'; END IF;
      ids := ARRAY(SELECT DISTINCT value::uuid FROM jsonb_array_elements_text(NEW.electorate_snapshot->'member_ids'));
      IF cardinality(ids)<>total OR EXISTS(SELECT 1 FROM unnest(ids) id WHERE NOT EXISTS(SELECT 1 FROM public.members mb WHERE mb.id=id)) THEN
        RAISE EXCEPTION 'Istorinio išrašo narių sąrašas turi sutapti su narių skaičiumi ir registro tapatybėmis';
      END IF;
      IF EXISTS(SELECT 1 FROM public.members mb WHERE mb.id=ANY(ids) AND
        (coalesce(mb.admission_date,mb.join_date) > (NEW.meeting_date AT TIME ZONE 'Europe/Vilnius')::date
         OR mb.termination_date < (NEW.meeting_date AT TIME ZONE 'Europe/Vilnius')::date
            AND (mb.admission_date IS NULL OR mb.admission_date <= mb.termination_date))
        AND NOT EXISTS(SELECT 1 FROM public.bylaws_membership_periods mp WHERE mp.member_id=mb.id
          AND mp.started_on <= (NEW.meeting_date AT TIME ZONE 'Europe/Vilnius')::date AND mp.ended_on >= (NEW.meeting_date AT TIME ZONE 'Europe/Vilnius')::date)) THEN
        RAISE EXCEPTION 'Istorinio sąrašo narystės datos neatitinka susirinkimo datos';
      END IF;
      IF NEW.meeting_type='valdybos' THEN
        IF nullif(btrim(NEW.electorate_snapshot->>'council_reference'),'') IS NULL OR EXISTS(
          SELECT 1 FROM unnest(ids) memberid WHERE NOT EXISTS(SELECT 1 FROM public.community_management cm
            WHERE cm.member_id=memberid AND cm.role IN ('pirmininkas','tarybos_narys')
              AND cm.term_start <= (NEW.meeting_date AT TIME ZONE 'Europe/Vilnius')::date)) THEN
          RAISE EXCEPTION 'Istorinei Tarybai būtinas sudėties dokumentas ir iki posėdžio pradėti Tarybos pareigų įrašai';
        END IF;
      END IF;
      NEW.electorate_snapshot := jsonb_build_object('council_reference',NEW.electorate_snapshot->>'council_reference','total',total,'member_ids',ids,'basis','document' ,'reference',NEW.electorate_snapshot->>'reference','meeting_date',NEW.meeting_date,'recorded_at',now());
    END IF;
    IF total < 1 OR (NEW.meeting_type='valdybos' AND total<>6) THEN
      RAISE EXCEPTION 'Patikrinkite narių bazę: Tarybos balso teisės bazę turi sudaryti šeši nariai (5.2 p.)';
    END IF;
    NEW.total_members_at_time := total;
    NEW.quorum_required := CASE WHEN NEW.meeting_type='pakartotinis' THEN 0 ELSE total/2+1 END;
  END IF;
  IF NEW.status='baigtas' AND EXISTS(SELECT 1 FROM public.resolutions r JOIN public.resolution_documents rd ON rd.resolution_id=r.id JOIN public.documents d ON d.id=rd.document_id WHERE r.meeting_id=NEW.id AND d.deletion_pending) THEN
    RAISE EXCEPTION 'Darbotvarkės priedas trinamas; pirmiausia užbaikite dokumento tvarkymą';
  END IF;
  IF TG_OP='UPDATE' AND NEW.status='baigtas' AND OLD.status<>'baigtas' AND NEW.electorate_snapshot IS NULL THEN
    RAISE EXCEPTION 'Prieš uždarant užfiksuokite susirinkimo laiko narių bazę arba įrašykite dokumentuotą istorinį skaičių';
  END IF;
  IF NEW.convening_kind='members' AND NEW.convening_date > (NEW.meeting_date AT TIME ZONE 'Europe/Vilnius')::date THEN
    RAISE EXCEPTION 'Narių reikalavimas turi būti pateiktas iki susirinkimo';
  END IF;
  IF TG_OP='UPDATE' AND (OLD.status IN ('baigtas','atšauktas') OR EXISTS(SELECT 1 FROM public.resolutions WHERE meeting_id=OLD.id AND status IN ('patvirtintas','atmestas')))
    AND (NEW.notice_channels,NEW.notice_reference,NEW.notice_day_rule,NEW.notice_day_reference,NEW.repeat_notice_days,NEW.repeat_notice_reference,NEW.majority_rule,NEW.majority_reference)
      IS DISTINCT FROM (OLD.notice_channels,OLD.notice_reference,OLD.notice_day_rule,OLD.notice_day_reference,OLD.repeat_notice_days,OLD.repeat_notice_reference,OLD.majority_rule,OLD.majority_reference) THEN
    RAISE EXCEPTION 'Pranešimo ir balsavimo tvarkos pagrindai užfiksuoti';
  END IF;
  IF NEW.convening_kind='council' AND NEW.convening_date IS NOT NULL AND
      (NEW.convening_date > (now() AT TIME ZONE 'Europe/Vilnius')::date OR NEW.convening_date > (NEW.meeting_date AT TIME ZONE 'Europe/Vilnius')::date) THEN
    RAISE EXCEPTION 'Tarybos sušaukimo sprendimas turi būti priimtas iki susirinkimo';
  END IF;
  IF TG_OP='UPDATE' AND (OLD.status IN ('baigtas','atšauktas') OR EXISTS(SELECT 1 FROM public.resolutions WHERE meeting_id=OLD.id AND status IN ('patvirtintas','atmestas')))
    AND (NEW.title,NEW.location,NEW.protocol_number,NEW.chairperson_member_id,NEW.chairperson_name,NEW.secretary_name,NEW.convening_kind,NEW.convening_reference,NEW.convening_date)
      IS DISTINCT FROM (OLD.title,OLD.location,OLD.protocol_number,OLD.chairperson_member_id,OLD.chairperson_name,OLD.secretary_name,OLD.convening_kind,OLD.convening_reference,OLD.convening_date) THEN
    RAISE EXCEPTION 'Protokolo tapatybė, posėdžio pareigūnai ir sušaukimo pagrindas užfiksuoti';
  END IF;
  NEW.convening_requesters := ARRAY(SELECT DISTINCT id FROM unnest(NEW.convening_requesters) id ORDER BY id);
  -- A member demand is checked once, for the dated demand, and then preserved.
  IF TG_OP='UPDATE' AND OLD.convening_snapshot IS NOT NULL AND
    (NEW.convening_snapshot,NEW.convening_kind,NEW.convening_reference,NEW.convening_requesters,NEW.convening_date,NEW.convening_total_members,NEW.convening_same_day_reference)
    IS DISTINCT FROM (OLD.convening_snapshot,OLD.convening_kind,OLD.convening_reference,OLD.convening_requesters,OLD.convening_date,OLD.convening_total_members,OLD.convening_same_day_reference) THEN
    RAISE EXCEPTION 'Narių reikalavimo pagrindas užfiksuotas; jo pakeitimui registruokite naują reikalavimą';
  END IF;
  IF (TG_OP='INSERT' OR OLD.convening_snapshot IS NULL) THEN
    IF NEW.convening_snapshot IS NOT NULL THEN RAISE EXCEPTION 'Reikalavimo patikros išvados tiesiogiai įrašyti negalima'; END IF;
    IF NEW.convening_kind='members' AND nullif(btrim(NEW.convening_reference),'') IS NOT NULL AND NEW.convening_date IS NOT NULL THEN
      IF NEW.convening_date > (now() AT TIME ZONE 'Europe/Vilnius')::date THEN RAISE EXCEPTION 'Reikalavimo data dar neatėjo'; END IF;
      IF nullif(btrim(NEW.convening_same_day_reference),'') IS NULL AND EXISTS(SELECT 1 FROM public.members mb WHERE mb.id=ANY(NEW.convening_requesters)
        AND (mb.termination_date=NEW.convening_date OR EXISTS(SELECT 1 FROM public.bylaws_membership_periods mp WHERE mp.member_id=mb.id AND mp.ended_on=NEW.convening_date))) THEN
        RAISE EXCEPTION 'Tos pačios dienos narystės pabaigai reikia pasirašymo ir pasibaigimo eiliškumo dokumento';
      END IF;
      SELECT array_agg(DISTINCT mb.id) INTO signers FROM public.members mb
        WHERE mb.id=ANY(NEW.convening_requesters) AND (
          (coalesce(mb.admission_date,mb.join_date)<=NEW.convening_date
            AND (mb.status IN ('aktyvus','pasyvus','garbes_narys') OR mb.termination_date>=NEW.convening_date))
          OR EXISTS(SELECT 1 FROM public.bylaws_membership_periods mp WHERE mp.member_id=mb.id AND mp.started_on<=NEW.convening_date AND mp.ended_on>=NEW.convening_date));
      IF coalesce(cardinality(signers),0) <> (SELECT count(DISTINCT id) FROM unnest(NEW.convening_requesters) id) THEN
        RAISE EXCEPTION 'Pasirašiusio asmens narystė reikalavimo dieną nepatvirtinta registre';
      END IF;
      IF NEW.convening_date=(now() AT TIME ZONE 'Europe/Vilnius')::date AND nullif(btrim(NEW.convening_same_day_reference),'') IS NULL THEN
        SELECT count(*) INTO total FROM public.members WHERE status IN ('aktyvus','pasyvus','garbes_narys');
      ELSE
        -- No membership history is guessed retrospectively: the referenced demand
        -- must include the register extract supporting this explicit denominator.
        total := NEW.convening_total_members;
      END IF;
      IF total IS NULL OR total<1 OR coalesce(cardinality(signers),0)*5<total OR coalesce(cardinality(signers),0)>total THEN
        RAISE EXCEPTION 'Reikia dokumentuotos reikalavimo dienos narių bazės ir bent 1/5 pasirašiusių narių';
      END IF;
      NEW.convening_snapshot := jsonb_build_object('total',total,'requester_ids',signers,'demand_date',NEW.convening_date,'same_day_reference',NEW.convening_same_day_reference,'reference',NEW.convening_reference,'recorded_at',now());
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.meeting_type IS DISTINCT FROM OLD.meeting_type THEN
    RAISE EXCEPTION 'Susirinkimo tipo keisti negalima; sukurkite naują susirinkimą';
  END IF;
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
DECLARE mid uuid; memberid uuid; mt text; ms text; rs text; electorate jsonb;
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
  SELECT meeting_type, status, electorate_snapshot INTO mt, ms, electorate FROM public.meetings WHERE id = mid FOR UPDATE;
  IF NOT FOUND THEN
    -- Cascading deletion of an unused draft is allowed.
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'Susirinkimas nerastas';
  END IF;
  IF TG_OP<>'DELETE' AND electorate IS NOT NULL AND NOT coalesce((electorate->'member_ids') ? memberid::text,false) THEN
    RAISE EXCEPTION 'Asmuo nepriklauso užfiksuotam susirinkimo narių sąrašui';
  END IF;
  IF ms = 'baigtas' AND TG_TABLE_NAME = 'meeting_attendance' THEN
    IF EXISTS (SELECT 1 FROM public.meetings WHERE previous_meeting_id=mid) THEN
      RAISE EXCEPTION 'Dalyvavimas yra pakartotinio susirinkimo pagrindas; būtinas atskiras istorijos taisymas';
    END IF;
    INSERT INTO public.audit_log(user_id, action, table_name, record_id, old_data, new_data)
      VALUES(auth.uid(), TG_OP, 'meeting_attendance', CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END,
        CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END,
        jsonb_build_object('reason','post_meeting_attendance_correction','row',CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END));
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF ms IN ('baigtas', 'atšauktas') THEN RAISE EXCEPTION 'Susirinkimas uždarytas'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF electorate IS NOT NULL THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.members WHERE id = memberid AND status IN ('aktyvus', 'pasyvus', 'garbes_narys')) THEN
    RAISE EXCEPTION 'Asmuo neturi galiojančios narystės';
  END IF;
  IF mt = 'valdybos' AND (NOT EXISTS (
    SELECT 1 FROM public.community_management WHERE member_id = memberid AND is_current AND term_start <= (now() AT TIME ZONE 'Europe/Vilnius')::date AND role IN ('pirmininkas', 'tarybos_narys')
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
  f integer; a integer; s integer; passed boolean; threshold integer; notice jsonb; chair_ballot text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('members_voting_eligibility'));
  -- Preserve both final decisions (including cascading deletion) and the agenda
  -- actually considered by a closed meeting, before any repeat can refer to it.
  IF TG_OP = 'DELETE' AND OLD.status IN ('patvirtintas', 'atmestas') THEN
    RAISE EXCEPTION 'Galutinio nutarimo ištrinti negalima; reikia atskiro protokolo taisymo';
  END IF;
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT * INTO m FROM public.meetings WHERE id = OLD.meeting_id FOR UPDATE;
    IF m.status IN ('baigtas', 'atšauktas') THEN
      RAISE EXCEPTION 'Uždaryto susirinkimo darbotvarkės keisti negalima';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  SELECT * INTO m FROM public.meetings WHERE id = NEW.meeting_id FOR UPDATE;
  IF m.status IN ('baigtas', 'atšauktas') THEN
    RAISE EXCEPTION 'Uždaryto susirinkimo darbotvarkės keisti negalima';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IN ('patvirtintas', 'atmestas') THEN
    IF (to_jsonb(NEW) - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at') THEN
      RAISE EXCEPTION 'Galutinis sprendimas užfiksuotas; reikia atskiro protokolo taisymo';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.decision_type IS NOT NULL THEN
    NEW.requires_qualified_majority := NEW.decision_type IN ('statutes', 'transformation', 'liquidation');
  END IF;
  IF NEW.status NOT IN ('patvirtintas', 'atmestas') THEN NEW.chair_vote:=NULL; RETURN NEW; END IF;
  IF m.meeting_type='valdybos' AND NEW.decision_type IN ('statutes','transformation','liquidation','council_election','council_removal','auditor_election','reports','fees','seat') THEN
    RAISE EXCEPTION 'Šis sprendimas priklauso Visuotinio susirinkimo kompetencijai (4.8, 7.1 p.)';
  END IF;
  IF NEW.decision_type IS NULL THEN RAISE EXCEPTION 'Pasirinkite sprendimo rūšį; daugumos reikalavimas nustatomas pagal ją'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('members_voting_eligibility'));
  SELECT * INTO m FROM public.meetings WHERE id = NEW.meeting_id FOR UPDATE;
  IF NOT FOUND OR m.status IN ('baigtas', 'atšauktas') THEN RAISE EXCEPTION 'Susirinkimas nerastas arba uždarytas'; END IF;
  IF (m.meeting_date AT TIME ZONE 'Europe/Vilnius')::date < DATE '2026-01-15' THEN
    RAISE EXCEPTION 'Šiai datai trūksta galiojusios įstatų redakcijos; pateikta redakcija įregistruota 2026-01-15';
  END IF;
  IF EXISTS(SELECT 1 FROM public.resolution_documents rd JOIN public.documents d ON d.id=rd.document_id WHERE rd.resolution_id=NEW.id AND d.deletion_pending) THEN
    RAISE EXCEPTION 'Nutarimo priedas trinamas; pirmiausia užbaikite dokumento tvarkymą';
  END IF;
  IF m.electorate_snapshot IS NULL THEN RAISE EXCEPTION 'Pirmiausia užfiksuokite susirinkimo laiko narių bazę'; END IF;
  m.total_members_at_time := (m.electorate_snapshot->>'total')::integer;
  IF m.meeting_type='valdybos' AND m.total_members_at_time<>6 THEN RAISE EXCEPTION 'Tarybos balso teisės bazę sudaro šeši nariai'; END IF;
  IF m.meeting_type='neeilinis' THEN
    IF m.convening_kind IS NULL OR nullif(btrim(m.convening_reference),'') IS NULL THEN
      RAISE EXCEPTION 'Neeiliniam susirinkimui būtinas Tarybos sprendimas arba bent 1/5 narių reikalavimas (4.2 p.)';
    END IF;
    IF m.convening_kind='council' AND (m.convening_date IS NULL OR m.convening_date > (m.meeting_date AT TIME ZONE 'Europe/Vilnius')::date OR m.convening_date > (now() AT TIME ZONE 'Europe/Vilnius')::date) THEN
      RAISE EXCEPTION 'Būtina iki susirinkimo priimto Tarybos sušaukimo sprendimo data';
    END IF;
    IF m.convening_kind='members' AND m.convening_snapshot IS NULL THEN
      RAISE EXCEPTION 'Reikia užfiksuoto bent 1/5 narių reikalavimo patikros pagrindo';
    END IF;
  END IF;
  IF jsonb_array_length(m.electorate_snapshot->'member_ids') IS DISTINCT FROM m.total_members_at_time THEN
    RAISE EXCEPTION 'Narių bazėje trūksta užfiksuoto vardinio sąrašo';
  END IF;
  IF EXISTS (SELECT 1 FROM public.meeting_attendance ma WHERE ma.meeting_id=m.id
      AND NOT coalesce((m.electorate_snapshot->'member_ids') ? ma.member_id::text,false)) THEN
    RAISE EXCEPTION 'Dalyvių sąraše yra asmenų be užfiksuotos šio susirinkimo balso teisės';
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
    IF NOT FOUND OR (NEW.title, coalesce(NEW.description, ''))
        IS DISTINCT FROM (source.title, coalesce(source.description, ''))
        OR (source.decision_type IS NOT NULL AND NEW.decision_type IS DISTINCT FROM source.decision_type)
        OR (source.requires_qualified_majority AND NOT NEW.requires_qualified_majority) THEN
      RAISE EXCEPTION 'Pakartotiniame susirinkime leidžiami tik ankstesnės darbotvarkės klausimai (4.6 p.)';
    END IF;
    IF EXISTS((SELECT document_id FROM public.resolution_documents WHERE resolution_id=NEW.id EXCEPT SELECT document_id FROM public.resolution_documents WHERE resolution_id=source.id)
      UNION ALL (SELECT document_id FROM public.resolution_documents WHERE resolution_id=source.id EXCEPT SELECT document_id FROM public.resolution_documents WHERE resolution_id=NEW.id)) THEN
      RAISE EXCEPTION 'Pakartotinio klausimo priedai turi sutapti su ankstesne darbotvarke (4.6 p.)';
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
  IF NEW.result_for+NEW.result_against+NEW.result_abstain > f+a+s AND EXISTS (
    SELECT 1 FROM public.vote_ballots vb JOIN public.meeting_attendance ma ON ma.meeting_id=m.id AND ma.member_id=vb.member_id
      WHERE vb.resolution_id=NEW.id AND (ma.attendance_type='fizinis' OR vb.vote_type='fizinis')) THEN
    RAISE EXCEPTION 'Negalima maišyti vardinių gyvų balsų su bendru gyvų balsų skaičiumi; suveskite visus balsavusius vardais';
  END IF;
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
      SELECT vb.vote INTO chair_ballot FROM public.vote_ballots vb
        JOIN public.meeting_attendance ma ON ma.meeting_id=m.id AND ma.member_id=vb.member_id
        WHERE vb.resolution_id=NEW.id AND vb.member_id=m.chairperson_member_id;
      IF NOT FOUND OR (NEW.chair_vote IS NOT NULL AND NEW.chair_vote IS DISTINCT FROM chair_ballot) THEN
        RAISE EXCEPTION 'Būtinas dalyvaujančio posėdžio pirmininko vardinis, jau įskaičiuotas balsas (5.5 p.)';
      END IF;
      passed := chair_ballot = 'uz';
    ELSE
      passed := CASE m.majority_rule WHEN 'participants' THEN NEW.result_for * 2 > participants ELSE NEW.result_for > NEW.result_against END;
    END IF;
  END IF;
  IF (NEW.status = 'patvirtintas') IS DISTINCT FROM passed THEN RAISE EXCEPTION 'Nutarimo statusas neatitinka balsų daugumos'; END IF;
  IF m.meeting_type <> 'valdybos' THEN
    IF coalesce(cardinality(m.notice_channels),0)=0 OR nullif(btrim(m.notice_reference),'') IS NULL
       OR m.notice_day_rule IS NULL OR nullif(btrim(m.notice_day_reference),'') IS NULL THEN
      RAISE EXCEPTION 'Pranešimo patikrai būtini Tarybos pasirinkti kanalai, sprendimo pagrindas ir patvirtinta dienų skaičiavimo tvarka';
    END IF;
    IF m.meeting_type='pakartotinis' THEN
      IF m.repeat_notice_days IS NULL OR nullif(btrim(m.repeat_notice_reference),'') IS NULL THEN
        RAISE EXCEPTION 'Pakartotiniam susirinkimui būtina patvirtinta informavimo termino tvarka ir jos pagrindas';
      END IF;
      threshold := m.repeat_notice_days;
    ELSE threshold := CASE WHEN m.meeting_type = 'neeilinis' THEN 7 ELSE 14 END;
    END IF;
    -- Each required Council-selected channel must have its own timely evidence.
    -- Calendar arithmetic happens in Vilnius local time, including DST changes.
    IF EXISTS (SELECT 1 FROM unnest(m.notice_channels) selected(channel) WHERE NOT EXISTS (
      SELECT 1 FROM public.meeting_announcements a WHERE a.meeting_id=m.id AND a.channel=selected.channel
        AND CASE m.notice_day_rule WHEN 'vilnius_calendar'
          THEN a.published_at AT TIME ZONE 'Europe/Vilnius' <= (m.meeting_date AT TIME ZONE 'Europe/Vilnius') - make_interval(days=>threshold)
          ELSE a.published_at <= m.meeting_date - make_interval(hours=>threshold*24) END
    )) THEN RAISE EXCEPTION 'Nėra laiku paskelbto pranešimo kiekvienu Tarybos pasirinktu kanalu'; END IF;
    SELECT jsonb_agg(jsonb_build_object('id',id,'channel',channel,'published_at',published_at,'url',url))
      INTO notice FROM public.meeting_announcements WHERE meeting_id=m.id AND channel=ANY(m.notice_channels)
        AND CASE m.notice_day_rule WHEN 'vilnius_calendar'
          THEN published_at AT TIME ZONE 'Europe/Vilnius' <= (m.meeting_date AT TIME ZONE 'Europe/Vilnius') - make_interval(days=>threshold)
          ELSE published_at <= m.meeting_date - make_interval(hours=>threshold*24) END;
  END IF;
  NEW.participants_at_decision := participants;
  NEW.decision_basis := jsonb_build_object('bylaws', '2025-12-07',
    'bylaws_source_sha256','6cf9ba9468331055836af653b9be65eba0ff6c4f4216491fa6568d6c381577a6',
    'bylaws_effective_from','2026-01-15','bylaws_effective_until',NULL,
    'attendance',(SELECT jsonb_agg(jsonb_build_object('member_id',ma.member_id,'attendance_type',ma.attendance_type,'member',jsonb_build_object('first_name',mb.first_name,'last_name',mb.last_name)) ORDER BY ma.member_id)
      FROM public.meeting_attendance ma JOIN public.members mb ON mb.id=ma.member_id WHERE ma.meeting_id=m.id),
    'chairperson_name',m.chairperson_name,'secretary_name',m.secretary_name,'total_members', m.total_members_at_time,
    'participants', participants, 'meeting_type', m.meeting_type, 'majority_rule', m.majority_rule,
    'majority_reference', m.majority_reference, 'previous_meeting_id', m.previous_meeting_id,
    'notice', notice, 'notice_channels', m.notice_channels, 'notice_reference', m.notice_reference,
    'notice_day_rule', m.notice_day_rule, 'notice_day_reference', m.notice_day_reference, 'notice_days', threshold, 'repeat_notice_reference', m.repeat_notice_reference,
    'decision_type', NEW.decision_type, 'chairperson_member_id', m.chairperson_member_id,
    'convening_kind', m.convening_kind, 'convening_date',m.convening_date, 'convening_reference', m.convening_reference,
    'convening_requesters', m.convening_requesters, 'convening_snapshot', m.convening_snapshot, 'electorate_snapshot', m.electorate_snapshot, 'recorded_at', clock_timestamp());
  NEW.chair_vote := NULL; -- The immutable ballot remains the restricted proof; public resolution data never carries it.
  NEW.early_voting_open := false;
  RETURN NEW;
END; $$;
CREATE TRIGGER bylaws_resolution BEFORE INSERT OR UPDATE OR DELETE ON public.resolutions
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
       WHERE cm.member_id = mb.id AND cm.is_current AND cm.term_start <= (now() AT TIME ZONE 'Europe/Vilnius')::date AND cm.role IN ('pirmininkas', 'tarybos_narys')))
    WHERE m.status NOT IN ('baigtas', 'atšauktas') AND m.meeting_date > now() AND m.electorate_snapshot IS NULL
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
  IF NEW.is_current AND EXISTS (
    SELECT 1 FROM public.community_management cm WHERE cm.member_id=NEW.member_id AND cm.is_current AND cm.id<>NEW.id
      AND ((NEW.role='revizorius' AND cm.role IN ('pirmininkas','tarybos_narys'))
        OR (NEW.role IN ('pirmininkas','tarybos_narys') AND cm.role='revizorius'))
  ) THEN RAISE EXCEPTION 'Revizorius negali būti Tarybos nariu ar Pirmininku (6.2 p.)'; END IF;
  IF NEW.is_current AND NEW.role IN ('pirmininkas','tarybos_narys') AND
    (SELECT count(DISTINCT member_id) FROM (SELECT cm.member_id FROM public.community_management cm WHERE cm.id<>NEW.id AND cm.is_current AND cm.role IN ('pirmininkas','tarybos_narys') UNION SELECT NEW.member_id) council)>6 THEN
    RAISE EXCEPTION 'Taryboje kartu su Pirmininku gali būti ne daugiau kaip šeši asmenys (5.2 p.)';
  END IF;
  IF NEW.is_current AND NEW.role IN ('pirmininkas','revizorius') AND EXISTS(SELECT 1 FROM public.community_management cm WHERE cm.is_current AND cm.role=NEW.role AND cm.id<>NEW.id) THEN
    RAISE EXCEPTION 'Vienu metu gali būti tik vienas Pirmininkas ir vienas Revizorius';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER bylaws_council_lock BEFORE INSERT OR UPDATE OR DELETE ON public.community_management
FOR EACH ROW EXECUTE FUNCTION public.bylaws_council_lock();
REVOKE ALL ON FUNCTION public.bylaws_council_lock() FROM PUBLIC, anon, authenticated;

CREATE UNIQUE INDEX bylaws_single_current_officer_idx ON public.community_management(role) WHERE is_current AND role IN ('pirmininkas','revizorius');

CREATE FUNCTION public.bylaws_document_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE target_ids uuid[];
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('members_voting_eligibility'));
  IF TG_TABLE_NAME='resolution_documents' THEN
    target_ids := ARRAY[CASE WHEN TG_OP<>'INSERT' THEN OLD.resolution_id END,CASE WHEN TG_OP<>'DELETE' THEN NEW.resolution_id END];
    -- Lock linked document identity too; its deletion must finish before a new attachment.
    IF TG_OP<>'DELETE' THEN
      PERFORM 1 FROM public.documents WHERE id=NEW.document_id AND NOT deletion_pending FOR SHARE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Dokumentas nerastas arba pradėtas trinti'; END IF;
    END IF;
  ELSE
    IF TG_OP='UPDATE' AND OLD.deletion_pending AND (to_jsonb(NEW)-'deletion_pending') IS DISTINCT FROM (to_jsonb(OLD)-'deletion_pending') THEN
      RAISE EXCEPTION 'Trinamo dokumento duomenų keisti negalima; pakartokite trynimą';
    END IF;
    IF TG_OP='UPDATE' AND OLD.deletion_pending AND NOT NEW.deletion_pending THEN RAISE EXCEPTION 'Pradėto trynimo atšaukti negalima'; END IF;
    target_ids := ARRAY(SELECT resolution_id FROM public.resolution_documents WHERE document_id=OLD.id);
  END IF;
  IF EXISTS(SELECT 1 FROM public.resolutions r JOIN public.meetings m ON m.id=r.meeting_id WHERE r.id=ANY(target_ids)
    AND (r.status IN ('patvirtintas','atmestas') OR m.status IN ('baigtas','atšauktas'))) THEN
    -- Visibility is a separate access decision; content and identity stay fixed.
    IF TG_TABLE_NAME<>'documents' OR TG_OP='DELETE' OR
       (to_jsonb(NEW)-'is_public'-'published_at') IS DISTINCT FROM (to_jsonb(OLD)-'is_public'-'published_at') THEN
      RAISE EXCEPTION 'Galutinio nutarimo arba uždarytos darbotvarkės priedų keisti negalima';
    END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER bylaws_document_links BEFORE INSERT OR UPDATE OR DELETE ON public.resolution_documents
FOR EACH ROW EXECUTE FUNCTION public.bylaws_document_guard();
CREATE TRIGGER bylaws_documents BEFORE UPDATE OR DELETE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.bylaws_document_guard();
REVOKE ALL ON FUNCTION public.bylaws_document_guard() FROM PUBLIC, anon, authenticated;

-- Restrictive policies preserve the underlying file through authenticated Storage API calls.
-- Existing permissive policies still decide who may otherwise change files.
CREATE POLICY bylaws_preserve_document_file_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
USING (bucket_id<>'documents' OR NOT EXISTS (
  SELECT 1 FROM public.documents d JOIN public.resolution_documents rd ON rd.document_id=d.id
    JOIN public.resolutions r ON r.id=rd.resolution_id JOIN public.meetings m ON m.id=r.meeting_id
  WHERE d.file_path=storage.objects.name AND (r.status IN ('patvirtintas','atmestas') OR m.status IN ('baigtas','atšauktas'))
));
CREATE POLICY bylaws_preserve_document_file_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
USING (bucket_id<>'documents' OR NOT EXISTS (
  SELECT 1 FROM public.documents d JOIN public.resolution_documents rd ON rd.document_id=d.id
    JOIN public.resolutions r ON r.id=rd.resolution_id JOIN public.meetings m ON m.id=r.meeting_id
  WHERE d.file_path=storage.objects.name AND (r.status IN ('patvirtintas','atmestas') OR m.status IN ('baigtas','atšauktas'))
));


-- One transaction: a failed reorder cannot leave duplicate/partially moved numbers.
CREATE FUNCTION public.bylaws_reorder_resolutions(p_meeting_id uuid,p_order uuid[]) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE current_ids uuid[];
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Tik administratorius'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('members_voting_eligibility'));
  IF NOT EXISTS(SELECT 1 FROM public.meetings WHERE id=p_meeting_id AND status NOT IN ('baigtas','atšauktas')) THEN RAISE EXCEPTION 'Susirinkimas uždarytas arba nerastas'; END IF;
  IF EXISTS(SELECT 1 FROM public.resolutions WHERE meeting_id=p_meeting_id AND status IN ('patvirtintas','atmestas')) THEN RAISE EXCEPTION 'Priėmus sprendimą darbotvarkės numeracija užfiksuota'; END IF;
  SELECT array_agg(id ORDER BY id) INTO current_ids FROM public.resolutions WHERE meeting_id=p_meeting_id;
  IF cardinality(p_order) IS DISTINCT FROM cardinality(current_ids) OR
     ARRAY(SELECT DISTINCT id FROM unnest(p_order) id ORDER BY id) IS DISTINCT FROM current_ids THEN RAISE EXCEPTION 'Darbotvarkė pasikeitė; atnaujinkite puslapį'; END IF;
  UPDATE public.resolutions r SET resolution_number=o.ordinality FROM unnest(p_order) WITH ORDINALITY o(id,ordinality) WHERE r.id=o.id AND r.meeting_id=p_meeting_id;
END; $$;
REVOKE ALL ON FUNCTION public.bylaws_reorder_resolutions(uuid,uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bylaws_reorder_resolutions(uuid,uuid[]) TO authenticated;

-- Contains personal data: no Data API grants/policies. Existing authorized RPCs
-- expose only their own payload after their existing membership/token checks.
CREATE TABLE public.bylaws_document_snapshots (
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK(kind IN ('salinami','rinkimai','veiklos-planai')),
  payload jsonb NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(meeting_id,kind)
);
ALTER TABLE public.bylaws_document_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bylaws_document_snapshots FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.bylaws_generated_snapshot_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE target_id uuid; doc record; source_id uuid; v_kind text; payload jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('members_voting_eligibility'));
  IF TG_TABLE_NAME='resolutions' THEN
    IF NEW.status NOT IN ('patvirtintas','atmestas') OR (TG_OP='UPDATE' AND OLD.status IN ('patvirtintas','atmestas')) THEN RETURN NEW; END IF;
    target_id:=NEW.meeting_id;
  ELSE
    IF NEW.status NOT IN ('baigtas','atšauktas') OR OLD.status IN ('baigtas','atšauktas') THEN RETURN NEW; END IF;
    target_id:=NEW.id;
  END IF;
  FOR doc IN SELECT DISTINCT d.file_path FROM public.documents d JOIN public.resolution_documents rd ON rd.document_id=d.id JOIN public.resolutions r ON r.id=rd.resolution_id
    WHERE r.meeting_id=target_id AND (TG_TABLE_NAME='meetings' OR r.id=NEW.id)
      AND d.file_path ~ '^__api__/(salinami|rinkimai|veiklos-planai)/' LOOP
    v_kind:=split_part(doc.file_path,'/',2);
    source_id:=split_part(doc.file_path,'/',3)::uuid;
    IF source_id<>target_id AND NOT EXISTS(SELECT 1 FROM public.meetings m WHERE m.id=target_id AND m.meeting_type='pakartotinis' AND m.previous_meeting_id=source_id
      AND EXISTS(SELECT 1 FROM public.bylaws_document_snapshots ds WHERE ds.meeting_id=source_id AND ds.kind=v_kind)) THEN
      RAISE EXCEPTION 'Generuojamo priedo susirinkimas nesutampa; galima tik užfiksuoto ankstesnio neįvykusio susirinkimo kopija';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM public.bylaws_document_snapshots ds WHERE ds.meeting_id=source_id AND ds.kind=v_kind) THEN
      payload:=CASE v_kind WHEN 'salinami' THEN public.get_meeting_expulsions_data(source_id)
        WHEN 'rinkimai' THEN public.get_meeting_elections_data(source_id)
        ELSE public.get_meeting_plan_data(source_id) END;
      IF payload IS NULL OR payload ? 'error' THEN RAISE EXCEPTION 'Nepavyko užfiksuoti generuojamo priedo'; END IF;
      payload:=payload || (SELECT jsonb_build_object('meeting_title',m.title,'meeting_date',m.meeting_date,'captured_at',now()) FROM public.meetings m WHERE m.id=source_id);
      INSERT INTO public.bylaws_document_snapshots(meeting_id,kind,payload) VALUES(source_id,v_kind,payload);
    END IF;
  END LOOP;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.bylaws_generated_snapshot_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER zz_bylaws_generated_resolution AFTER INSERT OR UPDATE ON public.resolutions FOR EACH ROW EXECUTE FUNCTION public.bylaws_generated_snapshot_guard();
CREATE TRIGGER zz_bylaws_generated_meeting AFTER UPDATE ON public.meetings FOR EACH ROW EXECUTE FUNCTION public.bylaws_generated_snapshot_guard();

CREATE FUNCTION public.bylaws_evidence_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ids uuid[]; mid uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('members_voting_eligibility'));
  ids:=CASE WHEN TG_OP='INSERT' THEN ARRAY[NEW.meeting_id] WHEN TG_OP='DELETE' THEN ARRAY[OLD.meeting_id] ELSE ARRAY[OLD.meeting_id,NEW.meeting_id] END;
  FOREACH mid IN ARRAY ids LOOP
    IF EXISTS(SELECT 1 FROM public.meetings WHERE id=mid AND status IN ('baigtas','atšauktas')) OR
      (TG_TABLE_NAME='meeting_announcements' AND EXISTS(SELECT 1 FROM public.resolutions WHERE meeting_id=mid AND status IN ('patvirtintas','atmestas'))) OR
      (TG_TABLE_NAME='meeting_expulsions' AND EXISTS(SELECT 1 FROM public.bylaws_document_snapshots WHERE meeting_id=mid AND kind='salinami')) THEN
      RAISE EXCEPTION 'Pranešimo arba priedo įrodymai užfiksuoti; būtinas atskiras dokumentuotas taisymas';
    END IF;
  END LOOP;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.bylaws_evidence_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bylaws_announcements BEFORE INSERT OR UPDATE OR DELETE ON public.meeting_announcements FOR EACH ROW EXECUTE FUNCTION public.bylaws_evidence_guard();
CREATE TRIGGER bylaws_expulsions BEFORE INSERT OR UPDATE OR DELETE ON public.meeting_expulsions FOR EACH ROW EXECUTE FUNCTION public.bylaws_evidence_guard();

-- Preserve deployed 047 access checks and grants; prefer the frozen payload.
CREATE OR REPLACE FUNCTION public.get_meeting_elections_data(p_meeting_id uuid, p_token text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  frozen jsonb;
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

  SELECT payload INTO frozen FROM public.bylaws_document_snapshots WHERE meeting_id=p_meeting_id AND kind='rinkimai';
  IF FOUND THEN RETURN frozen; END IF;

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
$function$
;

-- Preserve deployed 047 access checks and grants; prefer the frozen payload.
CREATE OR REPLACE FUNCTION public.get_meeting_expulsions_data(p_meeting_id uuid, p_token text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  frozen jsonb;
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

  SELECT payload INTO frozen FROM public.bylaws_document_snapshots WHERE meeting_id=p_meeting_id AND kind='salinami';
  IF FOUND THEN RETURN frozen; END IF;

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
$function$
;

-- Preserve deployed 047 access checks and grants; prefer the frozen payload.
CREATE OR REPLACE FUNCTION public.get_meeting_plan_data(p_meeting_id uuid, p_token text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  frozen jsonb;
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

  SELECT payload INTO frozen FROM public.bylaws_document_snapshots WHERE meeting_id=p_meeting_id AND kind='veiklos-planai';
  IF FOUND THEN RETURN frozen; END IF;

  v_year := EXTRACT(YEAR FROM v_meeting.meeting_date)::INT;

  SELECT COUNT(*) INTO v_member_count
  FROM members
  WHERE public.is_voting_status(status);

  SELECT COALESCE(SUM(p.amount_cents), 0), COUNT(DISTINCT p.member_id)
  INTO v_collected_cents, v_paid_count
  FROM payments p
  JOIN fee_periods fp ON fp.id = p.fee_period_id
  WHERE fp.fee_type = 'metinis' AND fp.year = v_year;

  SELECT count(DISTINCT paid.member_id) INTO v_paid_count FROM (
    SELECT p.member_id,p.fee_period_id FROM public.payments p JOIN public.fee_periods fp ON fp.id=p.fee_period_id
    WHERE fp.fee_type='metinis' AND fp.year=v_year GROUP BY p.member_id,p.fee_period_id
    HAVING sum(p.amount_cents)>=max(fp.amount_cents)
  ) paid;

  WITH metiniai AS (SELECT id, year, amount_cents FROM fee_periods WHERE fee_type='metinis'),
  unpaid AS (
    SELECT fp.year, m.id, greatest(fp.amount_cents-coalesce((SELECT sum(p.amount_cents) FROM public.payments p WHERE p.member_id=m.id AND p.fee_period_id=fp.id),0),0) AS amount_cents
    FROM members m
    CROSS JOIN metiniai fp
    WHERE m.status IN ('aktyvus','pasyvus')
      AND public.bylaws_fee_applies(m.id,fp.year)
      AND greatest(fp.amount_cents-coalesce((SELECT sum(p.amount_cents) FROM public.payments p WHERE p.member_id=m.id AND p.fee_period_id=fp.id),0),0)>0
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
$function$
;


-- Installments retain separate dates, receipts and audit entries.
ALTER TABLE public.payments DROP CONSTRAINT payments_member_id_fee_period_id_key;
CREATE INDEX bylaws_payments_member_period_idx ON public.payments(member_id,fee_period_id);
ALTER TABLE public.payments ADD CONSTRAINT bylaws_payment_positive CHECK(amount_cents>0) NOT VALID;

-- Preserve deployed authentication and grants; account for every installment.
CREATE OR REPLACE FUNCTION public.get_declaration_token_data(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_decl membership_declarations%ROWTYPE;
  v_member members%ROWTYPE;
  v_unpaid JSONB;
  v_total_cents INT;
  v_join_year INT;
BEGIN
  SELECT * INTO v_decl FROM membership_declarations WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'invalid_token');
  END IF;

  IF v_decl.expires_at < NOW() THEN
    RETURN jsonb_build_object('error', 'expired');
  END IF;

  -- View tracking: fiksuojam pirmą peržiūrą + didinam counter'į.
  -- Skaičiuojam net jei jau pateikė atsakymą – paskutinis viewed_at parodys
  -- pakartotines peržiūras (pvz., jei narys grįžta apžiūrėti savo atsakymo).
  UPDATE membership_declarations
    SET viewed_at = COALESCE(viewed_at, NOW()),
        view_count = view_count + 1
    WHERE id = v_decl.id;

  SELECT * INTO v_member FROM members WHERE id = v_decl.member_id;
  v_join_year := COALESCE(EXTRACT(YEAR FROM v_member.join_date)::INT, 2012);

  SELECT
    jsonb_agg(
      jsonb_build_object(
        'fee_period_id', fp.id,
        'year', fp.year,
        'amount_cents', greatest(fp.amount_cents-coalesce((SELECT sum(px.amount_cents) FROM public.payments px WHERE px.fee_period_id=fp.id AND px.member_id=v_decl.member_id),0),0)
      ) ORDER BY fp.year ASC
    ),
    COALESCE(SUM(greatest(fp.amount_cents-coalesce((SELECT sum(px.amount_cents) FROM public.payments px WHERE px.fee_period_id=fp.id AND px.member_id=v_decl.member_id),0),0)), 0)
  INTO v_unpaid, v_total_cents
  FROM fee_periods fp
  WHERE fp.fee_type = 'metinis'
    AND public.bylaws_fee_applies(v_decl.member_id,fp.year)
    AND greatest(fp.amount_cents-coalesce((SELECT sum(px.amount_cents) FROM public.payments px WHERE px.fee_period_id=fp.id AND px.member_id=v_decl.member_id),0),0)>0;

  RETURN jsonb_build_object(
    'member', jsonb_build_object(
      'id', v_member.id,
      'first_name', v_member.first_name,
      'last_name', v_member.last_name,
      'email', v_member.email,
      'phone', v_member.phone
    ),
    'declaration', jsonb_build_object(
      'submitted_at', v_decl.submitted_at,
      'intent', v_decl.intent,
      'email', v_decl.email,
      'notes', v_decl.notes,
      'viewed_at', v_decl.viewed_at,
      'view_count', v_decl.view_count + 1
    ),
    'debt', jsonb_build_object(
      'unpaid_periods', COALESCE(v_unpaid, '[]'::jsonb),
      'total_cents', v_total_cents
    ),
    'expires_at', v_decl.expires_at
  );
END;
$function$
;

-- Preserve deployed authentication and grants; account for every installment.
CREATE OR REPLACE FUNCTION public.get_member_financial_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_member_id UUID;
  v_member_join_date DATE;
  v_member_status TEXT;
  v_unpaid JSONB;
  v_paid JSONB;
  v_total_debt INT := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT p.member_id, m.join_date, m.status
    INTO v_member_id, v_member_join_date, v_member_status
  FROM profiles p
  LEFT JOIN members m ON m.id = p.member_id
  WHERE p.id = v_user_id;

  IF v_member_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_member_link');
  END IF;

  IF v_member_status IS DISTINCT FROM 'garbes_narys' THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'fee_period_id', fp.id,
        'year', fp.year,
        'name', fp.name,
        'amount_cents', greatest(fp.amount_cents-coalesce((SELECT sum(px.amount_cents) FROM public.payments px WHERE px.fee_period_id=fp.id AND px.member_id=v_member_id),0),0),
        'fee_type', fp.fee_type,
        'due_date', fp.due_date,
        'is_overdue', fp.due_date IS NOT NULL AND fp.due_date < CURRENT_DATE
      ) ORDER BY fp.year DESC, fp.due_date ASC
    ) INTO v_unpaid
    FROM fee_periods fp
    WHERE fp.fee_type = 'metinis'
      AND public.bylaws_fee_applies(v_member_id,fp.year)
      AND greatest(fp.amount_cents-coalesce((SELECT sum(px.amount_cents) FROM public.payments px WHERE px.fee_period_id=fp.id AND px.member_id=v_member_id),0),0)>0;

    SELECT COALESCE(SUM(greatest(fp.amount_cents-coalesce((SELECT sum(px.amount_cents) FROM public.payments px WHERE px.fee_period_id=fp.id AND px.member_id=v_member_id),0),0)), 0) INTO v_total_debt
    FROM fee_periods fp
    WHERE fp.fee_type = 'metinis'
      AND public.bylaws_fee_applies(v_member_id,fp.year)
      AND greatest(fp.amount_cents-coalesce((SELECT sum(px.amount_cents) FROM public.payments px WHERE px.fee_period_id=fp.id AND px.member_id=v_member_id),0),0)>0;
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'amount_cents', p.amount_cents,
      'paid_date', p.paid_date,
      'payment_method', p.payment_method,
      'receipt_number', p.receipt_number,
      'fee_period', jsonb_build_object(
        'year', fp.year,
        'name', fp.name,
        'fee_type', fp.fee_type
      )
    ) ORDER BY p.paid_date DESC
  ) INTO v_paid
  FROM payments p
  JOIN fee_periods fp ON fp.id = p.fee_period_id
  WHERE p.member_id = v_member_id;

  RETURN jsonb_build_object(
    'unpaid', COALESCE(v_unpaid, '[]'::jsonb),
    'paid', COALESCE(v_paid, '[]'::jsonb),
    'total_debt_cents', v_total_debt
  );
END;
$function$
;

-- Preserve deployed authentication and grants; account for every installment.
CREATE OR REPLACE FUNCTION public.get_transparency_fee_stats()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'eligible_counts',(SELECT coalesce(jsonb_agg(jsonb_build_object('fee_period_id',fp.id,'count',(SELECT count(*) FROM public.members m WHERE m.status IN ('aktyvus','pasyvus') AND public.bylaws_fee_applies(m.id,fp.year)))),'[]'::jsonb) FROM public.fee_periods fp),
    'paid_counts', COALESCE((SELECT jsonb_agg(jsonb_build_object('fee_period_id',t.fee_period_id,'count',t.n)) FROM (
      SELECT paid.fee_period_id,count(*) as n FROM (
        SELECT p.fee_period_id,p.member_id FROM public.payments p JOIN public.fee_periods fp ON fp.id=p.fee_period_id
        GROUP BY p.fee_period_id,p.member_id HAVING sum(p.amount_cents)>=max(fp.amount_cents)
      ) paid GROUP BY paid.fee_period_id) t),'[]'::jsonb),
    'members', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('join_date', m.join_date, 'status', m.status))
       FROM public.members m
       WHERE m.status IN ('aktyvus', 'pasyvus')),
      '[]'::jsonb
    ),
    'payments', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('fee_period_id', p.fee_period_id, 'amount_cents', p.amount_cents))
       FROM public.payments p),
      '[]'::jsonb
    )
  );
$function$
;


-- A missing/expired token returns NULL, which must never bypass IF NOT access.
CREATE OR REPLACE FUNCTION public._can_view_meeting_doc(p_meeting_id uuid,p_token text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='public' AS $$
  SELECT coalesce(public.is_admin(),false) OR coalesce(public.is_approved_member(),false)
    OR (p_token IS NOT NULL AND p_meeting_id IS NOT NULL
        AND coalesce(public.voting_token_meeting(p_token)=p_meeting_id,false));
$$;
REVOKE ALL ON FUNCTION public._can_view_meeting_doc(uuid,text) FROM PUBLIC,anon,authenticated;

-- Match deployed RPC grants explicitly, including a fresh migration chain.
REVOKE ALL ON FUNCTION public.get_member_financial_status() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_financial_status() TO authenticated;
REVOKE ALL ON FUNCTION public.get_transparency_fee_stats() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_transparency_fee_stats() TO authenticated;
REVOKE ALL ON FUNCTION public.get_declaration_token_data(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_declaration_token_data(text) TO anon,authenticated;
