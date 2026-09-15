-- ============================================================================
-- 044_community_finance.sql – bendruomenės finansų modulis
-- ============================================================================
--
-- KODĖL: 2026-09-15 buvo atliktas pilnas sutikrinimas su AB Artea banko išrašu
-- (IBAN LT167181200000606866, 2026-01-01 – 2026-09-15). Rasta neatitikimų už
-- 529,69 €. Priežastys buvo struktūrinės, ne atsitiktinės:
--
--   * bendros išlaidos (elektra, ARATC, notaras) neturėjo kur būti įrašytos –
--     `project_expenses.project_id` buvo NOT NULL;
--   * nesimatė, IŠ KOKIŲ lėšų išlaida apmokėta (nario mokesčiai ar tikslinės
--     projekto aukos);
--   * nebuvo kur užfiksuoti pinigų judėjimo tarp kasos ir banko sąskaitos,
--     todėl kasos likutis visada „nesueidavo";
--   * nebuvo su kuo sulyginti sistemos likutį (banko išrašo niekur nesaugojom).
--
-- Ši migracija formalizuoja schemą, kad neatitikimai nebesikartotų, ir
-- įgalina `/finansai` puslapį nariams.
--
-- DALIS ŠIŲ PAKEITIMŲ JAU BUVO PADARYTA TIESIOGIAI PER SQL sutikrinimo metu
-- (project_expenses.project_id NOT NULL nuėmimas, `category` stulpelis,
-- `opening_balance` lentelė). Čia jie užrašomi idempotentiškai, kad repo
-- `supabase/migrations/` atspindėtų realią DB būklę ir naujoje aplinkoje
-- viskas atsikurtų nuo nulio.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. project_expenses – bendros (neprojektinės) išlaidos, kategorija,
--    lėšų šaltinis ir apmokėjimo būdas
-- ----------------------------------------------------------------------------

-- Išlaida gali būti bendruomenės, o ne konkretaus projekto (elektra, ARATC,
-- notaras). Būtent dėl NOT NULL jos iki šiol niekur nebuvo vedamos.
ALTER TABLE public.project_expenses ALTER COLUMN project_id DROP NOT NULL;

