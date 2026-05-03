-- Junction lentelė: vienas dokumentas gali būti prikabintas prie daugelio nutarimų
CREATE TABLE resolution_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resolution_id UUID NOT NULL REFERENCES resolutions(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(resolution_id, document_id)
);

CREATE INDEX idx_resolution_documents_resolution ON resolution_documents(resolution_id);

ALTER TABLE resolution_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access to resolution_documents"
  ON resolution_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Atnaujinti get_voting_token_data: prie kiekvieno nutarimo pridėti documents masyvą
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
      'is_procedural', r.is_procedural,
      'documents', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', d.id,
            'title', d.title,
            'file_path', d.file_path,
            'file_name', d.file_name,
            'file_size', d.file_size,
            'category', d.category
          ) ORDER BY rd.sort_order, d.title
        )
        FROM resolution_documents rd
        JOIN documents d ON d.id = rd.document_id
        WHERE rd.resolution_id = r.id
      ), '[]'::jsonb)
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
