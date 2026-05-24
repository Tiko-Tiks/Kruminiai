-- Kontaktų atnaujinimo SMS magic link srautas.
-- Skirta nariams, kurie neturi el. pašto (ar pasenusių kitų kontaktų),
-- kad galėtų greitai juos pridėti per vienkartinę nuorodą be paskyros.
--
-- Workflow:
--   1. Admin /admin/nariai/kontaktai puslapyje pažymi narius
--   2. Sistema generuoja unikalų tokeną kiekvienam → siunčia SMS
--   3. Narys spaudžia nuorodą /duomenys/[token]
--   4. Atsidaro forma su email/telefonas/adresas (pre-filled, jei yra)
--   5. Submit → įrašoma į members + tokenas užrakinamas

CREATE TABLE IF NOT EXISTS contact_update_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  viewed_at TIMESTAMPTZ NULL,
  view_count INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ NULL,
  created_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_contact_update_tokens_member_id
  ON contact_update_tokens(member_id);
CREATE INDEX IF NOT EXISTS idx_contact_update_tokens_token
  ON contact_update_tokens(token);

ALTER TABLE contact_update_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contact_tokens_admin_read" ON contact_update_tokens;
CREATE POLICY "contact_tokens_admin_read"
  ON contact_update_tokens FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "contact_tokens_admin_write" ON contact_update_tokens;
CREATE POLICY "contact_tokens_admin_write"
  ON contact_update_tokens FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')
    )
  );

CREATE OR REPLACE FUNCTION public.get_contact_update_token_data(p_token TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_token contact_update_tokens%ROWTYPE;
  v_member members%ROWTYPE;
BEGIN
  SELECT * INTO v_token FROM contact_update_tokens WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'invalid_token');
  END IF;
  IF v_token.completed_at IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'already_completed');
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
  p_token TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_address TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_token contact_update_tokens%ROWTYPE;
BEGIN
  SELECT * INTO v_token FROM contact_update_tokens WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'invalid_token');
  END IF;
  IF v_token.completed_at IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'already_completed');
  END IF;

  UPDATE members
  SET email = NULLIF(TRIM(p_email), ''),
      phone = COALESCE(NULLIF(TRIM(p_phone), ''), phone),
      address = COALESCE(NULLIF(TRIM(p_address), ''), address),
      updated_at = NOW()
  WHERE id = v_token.member_id;

  UPDATE contact_update_tokens
  SET completed_at = NOW()
  WHERE id = v_token.id;

  RETURN jsonb_build_object('success', TRUE);
END;
$function$;
