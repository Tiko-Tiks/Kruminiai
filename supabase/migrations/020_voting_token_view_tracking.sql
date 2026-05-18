-- ============================================================================
-- 020_voting_token_view_tracking
-- get_voting_token_data dabar fiksuoja, kai narys atidaro nuorodą:
-- viewed_at (pirmo atidarymo laikas) + view_count (kiek kartų atidarė).
-- Admin panelėj /admin/susirinkimai/[id] – „Atidarė (be atsakymo)"
-- plytelė dabar realiai užpildoma.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_voting_token_data(p_token TEXT)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_token meeting_voting_tokens%ROWTYPE;
  v_meeting meetings%ROWTYPE;
  v_member members%ROWTYPE;
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

  -- Užregistruoti, kad narys atidarė nuorodą.
  -- Pirmas atidarymas → viewed_at = NOW(), view_count = 1.
  -- Sekantys → tik view_count++.
  UPDATE meeting_voting_tokens
  SET
    viewed_at = COALESCE(viewed_at, NOW()),
    view_count = COALESCE(view_count, 0) + 1
  WHERE token = p_token;

  SELECT * INTO v_meeting FROM meetings WHERE id = v_token.meeting_id;
  SELECT * INTO v_member FROM members WHERE id = v_token.member_id;

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
    'resolutions', public._meeting_resolutions_jsonb(v_meeting.id, TRUE),
    'expires_at', v_token.expires_at,
    'live_intent_at', v_token.live_intent_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_voting_token_data(TEXT) TO anon, authenticated;
