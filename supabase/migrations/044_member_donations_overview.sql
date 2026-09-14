-- ============================================================================
-- 044_member_donations_overview
-- Nariams skirta VISŲ bendruomenės aukų ir lėšų suvestinė (/aukos puslapis).
--
-- Kodėl RPC, o ne RLS praplėtimas:
--   `donations` / `fundraising_projects` RLS (migr. 015) leidžia anon+authenticated
--   skaityti tik VIEŠŲ projektų (is_public = true) įrašus. Neviešas „Bendruomenės
--   fondas" turi likti nematomas neprisijungusiems, bet matomas patvirtintiems
--   nariams. Praplėtus RLS politiką nariams, neviešas fondas iškart „iššoktų"
--   ir viešuose puslapiuose (/projektai, /projektai/[slug], /skaidrumas) – jie
--   renderinami su TO PATIES nario sesija, o filtras ten yra is_public = true
--   tik projektų užklausoje. Todėl prieiga prie pilno vaizdo duodama per
--   SECURITY DEFINER RPC su vidiniu leidimo patikrinimu – viešų puslapių
--   užklausos lieka nepaliestos.
--
-- Grąžina NULL, jei kvietėjas nėra patvirtintas narys ar adminas.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_member_donations_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_projects        jsonb;
  v_donations       jsonb;
  v_total_cents     bigint;
  v_expense_cents   bigint;
  v_donation_count  integer;
BEGIN
  -- Vartai: tik prisijungęs PATVIRTINTAS narys arba adminas.
  IF NOT (public.is_approved_member() OR public.is_admin()) THEN
    RETURN NULL;
  END IF;

  -- Projektų suvestinė: surinkta / išleista / likutis kiekvienam projektui,
  -- įskaitant neviešus (pvz. „Bendruomenės fondas").
  WITH don AS (
    SELECT project_id,
           SUM(amount_cents)::bigint AS total_cents,
           COUNT(*)::int             AS donation_count
      FROM public.donations
     GROUP BY project_id
  ), exp AS (
    SELECT project_id,
           SUM(amount_cents)::bigint AS expense_cents
      FROM public.project_expenses
     GROUP BY project_id
  ), proj AS (
    SELECT p.id, p.slug, p.title, p.is_public, p.is_active, p.goal_cents,
           COALESCE(d.total_cents, 0)      AS total_cents,
           COALESCE(d.donation_count, 0)   AS donation_count,
           COALESCE(e.expense_cents, 0)    AS expense_cents
      FROM public.fundraising_projects p
      LEFT JOIN don d ON d.project_id = p.id
      LEFT JOIN exp e ON e.project_id = p.id
  )
  SELECT COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'id',             pr.id,
               'slug',           pr.slug,
               'title',          pr.title,
               'is_public',      pr.is_public,
               'is_active',      pr.is_active,
               'goal_cents',     pr.goal_cents,
               'total_cents',    pr.total_cents,
               'donation_count', pr.donation_count,
               'expense_cents',  pr.expense_cents,
               'balance_cents',  pr.total_cents - pr.expense_cents
             )
             ORDER BY pr.total_cents DESC, pr.title
           ),
           '[]'::jsonb
         )
    INTO v_projects
    FROM proj pr;

  -- Aukų sąrašas (naujausios viršuje). Anoniminės aukos vardo NEGRĄŽINA
  -- – duomenų minimizavimas: UI vis tiek rodytų „Anonimas" (plg. migr. 033).
  SELECT COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'id',            d.id,
               'project_id',    d.project_id,
               'project_slug',  p.slug,
               'project_title', p.title,
               'donor_name',    CASE WHEN d.is_anonymous THEN NULL ELSE d.donor_name END,
               'amount_cents',  d.amount_cents,
               'method',        d.method,
               'donated_at',    d.donated_at,
               'is_anonymous',  d.is_anonymous,
               'donor_message', d.donor_message
             )
             ORDER BY d.donated_at DESC, d.created_at DESC
           ),
           '[]'::jsonb
         )
    INTO v_donations
    FROM public.donations d
    JOIN public.fundraising_projects p ON p.id = d.project_id;

  SELECT COALESCE(SUM(amount_cents), 0)::bigint, COUNT(*)::int
    INTO v_total_cents, v_donation_count
    FROM public.donations;

  SELECT COALESCE(SUM(amount_cents), 0)::bigint
    INTO v_expense_cents
    FROM public.project_expenses;

  RETURN jsonb_build_object(
    'projects',  v_projects,
    'donations', v_donations,
    'totals',    jsonb_build_object(
      'total_cents',    v_total_cents,
      'expense_cents',  v_expense_cents,
      'balance_cents',  v_total_cents - v_expense_cents,
      'donation_count', v_donation_count,
      'project_count',  jsonb_array_length(v_projects)
    )
  );
END;
$$;

COMMENT ON FUNCTION public.get_member_donations_overview() IS
  'Visos bendruomenės aukos + lėšų suvestinė patvirtintiems nariams (/aukos). '
  'Įtraukia neviešus projektus; anon negauna nieko (NULL).';

-- Funkcijų EXECUTE higiena (plg. migr. 029): anon negali kviesti.
REVOKE EXECUTE ON FUNCTION public.get_member_donations_overview() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_member_donations_overview() TO authenticated;
