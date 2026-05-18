-- ============================================================================
-- 014_vote_comments_rpc
-- Atnaujinti cast_votes_with_token, kad priimtų komentarą prie kiekvieno balso
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cast_votes_with_token(
  p_token text,
  p_email text,
  p_phone text,
  p_votes jsonb
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_token meeting_voting_tokens%ROWTYPE;
  v_vote JSONB;
  v_resolution_id UUID;
  v_choice TEXT;
  v_comment TEXT;
  v_meeting_id UUID;
BEGIN
  SELECT * INTO v_token FROM meeting_voting_tokens WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'invalid_token'); END IF;
  IF v_token.voted_at IS NOT NULL THEN RETURN jsonb_build_object('error', 'already_voted'); END IF;
  IF v_token.expires_at < NOW() THEN RETURN jsonb_build_object('error', 'expired'); END IF;

  v_meeting_id := v_token.meeting_id;

  IF p_email IS NOT NULL AND length(trim(p_email)) > 0 THEN
    UPDATE members SET email = trim(p_email) WHERE id = v_token.member_id;
  END IF;
  IF p_phone IS NOT NULL AND length(trim(p_phone)) > 0 THEN
    UPDATE members SET phone = trim(p_phone) WHERE id = v_token.member_id;
  END IF;

  FOR v_vote IN SELECT * FROM jsonb_array_elements(p_votes)
  LOOP
    v_resolution_id := (v_vote->>'resolution_id')::UUID;
    v_choice := v_vote->>'vote';
    v_comment := NULLIF(trim(COALESCE(v_vote->>'comment','')), '');

    IF v_choice NOT IN ('uz', 'pries', 'susilaike') THEN
      RAISE EXCEPTION 'Negaliojantis balso pasirinkimas: %', v_choice;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM resolutions WHERE id = v_resolution_id AND meeting_id = v_meeting_id) THEN
      RAISE EXCEPTION 'Klausimas nepriklauso siam susirinkimui';
    END IF;

    INSERT INTO vote_ballots (resolution_id, member_id, vote, vote_type, comment)
    VALUES (v_resolution_id, v_token.member_id, v_choice, 'isankstinis', v_comment)
    ON CONFLICT (resolution_id, member_id) DO UPDATE SET
      vote = EXCLUDED.vote,
      vote_type = EXCLUDED.vote_type,
      comment = EXCLUDED.comment,
      voted_at = NOW();
  END LOOP;

  UPDATE meeting_voting_tokens SET voted_at = NOW() WHERE id = v_token.id;

  INSERT INTO meeting_attendance (meeting_id, member_id, attendance_type)
  VALUES (v_meeting_id, v_token.member_id, 'nuotolinis')
  ON CONFLICT (meeting_id, member_id) DO NOTHING;

  UPDATE resolutions r
  SET result_for = (SELECT count(*) FROM vote_ballots WHERE resolution_id = r.id AND vote = 'uz'),
      result_against = (SELECT count(*) FROM vote_ballots WHERE resolution_id = r.id AND vote = 'pries'),
      result_abstain = (SELECT count(*) FROM vote_ballots WHERE resolution_id = r.id AND vote = 'susilaike')
  WHERE r.meeting_id = v_meeting_id
    AND r.id IN (SELECT (v->>'resolution_id')::UUID FROM jsonb_array_elements(p_votes) v);

  RETURN jsonb_build_object('success', true);
END;
$function$;
