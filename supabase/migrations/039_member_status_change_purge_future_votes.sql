-- 039: nario statuso keitimas – BŪSIMŲ susirinkimų išankstinių balsų ir
-- dalyvavimo pašalinimas (Codex PR #2 trečia peržiūra)
--
-- Anksčiau (038) netekus balso teisės (aktyvus/pasyvus → garbes_narys/išstojęs)
-- buvo anuliuojami tik NEIŠNAUDOTI tokenai, o kvorumo vardiklis mažinamas.
-- Jei narys jau buvo balsavęs nuotoliu už dar neprasidėjusį susirinkimą, jo
-- `vote_ballots` ir `meeting_attendance` likdavo – asmuo be balso teisės vis
-- tiek darydavo įtaką rezultatams ir kvorumui. Dabar:
--   a2) būsimų susirinkimų (`planuojamas`/`registracija`, `meeting_date > NOW()`)
--       jo balsai ištrinami, nutarimų suvestinės perskaičiuojamos;
--   a3) jo dalyvavimo įrašai tiems susirinkimams ištrinami;
--   a4) „balsuota" tokenai grąžinami į nebalsuotus, bet anuliuoti – atgavus
--       balso teisę (šaka b) vėl galios iki susirinkimo pradžios;
--   audit_log įrašas (`member_lost_voting_rights`) su kiekiais.
-- Praėjusių / vykstančių susirinkimų įrašai NELIEČIAMI (istorija).

CREATE OR REPLACE FUNCTION public.on_member_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_was_eligible BOOLEAN := OLD.status IN ('aktyvus', 'pasyvus');
  v_is_eligible  BOOLEAN := NEW.status IN ('aktyvus', 'pasyvus');
  v_total INT;
  v_res_ids UUID[];
  v_ballots_deleted INT := 0;
  v_att_deleted INT := 0;
BEGIN
  -- Balso teisė nepasikeitė (pvz. aktyvus ↔ pasyvus) – nieko nedarom
  IF v_was_eligible = v_is_eligible THEN
    RETURN NEW;
  END IF;

  IF v_was_eligible AND NOT v_is_eligible THEN
    -- a1) neišnaudoti tokenai anuliuojami
    UPDATE meeting_voting_tokens
    SET expires_at = NOW()
    WHERE member_id = NEW.id
      AND voted_at IS NULL
      AND expires_at > NOW();

    -- a2) būsimų susirinkimų išankstiniai balsai pašalinami, suvestinės perskaičiuojamos
    SELECT array_agg(vb.resolution_id) INTO v_res_ids
    FROM vote_ballots vb
    JOIN resolutions r ON r.id = vb.resolution_id
    JOIN meetings m ON m.id = r.meeting_id
    WHERE vb.member_id = NEW.id
      AND m.status IN ('planuojamas', 'registracija')
      AND m.meeting_date > NOW();

    IF v_res_ids IS NOT NULL THEN
      DELETE FROM vote_ballots
      WHERE member_id = NEW.id AND resolution_id = ANY (v_res_ids);
      GET DIAGNOSTICS v_ballots_deleted = ROW_COUNT;

      UPDATE resolutions r
      SET
        result_for = (SELECT count(*) FROM vote_ballots WHERE resolution_id = r.id AND vote = 'uz'),
        result_against = (SELECT count(*) FROM vote_ballots WHERE resolution_id = r.id AND vote = 'pries'),
        result_abstain = (SELECT count(*) FROM vote_ballots WHERE resolution_id = r.id AND vote = 'susilaike')
      WHERE r.id = ANY (v_res_ids);
    END IF;

    -- a3) būsimų susirinkimų dalyvavimo įrašai pašalinami (kvorumas)
    DELETE FROM meeting_attendance ma
    USING meetings m
    WHERE ma.meeting_id = m.id
      AND ma.member_id = NEW.id
      AND m.status IN ('planuojamas', 'registracija')
      AND m.meeting_date > NOW();
    GET DIAGNOSTICS v_att_deleted = ROW_COUNT;

    -- a4) „balsuota" tokenai būsimiems susirinkimams → nebalsuoti, bet anuliuoti
    UPDATE meeting_voting_tokens t
    SET voted_at = NULL, expires_at = NOW()
    FROM meetings m
    WHERE m.id = t.meeting_id
      AND t.member_id = NEW.id
      AND t.voted_at IS NOT NULL
      AND m.status IN ('planuojamas', 'registracija')
      AND m.meeting_date > NOW();

    IF v_ballots_deleted > 0 OR v_att_deleted > 0 THEN
      INSERT INTO audit_log (user_id, action, table_name, record_id, old_data)
      VALUES (
        NULL, 'DELETE', 'vote_ballots', NEW.id,
        jsonb_build_object(
          'reason', 'member_lost_voting_rights',
          'old_status', OLD.status,
          'new_status', NEW.status,
          'ballots_deleted', v_ballots_deleted,
          'attendance_deleted', v_att_deleted
        )
      );
    END IF;
  ELSE
    -- b) atgavo balso teisę → neišnaudoti tokenai vėl galioja iki susirinkimo
    UPDATE meeting_voting_tokens t
    SET expires_at = m.meeting_date
    FROM meetings m
    WHERE m.id = t.meeting_id
      AND t.member_id = NEW.id
      AND t.voted_at IS NULL
      AND m.meeting_date > NOW()
      AND t.expires_at < m.meeting_date;
  END IF;

  -- c) kvorumo nuotrauka dar neprasidėjusiems susirinkimams (kaip createMeeting)
  SELECT count(*) INTO v_total FROM members WHERE status IN ('aktyvus', 'pasyvus');
  UPDATE meetings
  SET total_members_at_time = v_total,
      quorum_required = CASE WHEN is_repeat THEN 0 ELSE (v_total / 2) + 1 END
  WHERE status IN ('planuojamas', 'registracija')
    AND meeting_date > NOW();

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.on_member_status_change() FROM PUBLIC, anon, authenticated;
