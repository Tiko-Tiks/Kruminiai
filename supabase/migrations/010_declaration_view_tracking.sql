-- ============================================================================
-- 010_declaration_view_tracking
-- Pridėti viewed_at + view_count į membership_declarations,
-- kad žinotume, kas paspaudė nuorodą (bet dar neatsakė).
-- ============================================================================

ALTER TABLE public.membership_declarations
  ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.membership_declarations.viewed_at IS
  'Pirmas kartas, kai narys atidarė /deklaracija/[token] puslapį.';
COMMENT ON COLUMN public.membership_declarations.view_count IS
  'Kiek kartų narys atidarė deklaracijos puslapį.';

-- Atnaujinti get_declaration_token_data: pridėti view tracking + grąžinti viewed_at, view_count
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
        'amount_cents', fp.amount_cents
      ) ORDER BY fp.year ASC
    ),
    COALESCE(SUM(fp.amount_cents), 0)
  INTO v_unpaid, v_total_cents
  FROM fee_periods fp
  WHERE fp.fee_type = 'metinis'
    AND fp.year >= v_join_year
    AND NOT EXISTS (
      SELECT 1 FROM payments p
      WHERE p.fee_period_id = fp.id AND p.member_id = v_decl.member_id
    );

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
$function$;
