-- ============================================================================
-- 048: Prieigos kontraktas – patvirtinimas, žurnalų rašymas, aukų skaitymas
--
-- Trys susijusios spragos tame pačiame sluoksnyje („kas ką gali skaityti ir
-- rašyti"), todėl taisomos viena migracija:
--
--   A. PATVIRTINIMAS. `is_admin()` tikrindavo tik rolę, ne `is_approved`.
--      Profilis su `role='admin', is_approved=false` (t. y. prieiga ATŠAUKTA)
--      RLS politikose vis tiek buvo laikomas administratoriumi. Nario RPC
--      (`get_member_profile`, `get_member_financial_status`,
--      `update_member_contacts`) tikrindavo tik `auth.uid()` ir nario sąsają.
--      `meeting_expulsions` turėjo `USING (true)` visiems `authenticated`.
--      PRIELAIDA (patikrinta prieš rašant, SELECT'u į `profiles`): vienintelis
--      `super_admin` profilis yra `is_approved = true`, todėl užveržimas
--      neužrakina administratoriaus. Prieš taikant migraciją verta patikrinti
--      dar kartą:
--        SELECT role, is_approved, count(*) FROM profiles GROUP BY 1,2;
--
--   B. ŽURNALAI. `log_notification()` yra SECURITY DEFINER ir vykdomas
--      `authenticated` – be jokios rolės patikros viduje. `audit_log` INSERT
--      politika leido bet kuriam prisijungusiam rašyti savo `user_id` įrašus.
--      Abu žurnalai naudojami kaip įrodymas (šalinimo dossier, auditas), tad
--      rašyti į juos gali tik administratorius arba serverio (service_role)
--      procesas.
--
--   C. AUKOS. `donations` eilutėse yra `donor_name` / `donor_first_name` /
--      `donor_last_name`. Aukotojo vardo kaukė (`formatDonorName`) yra
--      PATEIKIMO sluoksnis – ji nieko nekeičia tam, kas lentelę skaito
--      tiesiogiai per PostgREST. Nuo šiol `donations` skaitymas paliekamas tik
--      administratoriui, o puslapiai (vieši ir nariams skirti) eilutes gauna
--      per serverio pusės kroviklį (`src/lib/donations-data.ts`) ir į naršyklę
--      atiduoda TIK jau užmaskuotą vardą.
--
-- Migracija idempotentiška.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A. Patvirtinimo reikalavimas
-- ----------------------------------------------------------------------------

-- Administratoriumi laikomas tik patvirtintas profilis. Prieigos atšaukimas
-- (`is_approved = false`) nuo šiol iškart nustoja galioti ir admin veiksmams.
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_approved = true
      AND p.role IN ('admin', 'super_admin')
  );
$function$;

-- `is_approved_member()` jau reikalavo `is_approved = true`; paliekam kaip yra,
-- tik užrašom kontraktą, kad kitas skaitytojas nekartotų patikros kitaip.
COMMENT ON FUNCTION public.is_approved_member() IS
  'TRUE, kai dabartinė sesija priklauso patvirtintam (is_approved) profiliui. Vienas šaltinis RLS politikoms ir nario RPC vartams.';

COMMENT ON FUNCTION public.is_admin() IS
  'TRUE, kai dabartinė sesija priklauso PATVIRTINTAM admin/super_admin profiliui.';

-- Nario RPC vartai. `cast_votes_as_member`, `get_member_active_meetings` ir
-- `get_member_voting_history` gauna tą patį vartą migracijoje 049 (ten jie
-- perrašomi kartu su balso teisės helper'iu) – kad ta pati funkcija nebūtų
-- apibrėžta du kartus iš eilės.

CREATE OR REPLACE FUNCTION public.get_member_profile()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_profile profiles%ROWTYPE;
  v_member members%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  IF NOT (public.is_approved_member() OR public.is_admin()) THEN
    RETURN jsonb_build_object('error', 'not_approved');
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = v_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'profile_not_found');
  END IF;

  IF v_profile.member_id IS NOT NULL THEN
    SELECT * INTO v_member FROM members WHERE id = v_profile.member_id;
  END IF;

  RETURN jsonb_build_object(
    'profile', jsonb_build_object(
      'id', v_profile.id,
      'full_name', v_profile.full_name,
      'role', v_profile.role,
      'is_approved', v_profile.is_approved,
      'member_id', v_profile.member_id
    ),
    'member', CASE
      WHEN v_profile.member_id IS NOT NULL THEN
        jsonb_build_object(
          'id', v_member.id,
          'first_name', v_member.first_name,
          'last_name', v_member.last_name,
          'email', v_member.email,
          'phone', v_member.phone,
          'address', v_member.address,
          'join_date', v_member.join_date,
          'status', v_member.status
        )
      ELSE NULL
    END
  );
END;
$function$;

-- SUJUNGTA su įstatų atitikties migracija (20260918185337_bylaws_enforcement, main
-- 060094d): ji tą pačią funkciją perrašo su ĮMOKOMIS DALIMIS (laikotarpio skola yra
-- `greatest(suma − visų to laikotarpio įmokų suma, 0)`, `payments`
-- UNIQUE(member_id, fee_period_id) ten pašalintas) ir su `bylaws_fee_applies()`
-- (mokestis taikomas tik tiems metams, kai narystė galiojo). Gamyboje 048 taikoma
-- PO jos, todėl šis kūnas privalo būti abiejų pakeitimų SĄJUNGA: tos migracijos
-- kūnas pažodžiui + 048 patvirtinimo vartai (`not_approved`). Grįžus prie senosios
-- NOT EXISTS / join_date logikos 5 € + 7 € įmokos vėl nepadengtų 12 €, o buvusio
-- nario laikotarpiai būtų skaičiuojami neteisingai.
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

  IF NOT (public.is_approved_member() OR public.is_admin()) THEN
    RETURN jsonb_build_object('error', 'not_approved');
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
$function$;

CREATE OR REPLACE FUNCTION public.update_member_contacts(p_email text, p_phone text, p_address text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_member_id UUID;
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

  UPDATE members SET
    email = NULLIF(trim(p_email), ''),
    phone = NULLIF(trim(p_phone), ''),
    address = NULLIF(trim(p_address), '')
  WHERE id = v_member_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'no_member_link');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- Šalinamų narių kandidatai – dossier su vardais, skolomis ir bendravimo
-- istorija. Skaito administratorius; balsuotojui jis pasiekiamas tik per
-- `get_meeting_expulsions_data` (migr. 047), kuris duomenis minimizuoja.
DROP POLICY IF EXISTS "members_read_expulsions" ON public.meeting_expulsions;
DROP POLICY IF EXISTS "expulsions_admin_select" ON public.meeting_expulsions;
CREATE POLICY "expulsions_admin_select" ON public.meeting_expulsions
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- Senesnės politikos „admin" sąvoką aprašo inline užklausa į `profiles`, kuri
-- tikrina TIK rolę. Perrašom į `public.is_admin()`, kad patvirtinimo
-- reikalavimas galiotų visur vienodai – kitaip užveržta funkcija nieko
-- nereikštų ten, kur jos nenaudoja. Taip pat susiaurinam `TO public` →
-- `TO authenticated`: anon šių eilučių neliečia.
DROP POLICY IF EXISTS "admins_write_expulsions" ON public.meeting_expulsions;
CREATE POLICY "admins_write_expulsions" ON public.meeting_expulsions
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins_write_donations" ON public.donations;
CREATE POLICY "admins_write_donations" ON public.donations
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins_write_projects" ON public.fundraising_projects;
CREATE POLICY "admins_write_projects" ON public.fundraising_projects
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins_write_management" ON public.community_management;
CREATE POLICY "admins_write_management" ON public.community_management
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "meeting_announcements_admin_write" ON public.meeting_announcements;
CREATE POLICY "meeting_announcements_admin_write" ON public.meeting_announcements
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "contact_tokens_admin_read" ON public.contact_update_tokens;
CREATE POLICY "contact_tokens_admin_read" ON public.contact_update_tokens
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "contact_tokens_admin_write" ON public.contact_update_tokens;
CREATE POLICY "contact_tokens_admin_write" ON public.contact_update_tokens
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins_read_notification_log" ON public.notification_log;
CREATE POLICY "admins_read_notification_log" ON public.notification_log
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- B. Žurnalų rašymas
-- ----------------------------------------------------------------------------

-- Pranešimų istoriją rašo tik administratorius arba serverio procesas su
-- service-role raktu (anon srautų sisteminiai įrašai – žr. logNotificationSystem).
CREATE OR REPLACE FUNCTION public.log_notification(
  p_member_id uuid,
  p_channel text,
  p_kind text,
  p_recipient text,
  p_subject text,
  p_message text,
  p_status text,
  p_error text DEFAULT NULL::text,
  p_external_id text DEFAULT NULL::text,
  p_batch_id uuid DEFAULT NULL::uuid,
  p_segments integer DEFAULT NULL::integer
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id UUID;
BEGIN
  IF NOT (public.is_admin() OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'Nepakanka teisių rašyti į pranešimų žurnalą'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.notification_log (
    member_id, channel, kind, recipient, subject, message,
    status, error, external_id, batch_id, segments, created_by
  ) VALUES (
    p_member_id, p_channel, p_kind, p_recipient, p_subject, p_message,
    p_status, p_error, p_external_id, p_batch_id, p_segments, auth.uid()
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.log_notification(uuid, text, text, text, text, text, text, text, text, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_notification(uuid, text, text, text, text, text, text, text, text, uuid, integer) TO authenticated;

-- Audito žurnalas: eilutes rašo tik administratorius. Sisteminius įrašus
-- (pvz. narystės statuso trigger'is) rašo SECURITY DEFINER funkcijos, kurios
-- RLS nepraeina – jos vykdomos lentelės savininko teisėmis.
DROP POLICY IF EXISTS "audit_log_insert_own" ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_admin_insert" ON public.audit_log;
CREATE POLICY "audit_log_admin_insert" ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() AND user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- C. Aukų skaitymas
-- ----------------------------------------------------------------------------

-- Vieša ir nariams skirta SELECT politika naikinamos: žalias aukotojo vardas
-- neturi būti pasiekiamas nei anon, nei eiliniam nariui per PostgREST.
-- Puslapiai eilutes gauna serveryje (service-role kroviklis) ir atiduoda tik
-- `formatDonorName()` rezultatą.
DROP POLICY IF EXISTS "public_read_donations" ON public.donations;
DROP POLICY IF EXISTS "members_read_donations" ON public.donations;

DROP POLICY IF EXISTS "donations_admin_select" ON public.donations;
CREATE POLICY "donations_admin_select" ON public.donations
  FOR SELECT TO authenticated
  USING (public.is_admin());

COMMENT ON TABLE public.donations IS
  'Aukos. SELECT – tik administratoriui; puslapiai skaito per serverio kroviklį ir rodo tik užmaskuotą aukotojo vardą (src/lib/donor-name.ts).';

-- `get_member_donations_overview()` grąžina žalią `donor_name` bet kuriam
-- patvirtintam nariui, t. y. apeina tą pačią kaukę. Repo kodas jos nenaudoja,
-- todėl atimam `authenticated` EXECUTE; jei ji kada bus reikalinga, pirma
-- turi būti perrašyta taip, kad vardų neatiduotų.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_member_donations_overview'
  ) THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.get_member_donations_overview() FROM PUBLIC, anon, authenticated';
  END IF;
END
$$;

-- ----------------------------------------------------------------------------
-- D. Dokumentų prieigos helper'io (migr. 047) trireikšmės logikos spraga
-- ----------------------------------------------------------------------------
-- 047 `_can_view_meeting_doc` skaičiuoja `... OR (p_token IS NOT NULL AND
-- public.voting_token_meeting(p_token) = p_meeting_id)`. Neegzistuojančiam ar
-- pasibaigusiam tokenui `voting_token_meeting` grąžina NULL, `NULL = uuid` yra
-- NULL, todėl visa išraiška tampa NULL, o RPC viduje `IF NOT NULL` NEsuveikia –
-- anon su bet kokiu netikru tokenu gaudavo paskelbto susirinkimo dokumentą.
-- Tas pats tekstas kaip įstatų atitikties migracijoje (20260918185337), kad
-- abi migracijos, kad ir kokia tvarka taikomos, baigtųsi tuo pačiu kūnu.
-- Parašas nekeičiamas (uuid, text), todėl 047 REVOKE lieka; pakartojam jį
-- eksplicitiškai, kad švarioje grandinėje niekas nepriklausytų nuo eilės.

-- A missing/expired token returns NULL, which must never bypass IF NOT access.
CREATE OR REPLACE FUNCTION public._can_view_meeting_doc(p_meeting_id uuid,p_token text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='public' AS $$
  SELECT coalesce(public.is_admin(),false) OR coalesce(public.is_approved_member(),false)
    OR (p_token IS NOT NULL AND p_meeting_id IS NOT NULL
        AND coalesce(public.voting_token_meeting(p_token)=p_meeting_id,false));
$$;
REVOKE ALL ON FUNCTION public._can_view_meeting_doc(uuid,text) FROM PUBLIC,anon,authenticated;