ALTER TABLE public.project_expenses ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.project_expenses ADD COLUMN IF NOT EXISTS funding_source TEXT;
ALTER TABLE public.project_expenses ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- Kategorija lieka NULL-able TYČIA: seni įrašai be kategorijos turi likti
-- matomi admin skydelio įspėjime („Išlaidos be kategorijos"). Privaloma ji
-- yra formos lygyje (zod), ne DB.
ALTER TABLE public.project_expenses DROP CONSTRAINT IF EXISTS project_expenses_category_check;
ALTER TABLE public.project_expenses ADD CONSTRAINT project_expenses_category_check
  CHECK (category IS NULL OR category IN (
    'projektas',      -- konkretaus projekto darbai/medžiagos
    'komunaliniai',   -- elektra, atliekų rinkliava, vanduo
    'administracija', -- notaras, banko mokesčiai, buhalterija
    'renginiai',      -- šventės, talkos
    'kita'
  ));

-- IŠ KOKIŲ LĖŠŲ apmokėta – be šito nesimato, ar elektra apmokėta iš nario
-- mokesčių, ar netyčia „suvalgytos" tikslinės liepto aukos.
UPDATE public.project_expenses SET funding_source = CASE
    WHEN project_id IS NULL THEN 'nario_mokesciai'
    WHEN project_id = (SELECT id FROM public.fundraising_projects WHERE slug = 'bendruomenes-fondas')
      THEN 'bendruomenes_fondas'
    ELSE 'projekto_lesos'
  END
  WHERE funding_source IS NULL;

ALTER TABLE public.project_expenses ALTER COLUMN funding_source SET DEFAULT 'projekto_lesos';
ALTER TABLE public.project_expenses ALTER COLUMN funding_source SET NOT NULL;

ALTER TABLE public.project_expenses DROP CONSTRAINT IF EXISTS project_expenses_funding_source_check;
ALTER TABLE public.project_expenses ADD CONSTRAINT project_expenses_funding_source_check
  CHECK (funding_source IN (
    'projekto_lesos',      -- tikslinės to projekto aukos
    'bendruomenes_fondas', -- nepaskirstytos aukos
    'nario_mokesciai',     -- nario mokesčių biudžetas
    'savivaldybes_parama', -- dotacija
    'kita'
  ));

-- Apmokėjimo būdas – BŪTINAS, kad atsiskirtų banko ir kasos likučiai.
-- Be jo „bendruomenė turi 13 868,50 €" neišsiskaido į „banke" + „kasoje".
UPDATE public.project_expenses
  SET payment_method = CASE
    WHEN note ILIKE '%grynais%' OR note ILIKE '%grynaisiais%' THEN 'grynieji'
    ELSE 'bankas'
  END
  WHERE payment_method IS NULL;

ALTER TABLE public.project_expenses ALTER COLUMN payment_method SET DEFAULT 'bankas';
ALTER TABLE public.project_expenses ALTER COLUMN payment_method SET NOT NULL;

ALTER TABLE public.project_expenses DROP CONSTRAINT IF EXISTS project_expenses_payment_method_check;
ALTER TABLE public.project_expenses ADD CONSTRAINT project_expenses_payment_method_check
  CHECK (payment_method IN ('bankas', 'grynieji'));

CREATE INDEX IF NOT EXISTS project_expenses_expense_date_idx
  ON public.project_expenses (expense_date DESC);
CREATE INDEX IF NOT EXISTS project_expenses_funding_source_idx
  ON public.project_expenses (funding_source);

-- ----------------------------------------------------------------------------
-- 2. opening_balance – pradinis likutis, nuo kurio skaičiuojam
-- ----------------------------------------------------------------------------
-- Sistema neturi 2012–2025 m. operacijų, todėl likutis skaičiuojamas nuo
-- žinomos datos: pradinis likutis + pajamos − išlaidos.

CREATE TABLE IF NOT EXISTS public.opening_balance (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  as_of_date   DATE NOT NULL,
  amount_cents BIGINT NOT NULL,
  note         TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- UNIQUE – vienai datai vienas pradinis likutis (ir seed'as idempotentiškas)
CREATE UNIQUE INDEX IF NOT EXISTS opening_balance_as_of_date_key
  ON public.opening_balance (as_of_date);

INSERT INTO public.opening_balance (as_of_date, amount_cents, note)
VALUES ('2026-01-01', 10814, 'Likutis AB Artea sąskaitoje 2026-01-01 pagal banko išrašą.')
ON CONFLICT (as_of_date) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. cash_transfers – vidiniai pervedimai tarp kasos ir banko
-- ----------------------------------------------------------------------------
-- Nei pajamos, nei išlaidos: bendra suma nesikeičia, bet be šio įrašo kasos
-- likutis visada per didelis, o banko – per mažas.

CREATE TABLE IF NOT EXISTS public.cash_transfers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_date DATE NOT NULL,
  direction     TEXT NOT NULL CHECK (direction IN ('kasa_i_banka', 'bankas_i_kasa')),
  amount_cents  BIGINT NOT NULL CHECK (amount_cents > 0),
  note          TEXT,
  note_en       TEXT,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cash_transfers_transfer_date_idx
  ON public.cash_transfers (transfer_date DESC);

-- Istorinis faktas iš sutikrinimo: 2026-01-08 iš kasos paimta 200 € ir įnešta
-- į sąskaitą per asmeninį pavedimą.
INSERT INTO public.cash_transfers (transfer_date, direction, amount_cents, note, note_en)
SELECT '2026-01-08', 'kasa_i_banka', 20000,
       'Grynieji įnešti į sąskaitą per asmeninį pavedimą',
       'Cash deposited into the account via a personal transfer'
WHERE NOT EXISTS (
  SELECT 1 FROM public.cash_transfers
  WHERE transfer_date = '2026-01-08' AND direction = 'kasa_i_banka' AND amount_cents = 20000
);

-- ----------------------------------------------------------------------------
-- 4. bank_statements – rankinis banko išrašo suvedimas sutikrinimui
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.bank_statements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start  DATE NOT NULL,
  period_end    DATE NOT NULL,
  opening_cents BIGINT NOT NULL,
  closing_cents BIGINT NOT NULL,
  income_cents  BIGINT NOT NULL,
  expense_cents BIGINT NOT NULL,
  imported_at   TIMESTAMPTZ DEFAULT now(),
  note          TEXT,
  note_en       TEXT,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT bank_statements_period_check CHECK (period_end >= period_start)
);

CREATE INDEX IF NOT EXISTS bank_statements_period_end_idx
  ON public.bank_statements (period_end DESC);

-- Rankiniu būdu sutikrintas 2026 m. laikotarpis (AB Artea išrašas).
-- Įplaukos/išlaidos – tik banko sąskaitos judėjimas, be kasos.
INSERT INTO public.bank_statements
  (period_start, period_end, opening_cents, closing_cents, income_cents, expense_cents, note, note_en)
SELECT '2026-01-01', '2026-09-15', 10814, 1330850, 1747179, 427143,
       'AB Artea, IBAN LT167181200000606866. Suvesta rankiniu būdu po pilno sutikrinimo 2026-09-15.',
       'AB Artea, IBAN LT167181200000606866. Entered manually after the full reconciliation on 2026-09-15.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.bank_statements
  WHERE period_start = '2026-01-01' AND period_end = '2026-09-15'
);

-- ----------------------------------------------------------------------------
-- 5. donations – aukotojo vardo rodymas
-- ----------------------------------------------------------------------------
-- Numatytasis režimas – TIK INICIALAI. Pilnas vardas rodomas juridiniams
-- asmenims, institucijoms ir rėmėjams, davusiems aiškų sutikimą.

ALTER TABLE public.donations ADD COLUMN IF NOT EXISTS display_mode TEXT;

-- Struktūrizuotas vardas: kaukė neturi priklausyti nuo eilutės parsinimo.
-- Istoriškai `donor_name` saugotas nevienodai („Danutė. G", „Vaida Kuncienė",
-- „Menčinskų šeima"), todėl parsinimas buvo trapus. Naujiems įrašams admin
-- veda vardą ir pavardę atskirai; parsinimas lieka tik kaip fallback'as.
ALTER TABLE public.donations ADD COLUMN IF NOT EXISTS donor_first_name TEXT;
ALTER TABLE public.donations ADD COLUMN IF NOT EXISTS donor_last_name TEXT;

-- Rėmėjo vardas sutikrinimo metu buvo įrašytas angliška forma; bendruomenės
-- registre ir išlaidų pastabose jis yra Gintautas Kairys.
UPDATE public.donations SET donor_name = 'Gintautas Kairys' WHERE donor_name = 'Charles Kairys';

UPDATE public.donations SET display_mode = CASE
    WHEN is_anonymous THEN 'anonymous'
    WHEN donor_name IS NULL OR btrim(donor_name) = '' THEN 'anonymous'
    -- Juridiniai asmenys, institucijos ir sutikimą davęs rėmėjas
    WHEN donor_name IN (
      'Varėnos rajono savivaldybė',
      'Gyventojų parama per VMI (1,2 % GPM)',
      'Gintautas Kairys'
    ) THEN 'full'
    ELSE 'initials'
  END
  WHERE display_mode IS NULL;

ALTER TABLE public.donations ALTER COLUMN display_mode SET DEFAULT 'initials';
ALTER TABLE public.donations ALTER COLUMN display_mode SET NOT NULL;

ALTER TABLE public.donations DROP CONSTRAINT IF EXISTS donations_display_mode_check;
ALTER TABLE public.donations ADD CONSTRAINT donations_display_mode_check
  CHECK (display_mode IN ('initials', 'full', 'anonymous'));

-- Vienkartinis `donor_name` išskaidymas į vardą/pavardę. Apdorojami tik
-- asmenvardžiai: „Vardas Pavardė" ir istorinė „Vardas. P" forma. Šeimos
-- („Menčinskų šeima") ir organizacijos paliekamos be struktūros – jų kaukę
-- tvarko `formatDonorName` (src/lib/donor-name.ts).
UPDATE public.donations
SET donor_first_name = btrim(split_part(btrim(donor_name), ' ', 1)),
    donor_last_name  = btrim(regexp_replace(split_part(btrim(donor_name), ' ', 2), '\.$', ''))
WHERE display_mode = 'initials'
  AND donor_first_name IS NULL
  AND donor_name IS NOT NULL
  AND donor_name !~ 'šeima'
  AND array_length(regexp_split_to_array(btrim(donor_name), '\s+'), 1) = 2;

-- Istorinė „Vardas. P" forma paliko tašką pirmame žodyje – nuimam.
UPDATE public.donations
SET donor_first_name = regexp_replace(donor_first_name, '\.$', '')
WHERE donor_first_name LIKE '%.';

CREATE INDEX IF NOT EXISTS donations_donated_at_idx ON public.donations (donated_at DESC);

-- ----------------------------------------------------------------------------
-- 6. RLS – patvirtinti nariai skaito, admin'ai rašo
-- ----------------------------------------------------------------------------
-- Viešuose surinkimo puslapiuose (/projektai/[slug], /lieptas) aukos ir
-- išlaidos matomos ir anon vartotojui – SENOS `public_read_*` politikos
-- LIEKA NEPALIESTOS. Čia pridedam TIK papildomas (permissive OR) politikas
-- patvirtintiems nariams, kad `/finansai` matytų ir nevieš(ų) projektų
-- (bendruomenes-fondas) bei bendras (project_id IS NULL) eilutes.

ALTER TABLE public.opening_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_transfers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_statements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS members_read_donations ON public.donations;
CREATE POLICY members_read_donations ON public.donations
  FOR SELECT TO authenticated
  USING (public.is_approved_member() OR public.is_admin());

DROP POLICY IF EXISTS members_read_project_expenses ON public.project_expenses;
CREATE POLICY members_read_project_expenses ON public.project_expenses
  FOR SELECT TO authenticated
  USING (public.is_approved_member() OR public.is_admin());

-- Nevieši projektai (`is_public = false`) į /finansai patenka, nes nariui
-- reikia matyti VISĄ bendruomenės paveikslą; į viešus puslapius ir sitemap –
-- ne (ten filtruoja `public_read_projects` politika ir `.eq("is_public", true)`).
DROP POLICY IF EXISTS members_read_projects ON public.fundraising_projects;
CREATE POLICY members_read_projects ON public.fundraising_projects
  FOR SELECT TO authenticated
  USING (public.is_approved_member() OR public.is_admin());

DROP POLICY IF EXISTS members_read_project_updates ON public.project_updates;
CREATE POLICY members_read_project_updates ON public.project_updates
  FOR SELECT TO authenticated
  USING (public.is_approved_member() OR public.is_admin());

DROP POLICY IF EXISTS members_read_opening_balance ON public.opening_balance;
CREATE POLICY members_read_opening_balance ON public.opening_balance
  FOR SELECT TO authenticated
  USING (public.is_approved_member() OR public.is_admin());

DROP POLICY IF EXISTS admins_write_opening_balance ON public.opening_balance;
CREATE POLICY admins_write_opening_balance ON public.opening_balance
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS members_read_cash_transfers ON public.cash_transfers;
CREATE POLICY members_read_cash_transfers ON public.cash_transfers
  FOR SELECT TO authenticated
  USING (public.is_approved_member() OR public.is_admin());

DROP POLICY IF EXISTS admins_write_cash_transfers ON public.cash_transfers;
CREATE POLICY admins_write_cash_transfers ON public.cash_transfers
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS members_read_bank_statements ON public.bank_statements;
CREATE POLICY members_read_bank_statements ON public.bank_statements
  FOR SELECT TO authenticated
  USING (public.is_approved_member() OR public.is_admin());

DROP POLICY IF EXISTS admins_write_bank_statements ON public.bank_statements;
CREATE POLICY admins_write_bank_statements ON public.bank_statements
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- `payments` – narys mato TIK savo mokėjimus (admin'as – visus per
-- `payments_admin_all`). Bendruomenės suvestinė eina per RPC žemiau, be PII.
DROP POLICY IF EXISTS payments_select_own ON public.payments;
CREATE POLICY payments_select_own ON public.payments
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR member_id IN (
      SELECT p.member_id FROM public.profiles p
      WHERE p.id = auth.uid() AND p.member_id IS NOT NULL
    )
  );

-- ----------------------------------------------------------------------------
-- 7. get_community_fee_summary – nario mokesčių suvestinė BE asmens duomenų
-- ----------------------------------------------------------------------------
-- /finansai rodo tik agregatus: kiek narių sumokėjo, kiek surinkta, atskirai
-- grynieji ir pavedimai. Konkrečių narių mokėjimai – asmens duomenys, todėl
-- RPC jų negrąžina jokia forma.
--
--   by_period – pagal mokesčio periodą (metai + tipas): „už 2026 m. sumokėjo N"
--   by_month  – pagal FAKTINĘ apmokėjimo datą: reikalinga likučiui skaičiuoti
--               (2023 m. mokestis, sumokėtas 2026-05, yra 2026 m. įplauka)

CREATE OR REPLACE FUNCTION public.get_community_fee_summary()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT (public.is_approved_member() OR public.is_admin()) THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT jsonb_build_object(
    'by_period', COALESCE((
      SELECT jsonb_agg(x ORDER BY x->>'year' DESC, x->>'fee_type')
      FROM (
        SELECT jsonb_build_object(
          'year', fp.year,
          'fee_type', fp.fee_type,
          'name', fp.name,
          'fee_amount_cents', fp.amount_cents,
          'payer_count', COUNT(DISTINCT p.member_id),
          'payment_count', COUNT(*),
          'total_cents', COALESCE(SUM(p.amount_cents), 0),
          'cash_cents', COALESCE(SUM(p.amount_cents) FILTER (WHERE p.payment_method = 'grynieji'), 0),
          'transfer_cents', COALESCE(SUM(p.amount_cents) FILTER (WHERE p.payment_method <> 'grynieji'), 0)
        ) AS x
        FROM public.payments p
        JOIN public.fee_periods fp ON fp.id = p.fee_period_id
        GROUP BY fp.year, fp.fee_type, fp.name, fp.amount_cents
      ) s
    ), '[]'::jsonb),
    'by_month', COALESCE((
      SELECT jsonb_agg(y ORDER BY y->>'month')
      FROM (
        SELECT jsonb_build_object(
          'month', to_char(p.paid_date, 'YYYY-MM'),
          'payment_count', COUNT(*),
          'total_cents', COALESCE(SUM(p.amount_cents), 0),
          'cash_cents', COALESCE(SUM(p.amount_cents) FILTER (WHERE p.payment_method = 'grynieji'), 0),
          'transfer_cents', COALESCE(SUM(p.amount_cents) FILTER (WHERE p.payment_method <> 'grynieji'), 0)
        ) AS y
        FROM public.payments p
        GROUP BY to_char(p.paid_date, 'YYYY-MM')
      ) s2
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Funkcijų EXECUTE higiena (žr. migr. 029): anon šito RPC kviesti negali.
REVOKE ALL ON FUNCTION public.get_community_fee_summary() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_community_fee_summary() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_community_fee_summary() TO authenticated;

-- ----------------------------------------------------------------------------
-- 8. get_members_without_current_fee – admin įspėjimui
-- ----------------------------------------------------------------------------
-- „Aktyvus narys be einamųjų metų mokėjimo" – būtent ši klaida sutikrinimo
-- metu paslėpė 2 narių mokėjimus (banke pinigai buvo, sistemoje – 0 įrašų).

CREATE OR REPLACE FUNCTION public.get_members_without_current_fee(p_year INTEGER)
RETURNS TABLE (member_id UUID, first_name TEXT, last_name TEXT, status TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.first_name, m.last_name, m.status
  FROM public.members m
  WHERE public.is_admin()
    -- Garbės narys nuo nario mokesčio atleistas (žr. CLAUDE.md)
    AND m.status IN ('aktyvus', 'pasyvus')
    AND (m.join_date IS NULL OR EXTRACT(YEAR FROM m.join_date)::int <= p_year)
    AND NOT EXISTS (
      SELECT 1 FROM public.payments p
      JOIN public.fee_periods fp ON fp.id = p.fee_period_id
      WHERE p.member_id = m.id AND fp.year = p_year AND fp.fee_type = 'metinis'
    )
  ORDER BY m.last_name, m.first_name;
$$;

REVOKE ALL ON FUNCTION public.get_members_without_current_fee(INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_members_without_current_fee(INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_members_without_current_fee(INTEGER) TO authenticated;
