-- Pridėti gyvo dalyvavimo intencijos žymeklį
ALTER TABLE meeting_voting_tokens
ADD COLUMN live_intent_at TIMESTAMPTZ;

-- RPC: register_live_intent_with_token
-- Narys per nuorodą paspaudžia "Dalyvausiu gyvai" – jokio balsavimo, tik intencija.
-- Tokenas LIEKA aktyvus – jei narys persigalvos, gali grįžti ir balsuoti nuotoliu.
CREATE OR REPLACE FUNCTION register_live_intent_with_token(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token meeting_voting_tokens%ROWTYPE;
BEGIN
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

  UPDATE meeting_voting_tokens
  SET live_intent_at = NOW()
  WHERE id = v_token.id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION register_live_intent_with_token(TEXT) TO anon, authenticated;

-- Atnaujinti get_voting_token_data – grąžinti ir live_intent_at
CREATE OR REPLACE FUNCTION get_voting_token_data(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token meeting_voting_tokens%ROWTYPE;
  v_meeting meetings%ROWTYPE;
  v_member members%ROWTYPE;
  v_resolutions JSONB;
BEGIN
  SELECT * INTO v_token FROM meeting_voting_tokens WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'invalid_token');
  END IF;

  IF v_token.voted_at IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'already_voted', 'voted_at', v_token.voted_at);
  END IF;

  IF v_token.expires_at < NOW() THEN
    RETURN jsonb_build_object('error', 'expired');
  END IF;

  SELECT * INTO v_meeting FROM meetings WHERE id = v_token.meeting_id;
  SELECT * INTO v_member FROM members WHERE id = v_token.member_id;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'resolution_number', r.resolution_number,
      'title', r.title,
      'description', r.description,
      'requires_qualified_majority', r.requires_qualified_majority,
      'is_procedural', r.is_procedural
    ) ORDER BY r.resolution_number
  ) INTO v_resolutions
  FROM resolutions r
  WHERE r.meeting_id = v_meeting.id
    AND r.is_procedural = false;

  RETURN jsonb_build_object(
    'meeting', jsonb_build_object(
      'id', v_meeting.id,
      'title', v_meeting.title,
      'description', v_meeting.description,
      'meeting_date', v_meeting.meeting_date,
      'location', v_meeting.location
    ),
    'member', jsonb_build_object(
      'id', v_member.id,
      'first_name', v_member.first_name,
      'last_name', v_member.last_name,
      'email', v_member.email,
      'phone', v_member.phone
    ),
    'resolutions', COALESCE(v_resolutions, '[]'::jsonb),
    'expires_at', v_token.expires_at,
    'live_intent_at', v_token.live_intent_at
  );
END;
$$;
