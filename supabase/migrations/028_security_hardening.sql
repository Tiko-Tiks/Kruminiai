-- ============================================================================
-- 028: Saugumo užveržimas (RLS hardening)
--
-- PROBLEMA: visos pagrindinės lentelės turėjo „Authenticated full access"
-- politikas su USING (true) – bet kuris prisijungęs vartotojas (įskaitant
-- per /registracija savarankiškai susikūrusį, nepatvirtintą) per PostgREST
-- API galėjo:
--   • skaityti vote_ballots (balsavimo slaptumo pažeidimas!)
--   • skaityti meeting_voting_tokens (balsuoti už kitus narius!)
--   • skaityti/keisti members, payments, meetings, news ir kt.
--   • per profiles UPDATE be WITH CHECK pasikelti role='super_admin'
--
-- SPRENDIMAS: rašymas – tik admin/super_admin; skaitymas – pagal poreikį
-- (narys mato tik tai, ką rodo puslapiai; jautrios lentelės – tik admin).
-- Portalo/balsavimo srautai ir toliau eina per SECURITY DEFINER RPC.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Pagalbinės funkcijos
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'super_admin')
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_approved_member()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_approved = true
  );
$$;

REVOKE ALL ON FUNCTION public.is_approved_member() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_approved_member() TO authenticated;

-- ----------------------------------------------------------------------------
-- 2) members – admin valdo, narys mato TIK savo įrašą (middleware join'ui)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated full access to members" ON public.members;

CREATE POLICY members_admin_all ON public.members
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY members_select_own ON public.members
  FOR SELECT TO authenticated
  USING (id = (SELECT p.member_id FROM public.profiles p WHERE p.id = auth.uid()));

-- ----------------------------------------------------------------------------
-- 3) payments – tik admin (nario finansai eina per get_member_financial_status)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated full access to payments" ON public.payments;

CREATE POLICY payments_admin_all ON public.payments
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 4) fee_periods – skaityti gali visi prisijungę (Skaidrumas), rašyti – admin
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated full access to fee_periods" ON public.fee_periods;

CREATE POLICY fee_periods_admin_all ON public.fee_periods
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY fee_periods_select_authenticated ON public.fee_periods
  FOR SELECT TO authenticated
  USING (true);

-- ----------------------------------------------------------------------------
-- 5) meetings – skaityti gali prisijungę (kaip anon), rašyti – admin
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated full access to meetings" ON public.meetings;

CREATE POLICY meetings_admin_all ON public.meetings
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY meetings_select_authenticated ON public.meetings
  FOR SELECT TO authenticated
  USING (status <> 'atšauktas');

-- ----------------------------------------------------------------------------
-- 6) resolutions + resolution_documents – skaitymas prisijungusiems
--    (darbotvarkė vieša per get_public_meeting_data), rašymas – admin
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated full access to resolutions" ON public.resolutions;

CREATE POLICY resolutions_admin_all ON public.resolutions
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY resolutions_select_authenticated ON public.resolutions
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated full access to resolution_documents" ON public.resolution_documents;

CREATE POLICY resolution_documents_admin_all ON public.resolution_documents
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY resolution_documents_select_authenticated ON public.resolution_documents
  FOR SELECT TO authenticated
  USING (true);

-- ----------------------------------------------------------------------------
-- 7) documents – vieši visiems, nevieši tik patvirtintiems nariams; rašo admin
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated full access to documents" ON public.documents;

CREATE POLICY documents_admin_all ON public.documents
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY documents_select_authenticated ON public.documents
  FOR SELECT TO authenticated
  USING (is_public = true OR public.is_approved_member());

-- ----------------------------------------------------------------------------
-- 8) news – publikuotos visiems, juodraščiai tik admin; rašo admin
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated full access to news" ON public.news;

CREATE POLICY news_admin_all ON public.news
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY news_select_authenticated ON public.news
  FOR SELECT TO authenticated
  USING (is_published = true);

-- ----------------------------------------------------------------------------
-- 9) vote_ballots – BALSAVIMO SLAPTUMAS: narys mato tik SAVO balsus,
--    admin valdo (suvestinėms ir popierinių balsų įvedimui)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated full access to vote_ballots" ON public.vote_ballots;

CREATE POLICY vote_ballots_admin_all ON public.vote_ballots
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY vote_ballots_select_own ON public.vote_ballots
  FOR SELECT TO authenticated
  USING (member_id = (SELECT p.member_id FROM public.profiles p WHERE p.id = auth.uid()));

