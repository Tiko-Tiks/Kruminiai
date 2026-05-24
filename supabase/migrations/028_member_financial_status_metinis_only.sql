-- Klaida: get_member_financial_status traktuoja VISUS fee_periods kaip
-- privalomus mokėjimus. Vienkartinis (stojamasis) yra mokamas TIK įstojant –
-- esamiems nariams tai NĖRA skola.
--
-- Pataisymas: 'unpaid' ir 'total_debt' apima TIK fee_type='metinis'.
-- Vienkartiniai/tiksliniai mokėjimai matomi tik 'paid' istorijoje.

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
  v_unpaid JSONB;
  v_paid JSONB;
  v_total_debt INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT p.member_id, m.join_date INTO v_member_id, v_member_join_date
  FROM profiles p
  LEFT JOIN members m ON m.id = p.member_id
  WHERE p.id = v_user_id;

  IF v_member_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_member_link');
  END IF;

  -- Neapmokėti TIK metiniai mokesčiai nuo įstojimo metų.
  -- Vienkartiniai (stojamasis) ir tiksliniai neįtraukiami į skolą.
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

  -- Bendra skola = TIK neapmokėti metiniai
  SELECT COALESCE(SUM(fp.amount_cents), 0) INTO v_total_debt
  FROM fee_periods fp
  WHERE fp.fee_type = 'metinis'
    AND fp.year >= COALESCE(EXTRACT(YEAR FROM v_member_join_date)::INT, 2012)
    AND NOT EXISTS (
      SELECT 1 FROM payments p
      WHERE p.fee_period_id = fp.id AND p.member_id = v_member_id
    );

  RETURN jsonb_build_object(
    'unpaid', COALESCE(v_unpaid, '[]'::jsonb),
    'paid', COALESCE(v_paid, '[]'::jsonb),
    'total_debt_cents', v_total_debt
  );
END;
$function$;
