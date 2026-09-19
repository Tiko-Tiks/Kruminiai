import { createServerSupabaseClient } from "@/lib/supabase-server";
import { loadDonations } from "@/lib/donations-data";
import type {
  BankStatement,
  FeeDaySummary,
  FeeMonthSummary,
  FeePeriodSummary,
  FeeStatementSummary,
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
 * PRIEIGA: pirma tikrinami vartai (`get_community_fee_summary` grąžina
 * `forbidden` nepatvirtintam vartotojui), ir tik tada kraunami duomenys.
 * Lentelių RLS (migr. 044) praleidžia tik patvirtintą narį arba admin'ą, o
 * nario mokesčių suvestinė eina per SECURITY DEFINER RPC, kuris grąžina TIK
 * agregatus – jokių konkretaus nario mokėjimų (asmens duomenys). `payments`
 * lentelės čia neliečiam sąmoningai.
 *
 * Aukos kraunamos per `src/lib/donations-data.ts` (service-role, serverio
 * pusė): nuo migr. 049 `donations` SELECT RLS'e paliktas tik administratoriui,
 * nes eilutėse guli žali aukotojų vardai.
 *
 * KLAIDOS NETYLIMOS. Anksčiau bet kurios iš septynių užklausų klaida virsdavo
 * tuščiu sąrašu, o iš nepilno rinkinio suskaičiuotas likutis atrodydavo kaip
 * tikras skaičius. Dabar grąžinamas `ok: false`, o puslapiai rodo klaidos
 * būseną – likutis iš dalies duomenų NEskaičiuojamas.
 *
 * Šis modulis NĖRA server action ir neturi „use server" – kitaip kiekviena
 * jo funkcija taptų viešu POST endpoint'u. Mutacijos gyvena
 * `src/actions/finance.ts`.
 */

export interface CommunityFinanceData {
  openingBalance: OpeningBalance | null;
  projects: FinanceProject[];
  donations: FinanceDonation[];
  expenses: FinanceExpense[];
  transfers: FinanceTransfer[];
  statements: BankStatement[];
  feePeriods: FeePeriodSummary[];
  feeMonths: FeeMonthSummary[];
  feeStatements: FeeStatementSummary[];
}

export type CommunityFinanceResult =
  | { ok: true; data: CommunityFinanceData }
  /**
   * `forbidden` – vartotojas nėra patvirtintas narys (RLS jam viską filtruotų).
   * `unavailable` – užklausa nepavyko; duomenų rinkinys nepilnas.
   */
  | { ok: false; reason: "forbidden" | "unavailable"; error: string };

interface FeeSummaryPayload {
  by_period?: FeePeriodSummary[];
  by_month?: FeeMonthSummary[];
  by_statement?: FeeStatementSummary[];
  error?: string;
}

export async function loadCommunityFinance(): Promise<CommunityFinanceResult> {
  const supabase = createServerSupabaseClient();

  // 1) Vartai. Kviečiam pirma, kad nepatvirtintam vartotojui apskritai nieko
  //    nekrautume – ir kad „nėra teisių" nesusiplaktų su „nepavyko užkrauti".
  const feeRes = await supabase.rpc("get_community_fee_summary");
  if (feeRes.error) {
    return { ok: false, reason: "unavailable", error: feeRes.error.message };
  }
  const fee = (feeRes.data ?? {}) as FeeSummaryPayload;
  if (fee.error === "forbidden" || fee.error === "not_approved") {
    return { ok: false, reason: "forbidden", error: fee.error };
  }
  if (fee.error) {
    return { ok: false, reason: "unavailable", error: fee.error };
  }

  // 2) Duomenys.
  const [openingRes, projectsRes, expensesRes, transfersRes, statementsRes, donationsRes] =
    await Promise.all([
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
      loadDonations(),
    ]);

  const failed =
    openingRes.error?.message ??
    projectsRes.error?.message ??
    expensesRes.error?.message ??
    transfersRes.error?.message ??
    statementsRes.error?.message ??
    (donationsRes.ok ? undefined : donationsRes.error);

  if (failed) {
    console.error("[finansai] Nepilnas duomenų rinkinys:", failed);
    return { ok: false, reason: "unavailable", error: failed };
  }

  return {
    ok: true,
    data: {
      openingBalance: (openingRes.data as OpeningBalance | null) ?? null,
      projects: (projectsRes.data ?? []) as FinanceProject[],
      donations: donationsRes.ok ? donationsRes.rows : [],
      expenses: (expensesRes.data ?? []) as FinanceExpense[],
      transfers: (transfersRes.data ?? []) as FinanceTransfer[],
      statements: (statementsRes.data ?? []) as BankStatement[],
      feePeriods: fee.by_period ?? [],
      feeMonths: fee.by_month ?? [],
      feeStatements: fee.by_statement ?? [],
    },
  };
}

/**
 * Nario mokesčių įplaukos DIENOS tikslumu – tik admin'ui (`payments` RLS jam
 * atviras). Grąžinamos vien sumos: nei `member_id`, nei kvito numerio, kad net
 * admin sutikrinimo ekrane nesimėtytų asmens duomenys be reikalo.
 *
 * Reikalinga `/admin/finansai/sutikrinimas` – mėnesio tikslumo nepakanka
 * atsakyti „kurią dieną nesutampa". Klaidos atveju grąžinamas `null`, kad
 * sutikrinimas nebūtų skaičiuojamas iš tuščio rinkinio.
 */
export async function loadAdminFeeDays(): Promise<FeeDaySummary[] | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("payments")
    .select("paid_date, amount_cents, payment_method")
    .order("paid_date", { ascending: true });

  if (error) {
    console.error("[finansai] Nepavyko užkrauti mokėjimų dienų:", error.message);
    return null;
  }

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
