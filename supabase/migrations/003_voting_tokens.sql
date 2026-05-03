-- Balsavimo tokenai – nuotolinis balsavimas per SMS nuorodą
-- Kiekvienam aktyviam nariui generuojamas unikalus tokenas susirinkimui.
-- Narys per nuorodą: patikslina kontaktus → balsuoja → patvirtina → tokenas užrakinamas.

CREATE TABLE meeting_voting_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  sent_at TIMESTAMPTZ,
  voted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(meeting_id, member_id)
);

CREATE INDEX idx_voting_tokens_token ON meeting_voting_tokens(token);
CREATE INDEX idx_voting_tokens_meeting ON meeting_voting_tokens(meeting_id);

ALTER TABLE meeting_voting_tokens ENABLE ROW LEVEL SECURITY;

-- Tik admin gali matyti / valdyti tokenus per dashboard
CREATE POLICY "Authenticated full access to voting_tokens"
  ON meeting_voting_tokens FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- =============================================================================
-- RPC: get_voting_token_data
-- Anoniminis prieigos taškas – grąžina viską, ko reikia balsavimo puslapiui.
-- =============================================================================
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
  -- Tokenas
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

  -- Susirinkimas
  SELECT * INTO v_meeting FROM meetings WHERE id = v_token.meeting_id;

  -- Narys
  SELECT * INTO v_member FROM members WHERE id = v_token.member_id;

  -- Klausimai (ne procedūriniai, balsuojami nuotoliu)
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
    'expires_at', v_token.expires_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_voting_token_data(TEXT) TO anon, authenticated;

-- =============================================================================
-- RPC: cast_votes_with_token
-- Atominis balsų įrašymas + nario duomenų atnaujinimas + tokeno užrakinimas.
-- =============================================================================
CREATE OR REPLACE FUNCTION cast_votes_with_token(
  p_token TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_votes JSONB  -- [{"resolution_id": "uuid", "vote": "uz|pries|susilaike"}, ...]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token meeting_voting_tokens%ROWTYPE;
  v_vote JSONB;
  v_resolution_id UUID;
  v_choice TEXT;
  v_meeting_id UUID;
BEGIN
  -- Užrakinti tokeno eilutę kad išvengtume race condition
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

  -- Atnaujinti nario duomenis (jei pateikti)
  IF p_email IS NOT NULL AND length(trim(p_email)) > 0 THEN
    UPDATE members SET email = trim(p_email) WHERE id = v_token.member_id;
  END IF;
  IF p_phone IS NOT NULL AND length(trim(p_phone)) > 0 THEN
    UPDATE members SET phone = trim(p_phone) WHERE id = v_token.member_id;
  END IF;

  -- Įrašyti balsus
  FOR v_vote IN SELECT * FROM jsonb_array_elements(p_votes)
  LOOP
    v_resolution_id := (v_vote->>'resolution_id')::UUID;
    v_choice := v_vote->>'vote';

    IF v_choice NOT IN ('uz', 'pries', 'susilaike') THEN
      RAISE EXCEPTION 'Negaliojantis balso pasirinkimas: %', v_choice;
    END IF;

    -- Patikrinti, kad klausimas priklauso šiam susirinkimui
    IF NOT EXISTS (
      SELECT 1 FROM resolutions
      WHERE id = v_resolution_id AND meeting_id = v_meeting_id
    ) THEN
      RAISE EXCEPTION 'Klausimas nepriklauso šiam susirinkimui';
    END IF;

    INSERT INTO vote_ballots (resolution_id, member_id, vote, vote_type)
    VALUES (v_resolution_id, v_token.member_id, v_choice, 'isankstinis')
    ON CONFLICT (resolution_id, member_id) DO UPDATE SET
      vote = EXCLUDED.vote,
      vote_type = EXCLUDED.vote_type,
      voted_at = NOW();
  END LOOP;

  -- Užrakinti tokeną
  UPDATE meeting_voting_tokens
  SET voted_at = NOW()
  WHERE id = v_token.id;

  -- Auto-registruoti kaip nuotolinį dalyvį (kvorumo skaičiavimui)
  INSERT INTO meeting_attendance (meeting_id, member_id, attendance_type)
  VALUES (v_meeting_id, v_token.member_id, 'nuotolinis')
  ON CONFLICT (meeting_id, member_id) DO NOTHING;

  -- Atnaujinti rezultatų suvestines
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
$$;

GRANT EXECUTE ON FUNCTION cast_votes_with_token(TEXT, TEXT, TEXT, JSONB) TO anon, authenticated;
