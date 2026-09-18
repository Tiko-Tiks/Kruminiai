-- ============================================================================
-- 046: Tokenų gyvavimo ciklas – vienoda galiojimo taisyklė visiems srautams
--
-- KODĖL:
--   1) `voting_token_meeting()` (migr. 034) grąžindavo susirinkimo ID pagal BET
--      KOKĮ tokeną – ir pasibaigusį, ir anuliuotą (migr. 038–040 anuliuoja
--      nustatydamos `expires_at = NOW()`). Balsavimo RPC galiojimą tikrina, o
--      dokumentų prieigos helper'is – ne, todėl ta pati nuoroda skirtingose
--      vietose „gyvuodavo" skirtingai. Nuo šiol taisyklė viena: tokenas
--      galioja, kol `expires_at > NOW()`.
--   2) `contact_update_tokens` (migr. 027) apskritai neturėjo galiojimo pabaigos
--      – kartą išsiųsta SMS nuoroda liko tinkama neribotą laiką. Pridedam
--      `expires_at` (numatytai +30 d.) ir tikrinam abiejuose RPC.
--   3) `update_member_with_token()` tikrindavo `completed_at` ir tik po to jį
--      nustatydavo, neužrakinęs eilutės – du lygiagretūs pateikimai galėjo
--      abu praeiti patikrą. Nuo šiol eilutė imama `FOR UPDATE`, o tokeno
--      „sudeginimas" yra sąlyginis UPDATE toje pačioje transakcijoje.
--
-- Migracija idempotentiška; duomenų nenaikina (esamiems tokenams galiojimas
-- atskaičiuojamas nuo `sent_at`).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Balsavimo tokeno → susirinkimo helper'is: tik galiojantis tokenas
-- ----------------------------------------------------------------------------
-- `voted_at` SĄMONINGAI netikrinamas: jau balsavęs narys iki susirinkimo gali
-- norėti dar kartą atsiversti darbotvarkės dokumentus per tą pačią nuorodą.
-- Balso pakartoti jis negali – tai saugo `cast_votes_with_token` (`already_voted`).
CREATE OR REPLACE FUNCTION public.voting_token_meeting(p_token text)
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT t.meeting_id
  FROM public.meeting_voting_tokens t
  WHERE p_token IS NOT NULL
    AND length(p_token) > 0
    AND t.token = p_token
    AND t.expires_at > NOW();
$function$;

REVOKE ALL ON FUNCTION public.voting_token_meeting(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.voting_token_meeting(text) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2) contact_update_tokens: galiojimo pabaiga
-- ----------------------------------------------------------------------------
ALTER TABLE public.contact_update_tokens
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Esamiems įrašams – 30 d. nuo išsiuntimo. Seni tokenai tokiu būdu iškart
-- tampa pasibaigę, o tai ir yra tikslas (jie guli nuo pat 027 migracijos).
UPDATE public.contact_update_tokens
SET expires_at = sent_at + INTERVAL '30 days'
WHERE expires_at IS NULL;

ALTER TABLE public.contact_update_tokens
  ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '30 days');

ALTER TABLE public.contact_update_tokens
  ALTER COLUMN expires_at SET NOT NULL;

COMMENT ON COLUMN public.contact_update_tokens.expires_at IS
  'Kontaktų atnaujinimo nuorodos galiojimo pabaiga (numatyta +30 d. nuo sukūrimo).';

-- ----------------------------------------------------------------------------
-- 3) Kontaktų tokeno RPC: galiojimo patikra + atominis vienkartinis panaudojimas
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_contact_update_token_data(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_token contact_update_tokens%ROWTYPE;
  v_member members%ROWTYPE;
BEGIN
  IF p_token IS NULL OR length(p_token) = 0 THEN
    RETURN jsonb_build_object('error', 'invalid_token');
  END IF;

  -- FOR UPDATE: žemiau atnaujinam peržiūros skaitiklį, todėl eilutę imam iškart
  -- užrakintą – kitaip lygiagretūs atidarymai perrašytų vienas kitą.
  SELECT * INTO v_token FROM contact_update_tokens WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'invalid_token');
  END IF;

  IF v_token.completed_at IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'already_completed');
  END IF;

  IF v_token.expires_at <= NOW() THEN
    RETURN jsonb_build_object('error', 'expired');
  END IF;

  SELECT * INTO v_member FROM members WHERE id = v_token.member_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'member_not_found');
  END IF;

  UPDATE contact_update_tokens
  SET viewed_at = COALESCE(viewed_at, NOW()),
      view_count = view_count + 1
  WHERE id = v_token.id;

  RETURN jsonb_build_object(
    'member', jsonb_build_object(
      'id', v_member.id,
      'first_name', v_member.first_name,
      'last_name', v_member.last_name,
      'email', v_member.email,
      'phone', v_member.phone,
      'address', v_member.address
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_member_with_token(
  p_token text,
  p_email text,
  p_phone text,
  p_address text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_token contact_update_tokens%ROWTYPE;
  v_consumed UUID;
BEGIN
  IF p_token IS NULL OR length(p_token) = 0 THEN
    RETURN jsonb_build_object('error', 'invalid_token');
  END IF;

  SELECT * INTO v_token FROM contact_update_tokens WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'invalid_token');
  END IF;

  IF v_token.completed_at IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'already_completed');
  END IF;

  IF v_token.expires_at <= NOW() THEN
    RETURN jsonb_build_object('error', 'expired');
  END IF;

  -- Tokeną „sudeginam" sąlyginiu UPDATE'u: net jei kita transakcija spėtų
  -- praeiti patikrą, `completed_at IS NULL` sąlyga jos neįleis.
  UPDATE contact_update_tokens
  SET completed_at = NOW()
  WHERE id = v_token.id AND completed_at IS NULL
  RETURNING member_id INTO v_consumed;

  IF v_consumed IS NULL THEN
    RETURN jsonb_build_object('error', 'already_completed');
  END IF;

  UPDATE members
  SET email = NULLIF(TRIM(p_email), ''),
      phone = COALESCE(NULLIF(TRIM(p_phone), ''), phone),
      address = COALESCE(NULLIF(TRIM(p_address), ''), address),
      updated_at = NOW()
  WHERE id = v_consumed;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'member_not_found');
  END IF;

  RETURN jsonb_build_object('success', TRUE);
END;
$function$;

-- EXECUTE higiena (migr. 029 stilius): token srauto RPC lieka anon-callable,
-- nes juos atidaro SMS gavėjas be sesijos.
REVOKE ALL ON FUNCTION public.get_contact_update_token_data(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_contact_update_token_data(text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.update_member_with_token(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_member_with_token(text, text, text, text) TO anon, authenticated;