-- ----------------------------------------------------------------------------
-- 10) meeting_attendance / meeting_voting_tokens / membership_declarations –
--     TIK admin (tokenai = galimybė balsuoti už kitą; dalyvių sąrašas – GDPR)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated full access to meeting_attendance" ON public.meeting_attendance;

CREATE POLICY meeting_attendance_admin_all ON public.meeting_attendance
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Authenticated full access to voting_tokens" ON public.meeting_voting_tokens;

CREATE POLICY meeting_voting_tokens_admin_all ON public.meeting_voting_tokens
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Authenticated full access to membership_declarations" ON public.membership_declarations;

CREATE POLICY membership_declarations_admin_all ON public.membership_declarations
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 11) audit_log – skaito tik admin; INSERT tik savo vardu (be klastojimo)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated can insert audit log" ON public.audit_log;
DROP POLICY IF EXISTS "Authenticated can read audit log" ON public.audit_log;

CREATE POLICY audit_log_admin_select ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY audit_log_insert_own ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 12) notification_log – trūko INSERT politikos (tiesioginiai admin insert'ai
--     contact-updates sraute tyliai nepavykdavo). RPC log_notification lieka.
-- ----------------------------------------------------------------------------
CREATE POLICY notification_log_admin_insert ON public.notification_log
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 13) profiles – KRITINIS privilegijų eskalacijos fix'as:
--     sena UPDATE politika be WITH CHECK leido nariui pačiam pasikeisti
--     role / is_approved / member_id. Dabar: narys mato/atnaujina tik savo
--     įrašą, o jautrius stulpelius gali keisti tik admin (trigger'is).
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY profiles_admin_all ON public.profiles
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- auth.uid() IS NULL = service role / migracijos – leidžiama.
  -- Admin – leidžiama. Eilinis vartotojas jautrių stulpelių keisti negali.
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.is_approved IS DISTINCT FROM OLD.is_approved
       OR NEW.member_id IS DISTINCT FROM OLD.member_id THEN
      RAISE EXCEPTION 'Negalima keisti rolės, patvirtinimo ar nario susiejimo';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_profile_privileges() FROM PUBLIC;

DROP TRIGGER IF EXISTS protect_profile_privileges ON public.profiles;
CREATE TRIGGER protect_profile_privileges
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileges();

-- ----------------------------------------------------------------------------
-- 14) Storage – upload/delete tik admin; pašalinamas bucket'ų LISTINIMAS
--     (vieši failai per public URL veikia ir be SELECT politikos)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read documents" ON storage.objects;
DROP POLICY IF EXISTS "Public read images" ON storage.objects;
DROP POLICY IF EXISTS "Auth upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Auth upload images" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete documents" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete images" ON storage.objects;

CREATE POLICY "Admin upload documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND public.is_admin());

CREATE POLICY "Admin delete documents" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND public.is_admin());

CREATE POLICY "Admin upload images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'images' AND public.is_admin());

CREATE POLICY "Admin delete images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'images' AND public.is_admin());

-- ----------------------------------------------------------------------------
-- 15) RPC teisių higiena
-- ----------------------------------------------------------------------------
-- Vidinis helper'is – kviečiamas tik iš kitų SECURITY DEFINER RPC
REVOKE EXECUTE ON FUNCTION public._meeting_resolutions_jsonb(uuid, boolean) FROM anon, authenticated;

-- Trigger funkcija – ne API
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;

-- Nario RPC – tik authenticated (anon vis tiek gautų klaidą, bet higiena)
REVOKE EXECUTE ON FUNCTION public.get_member_active_meetings() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_member_voting_history() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_member_financial_status() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_member_profile() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_member_contacts(text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cast_votes_as_member(uuid, jsonb) FROM anon;
-- PASTABA: log_notification anon teisė PALIEKAMA – ją naudoja anoniminis
-- balsavimo srautas (vote_confirmation email log'inimas iš /balsuoti).

-- Advisor'iaus pažymėtas mutable search_path
ALTER FUNCTION public.update_updated_at() SET search_path = public;

-- ----------------------------------------------------------------------------
-- 16) Skaidrumo puslapio RPC – kad nariams nereikėtų tiesioginės members /
--     payments SELECT teisės (ten PII). Grąžina tik agregavimui būtinus laukus.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_transparency_fee_stats()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
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
$$;

REVOKE ALL ON FUNCTION public.get_transparency_fee_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_transparency_fee_stats() TO authenticated;
