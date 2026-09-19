-- ============================================================================
-- 053: Schemos sutikrinimas su gyva duomenų baze
--
-- Dalis anksčiau pritaikytų pakeitimų repo migracijose neliko (buvo taikyti
-- tiesiogiai per SQL redaktorių arba MCP be sinchronizacijos į failą). Dėl to
-- `supabase/migrations/` nebuvo pilnas atkūrimo šaltinis.
--
-- Sakiniai idempotentiški. Nario RPC apibrėžimai išlaiko 049 patvirtinimo
-- vartus; prieš diegimą jų atitiktis produkcijai tikrinama dar kartą.
-- Tikslas – trūkstamus objektus įtraukti į repo atkūrimo istoriją.
--
-- Ko ši migracija NEIŠSPRENDŽIA: eiliškumo. Sukūrimas atsiranda 053-ioje, o
-- ankstesnės migracijos (028 politikos, 029 grant'ai) tų pačių objektų
-- prireikia anksčiau. Pilnas atkūrimas nuo nulio dar reikalauja tvarkos
-- pataisymo – žr. `supabase/migrations/README.md`.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. profiles.is_approved – portalo prieigos vartai
-- ----------------------------------------------------------------------------
-- Naudojamas `handle_new_user` trigger'yje (007), RLS politikose (028),
-- middleware ir `approveUser` server action'e, bet stulpelio sukūrimo repo
-- niekada nebuvo (gyvame registre – įrašas `add_is_approved_to_profiles`).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT false;

-- ----------------------------------------------------------------------------
-- 2. Projekto turinio EN stulpeliai
-- ----------------------------------------------------------------------------
-- Gyvame registre – įrašas `add_en_columns_updates_expenses`. 031 migracija
-- lenteles sukūrė be jų, 032 vertimus pridėjo tik `fundraising_projects`.

ALTER TABLE public.project_updates
  ADD COLUMN IF NOT EXISTS title_en TEXT,
  ADD COLUMN IF NOT EXISTS body_en  TEXT;

ALTER TABLE public.project_expenses
  ADD COLUMN IF NOT EXISTS description_en TEXT,
  ADD COLUMN IF NOT EXISTS note_en        TEXT;

-- ----------------------------------------------------------------------------
-- 3. Nario portalo ir deklaracijos RPC
-- ----------------------------------------------------------------------------
-- 007 ir 008 migracijose šios funkcijos paminėtos tik komentaru „žr. DB".
-- Nario RPC suderinti su 049, kad 053 neatšauktų prieigos kontrakto.

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

CREATE OR REPLACE FUNCTION public.submit_declaration(
  p_token TEXT,
  p_intent TEXT,
  p_email TEXT,
  p_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_decl membership_declarations%ROWTYPE;
BEGIN
  SELECT * INTO v_decl FROM membership_declarations
  WHERE token = p_token FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'invalid_token');
  END IF;

  IF v_decl.expires_at < NOW() THEN
    RETURN jsonb_build_object('error', 'expired');
  END IF;

  IF p_intent NOT IN ('continue_cash', 'continue_transfer', 'withdraw') THEN
    RETURN jsonb_build_object('error', 'invalid_intent');
  END IF;

  -- Atnaujinti deklaraciją
  UPDATE membership_declarations SET
    intent = p_intent,
    email = NULLIF(trim(p_email), ''),
    notes = NULLIF(trim(p_notes), ''),
    submitted_at = NOW()
  WHERE id = v_decl.id;

  -- Atnaujinti nario email (jei pateiktas)
  IF p_email IS NOT NULL AND length(trim(p_email)) > 0 THEN
    UPDATE members SET email = trim(p_email) WHERE id = v_decl.member_id;
  END IF;

  -- SVARBU: NEbekeičiame members.status. Statusas keičiamas tik po
  -- visuotinio susirinkimo balsavimo (per admin UI).
  -- Anksčiau buvo: IF p_intent = 'withdraw' THEN UPDATE members SET status = 'išstojęs'

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Teisės – tokios pačios kaip gyvoje bazėje (žr. 029 migracijos principą:
-- nario RPC tik `authenticated`, token srauto RPC lieka prieinami `anon`).
REVOKE EXECUTE ON FUNCTION public.get_member_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_member_profile() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.update_member_contacts(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_member_contacts(text, text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.submit_declaration(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_declaration(text, text, text, text) TO anon, authenticated;
