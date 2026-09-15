import { createServerSupabaseClient } from "@/lib/supabase-server";
import type {
  BankStatement,
  FeeDaySummary,
  FeeMonthSummary,
  FeePeriodSummary,
  FinanceDonation,
  FinanceExpense,
  FinanceProject,
  FinanceTransfer,
  OpeningBalance,
} from "@/lib/finance";

/**
 * Visi bendruomenės finansų duomenys vienoje vietoje – naudoja `/finansai`
 * (nariams) ir `/admin/finansai/sutikrinimas`.
 *
 * PRIEIGA: lentelių RLS (migr. 044) praleidžia tik patvirtintą narį arba
 * admin'ą, o nario mokesčių suvestinė eina per SECURITY DEFINER RPC, kuris
 * grąžina TIK agregatus – jokių konkretaus nario mokėjimų (asmens duomenys).
 * `payments` lentelės čia neliečiam sąmoningai.
 *
 * Šis modulis NĖRA server action ir neturi „use server" – kitaip kiekviena
 * jo funkcija taptų viešu POST endpoint'u. Serveryje jis lieka dėl
 * `createServerSupabaseClient` (naudoja `next/headers`). Mutacijos gyvena
 * `src/actions/finance.ts`.
 */

export interface CommunityFinanceData {
  /**
   * `true`, kai vartotojas nėra patvirtintas narys – RLS jam viską filtruoja
   * ir puslapis rodytų nulius. Geriau pasakyti tiesiai, nei meluoti nuliais.
   */
  accessDenied: boolean;
  openingBalance: OpeningBalance | null;
  projects: FinanceProject[];
  donations: FinanceDonation[];
  expenses: FinanceExpense[];
  transfers: FinanceTransfer[];
  statements: BankStatement[];
  feePeriods: FeePeriodSummary[];
  feeMonths: FeeMonthSummary[];
}

export async function loadCommunityFinance(): Promise<CommunityFinanceData> {
  const supabase = createServerSupabaseClient();

  const [
    openingRes,
    projectsRes,
    donationsRes,
    expensesRes,
    transfersRes,
    statementsRes,
    feeRes,
  ] = await Promise.all([
    supabase
      .from("opening_balance")
      .select("as_of_date, amount_cents, note")
      .order("as_of_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("fundraising_projects")
      .select("id, slug, title, title_en, short_desc, short_desc_en, goal_cents, is_public, accepts_donations")
      .order("created_at", { ascending: true }),
    supabase
      .from("donations")
      .select(
        "id, project_id, donor_name, donor_first_name, donor_last_name, display_mode, is_anonymous, amount_cents, method, donated_at, donor_message"
      )
      .order("donated_at", { ascending: false }),
    supabase
      .from("project_expenses")
      .select(
        "id, project_id, description, description_en, supplier, amount_cents, expense_date, category, funding_source, payment_method, receipt_ref, note, note_en"
      )
      .order("expense_date", { ascending: false }),
    supabase
      .from("cash_transfers")
      .select("id, transfer_date, direction, amount_cents, note, note_en")
      .order("transfer_date", { ascending: false }),
    supabase
      .from("bank_statements")
      .select("id, period_start, period_end, opening_cents, closing_cents, income_cents, expense_cents, note, note_en, imported_at")
      .order("period_end", { ascending: false }),
    supabase.rpc("get_community_fee_summary"),
  ]);

  const fee = (feeRes.data ?? {}) as {
    by_period?: FeePeriodSummary[];
    by_month?: FeeMonthSummary[];
    error?: string;
  };

  return {
    accessDenied: fee.error === "forbidden",
    openingBalance: (openingRes.data as OpeningBalance | null) ?? null,
    projects: (projectsRes.data ?? []) as FinanceProject[],
    donations: (donationsRes.data ?? []) as FinanceDonation[],
    expenses: (expensesRes.data ?? []) as FinanceExpense[],
    transfers: (transfersRes.data ?? []) as FinanceTransfer[],
    statements: (statementsRes.data ?? []) as BankStatement[],
    feePeriods: fee.by_period ?? [],
    feeMonths: fee.by_month ?? [],
  };
}

/**
 * Nario mokesčių įplaukos DIENOS tikslumu – tik admin'ui (`payments` RLS jam
 * atviras). Grąžinamos vien sumos: nei `member_id`, nei kvito numerio, kad net
 * admin sutikrinimo ekrane nesimėtytų asmens duomenys be reikalo.
 *
 * Reikalinga `/admin/finansai/sutikrinimas` – mėnesio tikslumo nepakanka
 * atsakyti „kurią dieną nesutampa".
 */
export async function loadAdminFeeDays(): Promise<FeeDaySummary[]> {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from("payments")
    .select("paid_date, amount_cents, payment_method")
    .order("paid_date", { ascending: true });

  const byDate = new Map<string, FeeDaySummary>();
  for (const p of data ?? []) {
    const date = p.paid_date as string;
    const row =
      byDate.get(date) ??
      { date, payment_count: 0, total_cents: 0, cash_cents: 0, transfer_cents: 0 };
    const cents = p.amount_cents as number;
    row.payment_count += 1;
    row.total_cents += cents;
    if (p.payment_method === "grynieji") row.cash_cents += cents;
    else row.transfer_cents += cents;
    byDate.set(date, row);
  }

  return Array.from(byDate.values());
}
