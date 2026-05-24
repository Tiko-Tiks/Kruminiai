-- Pataisom dvi RPC funkcijas, kad jos atspindėtų ir gyvai dalyvavusius
-- narius (kurių balsai neturi vote_ballots įrašų – jie agreguojami
-- į resolutions.result_for/against/abstain admin'o).
--
-- Anksčiau Dovilė (dalyvavo gyvai, status='fizinis' meeting_attendance'e)
-- portalo /portalas dashboard'e nematydavo savo susirinkimo istorijos,
-- nes vote_ballots'e jos įrašų nėra.

-- 1) Aktyvūs susirinkimai – has_voted reiškia „dalyvavo bet kuriuo būdu"
CREATE OR REPLACE FUNCTION public.get_member_active_meetings()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_member_id UUID;
  v_result JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT member_id INTO v_member_id FROM profiles WHERE id = v_user_id;
  IF v_member_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_member_link');
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'title', m.title,
      'meeting_date', m.meeting_date,
      'location', m.location,
      'status', m.status,
      'early_voting_start', m.early_voting_start,
      'early_voting_end', m.early_voting_end,
      -- has_voted: arba vote_ballots (nuotoliu/portale), arba
      -- meeting_attendance (gyvai). Bet kuriuo būdu jau dalyvavęs.
      'has_voted', (
        EXISTS (
          SELECT 1 FROM vote_ballots vb
          JOIN resolutions r ON r.id = vb.resolution_id
          WHERE r.meeting_id = m.id AND vb.member_id = v_member_id
        )
        OR
        EXISTS (
          SELECT 1 FROM meeting_attendance ma
          WHERE ma.meeting_id = m.id AND ma.member_id = v_member_id
        )
      )
    ) ORDER BY m.meeting_date ASC
  ) INTO v_result
  FROM meetings m
  WHERE m.status IN ('planuojamas', 'registracija', 'vyksta')
    AND m.meeting_date >= NOW() - INTERVAL '1 day';

  RETURN jsonb_build_object('member_id', v_member_id, 'meetings', COALESCE(v_result, '[]'::jsonb));
END;
$function$;

-- 2) Balsavimo istorija – įtraukiam ir gyvai dalyvautus susirinkimus
CREATE OR REPLACE FUNCTION public.get_member_voting_history()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_member_id UUID;
  v_result JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT member_id INTO v_member_id FROM profiles WHERE id = v_user_id;
  IF v_member_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_member_link');
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'meeting_id', m.id,
      'meeting_title', m.title,
      'meeting_date', m.meeting_date,
      'meeting_status', m.status,
      -- attendance_type: 'fizinis' = gyvai, 'nuotolinis' = nuotoliu,
      -- 'rastu' = raštu. NULL = balsavo per portalą (be attendance įrašo).
      'attendance_type', (
        SELECT ma.attendance_type FROM meeting_attendance ma
        WHERE ma.meeting_id = m.id AND ma.member_id = v_member_id
        LIMIT 1
      ),
      'votes', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'resolution_number', r.resolution_number,
            'resolution_title', r.title,
            'vote', vb.vote,
            'vote_type', vb.vote_type,
            'voted_at', vb.voted_at
          ) ORDER BY r.resolution_number
        )
        FROM vote_ballots vb
        JOIN resolutions r ON r.id = vb.resolution_id
        WHERE r.meeting_id = m.id AND vb.member_id = v_member_id
      )
    ) ORDER BY m.meeting_date DESC
  ) INTO v_result
  FROM meetings m
  WHERE
    -- arba balsavo per portalą/SMS
    EXISTS (
      SELECT 1 FROM vote_ballots vb
      JOIN resolutions r ON r.id = vb.resolution_id
      WHERE r.meeting_id = m.id AND vb.member_id = v_member_id
    )
    OR
    -- arba dalyvavo gyvai/nuotoliu/raštu (jokio vote_ballots įrašo)
    EXISTS (
      SELECT 1 FROM meeting_attendance ma
      WHERE ma.meeting_id = m.id AND ma.member_id = v_member_id
    );

  RETURN jsonb_build_object('history', COALESCE(v_result, '[]'::jsonb));
END;
$function$;
