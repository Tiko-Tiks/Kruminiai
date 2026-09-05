-- Garbės nario statusas (members.status = 'garbes_narys')
--
-- Garbės narys – bendruomenei nusipelnęs asmuo (pvz. išeivijos rėmėjas),
-- kuriam narystė suteikta BE nario mokesčio prievolės. Principai:
--   * NEMOKA stojamojo ir metinio mokesčio → portale skola visada 0
--   * NESKAIČIUOJAMAS į kvorumą ir NEBALSUOJA (tik patariamasis balsas) –
--     visos kvorumo/tokenų/priminimų užklausos jau filtruoja
--     status IN ('aktyvus','pasyvus'), todėl garbės narys į jas nepatenka
--   * GALI turėti portalo paskyrą, matyti susirinkimų archyvą, dokumentus,
--     naujienas (middleware praleidžia į /susirinkimai)

-- 1. CHECK apribojimas – naujas leidžiamas statusas
ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_status_check;
ALTER TABLE public.members ADD CONSTRAINT members_status_check
  CHECK (status IN ('aktyvus', 'pasyvus', 'išstojęs', 'garbes_narys'));

-- 2. get_member_financial_status – garbės nariui neapmokėtų metinių NĖRA
--    (mokėjimo istorija, jei kada aukojo/mokėjo, vis tiek rodoma)
CREATE OR REPLACE FUNCTION public.get_member_financial_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_member_id UUID;
  v_member_join_date DATE;
  v_member_status TEXT;
  v_unpaid JSONB;
  v_paid JSONB;
  v_total_debt INT := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT p.member_id, m.join_date, m.status
    INTO v_member_id, v_member_join_date, v_member_status
  FROM profiles p
  LEFT JOIN members m ON m.id = p.member_id
  WHERE p.id = v_user_id;

  IF v_member_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_member_link');
  END IF;

  -- Neapmokėti TIK metiniai mokesčiai nuo įstojimo metų.
  -- Vienkartiniai (stojamasis) ir tiksliniai neįtraukiami į skolą.
  -- Garbės nariui mokesčio prievolės nėra – unpaid tuščias, skola 0.
  IF v_member_status IS DISTINCT FROM 'garbes_narys' THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'fee_period_id', fp.id,
        'year', fp.year,
        'name', fp.name,
        'amount_cents', fp.amount_cents,
        'fee_type', fp.fee_type,
        'due_date', fp.due_date,
        'is_overdue', fp.due_date IS NOT NULL AND fp.due_date < CURRENT_DATE
      ) ORDER BY fp.year DESC, fp.due_date ASC
    ) INTO v_unpaid
    FROM fee_periods fp
    WHERE fp.fee_type = 'metinis'
      AND fp.year >= COALESCE(EXTRACT(YEAR FROM v_member_join_date)::INT, 2012)
      AND NOT EXISTS (
        SELECT 1 FROM payments p
        WHERE p.fee_period_id = fp.id AND p.member_id = v_member_id
      );

    SELECT COALESCE(SUM(fp.amount_cents), 0) INTO v_total_debt
    FROM fee_periods fp
    WHERE fp.fee_type = 'metinis'
      AND fp.year >= COALESCE(EXTRACT(YEAR FROM v_member_join_date)::INT, 2012)
      AND NOT EXISTS (
        SELECT 1 FROM payments p
        WHERE p.fee_period_id = fp.id AND p.member_id = v_member_id
      );
  END IF;

  -- Mokėjimo istorija – visi tipai (taip pat stojamasis ir tikslinis)
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'amount_cents', p.amount_cents,
      'paid_date', p.paid_date,
      'payment_method', p.payment_method,
      'receipt_number', p.receipt_number,
      'fee_period', jsonb_build_object(
        'year', fp.year,
        'name', fp.name,
        'fee_type', fp.fee_type
      )
    ) ORDER BY p.paid_date DESC
  ) INTO v_paid
  FROM payments p
  JOIN fee_periods fp ON fp.id = p.fee_period_id
  WHERE p.member_id = v_member_id;

  RETURN jsonb_build_object(
    'unpaid', COALESCE(v_unpaid, '[]'::jsonb),
    'paid', COALESCE(v_paid, '[]'::jsonb),
    'total_debt_cents', v_total_debt
  );
END;
$function$;

-- 3. cast_votes_as_member – balsuoti iš portalo gali tik aktyvus/pasyvus
--    narys. Garbės narys (patariamasis balsas) ir išstojęs – 'not_eligible'.
--    (SMS balsavimo tokenai tokiems nariams ir taip negeneruojami.)
CREATE OR REPLACE FUNCTION public.cast_votes_as_member(p_meeting_id uuid, p_votes jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_member_id UUID;
  v_member_status TEXT;
  v_vote JSONB;
  v_resolution_id UUID;
  v_choice TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT member_id INTO v_member_id FROM profiles WHERE id = v_user_id;
  IF v_member_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_member_link');
  END IF;

  SELECT status INTO v_member_status FROM members WHERE id = v_member_id;
  IF v_member_status IS NULL OR v_member_status NOT IN ('aktyvus', 'pasyvus') THEN
    RETURN jsonb_build_object('error', 'not_eligible');
  END IF;

  -- Patikrinti, ar narys jau balsavo per kažkurį šio susirinkimo nutarimą
  IF EXISTS (
    SELECT 1 FROM vote_ballots vb
    JOIN resolutions r ON r.id = vb.resolution_id
    WHERE r.meeting_id = p_meeting_id AND vb.member_id = v_member_id
  ) THEN
    RETURN jsonb_build_object('error', 'already_voted');
  END IF;

  FOR v_vote IN SELECT * FROM jsonb_array_elements(p_votes)
  LOOP
    v_resolution_id := (v_vote->>'resolution_id')::UUID;
    v_choice := v_vote->>'vote';

    IF v_choice NOT IN ('uz', 'pries', 'susilaike') THEN
      RAISE EXCEPTION 'Negaliojantis balsas: %', v_choice;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM resolutions WHERE id = v_resolution_id AND meeting_id = p_meeting_id
    ) THEN
      RAISE EXCEPTION 'Klausimas nepriklauso šiam susirinkimui';
    END IF;

    INSERT INTO vote_ballots (resolution_id, member_id, vote, vote_type)
    VALUES (v_resolution_id, v_member_id, v_choice, 'isankstinis');
  END LOOP;

  -- Auto-registruoti kaip nuotolinį dalyvį
  INSERT INTO meeting_attendance (meeting_id, member_id, attendance_type)
  VALUES (p_meeting_id, v_member_id, 'nuotolinis')
  ON CONFLICT (meeting_id, member_id) DO NOTHING;

  -- Atnaujinti rezultatų suvestines
  UPDATE resolutions r
  SET
    result_for = (SELECT count(*) FROM vote_ballots WHERE resolution_id = r.id AND vote = 'uz'),
    result_against = (SELECT count(*) FROM vote_ballots WHERE resolution_id = r.id AND vote = 'pries'),
    result_abstain = (SELECT count(*) FROM vote_ballots WHERE resolution_id = r.id AND vote = 'susilaike')
  WHERE r.meeting_id = p_meeting_id
    AND r.id IN (SELECT (v->>'resolution_id')::UUID FROM jsonb_array_elements(p_votes) v);

  -- Užrakinti SMS tokeną, jei yra (kad narys nepasielgtų antrą kartą per SMS)
  UPDATE meeting_voting_tokens
  SET voted_at = NOW()
  WHERE meeting_id = p_meeting_id AND member_id = v_member_id AND voted_at IS NULL;

  RETURN jsonb_build_object('success', true);
END;
$function$;
