import type { Locale } from "@/lib/i18n";

/**
 * Bendruomenės finansų domeno logika – VIENAS ŠALTINIS likučiams.
 *
 * Naudoja `/finansai` (nariams) ir `/admin/finansai/sutikrinimas`. Skaičiavimo
 * modelis – kasinis (cash accounting) pagal FAKTINĘ operacijos datą:
 *
 *   likutis = pradinis likutis + aukos + nario mokesčiai − išlaidos
 *
 * Kur pinigai fiziškai guli, lemia apmokėjimo būdas, todėl bendra suma dar
 * skyla į banką ir kasą:
 *
 *   banke  = pradinis + negrynos pajamos − negrynos išlaidos + kasa→bankas − bankas→kasa
 *   kasoje = grynos pajamos − grynos išlaidos − kasa→bankas + bankas→kasa
 *
 * SVARBU: pradinis likutis (`opening_balance`) yra atskaitos taškas – sistema
 * neturi ankstesnių metų operacijų. Todėl VISOS operacijos filtruojamos pagal
 * `>= opening_balance.as_of_date`; antraip 2023–2025 m. nario mokesčiai būtų
 * suskaičiuoti du kartus (jie jau įskaičiuoti į pradinį likutį).
 */

// ---------------------------------------------------------------------------
// Tipai
// ---------------------------------------------------------------------------

export type FundingSource =
  | "projekto_lesos"
  | "bendruomenes_fondas"
  | "nario_mokesciai"
  | "savivaldybes_parama"
  | "kita";

export type ExpenseCategory =
  | "projektas"
  | "komunaliniai"
  | "administracija"
  | "renginiai"
  | "kita";

export type TransferDirection = "kasa_i_banka" | "bankas_i_kasa";

export interface OpeningBalance {
  as_of_date: string;
  amount_cents: number;
  note: string | null;
}

export interface FinanceProject {
  id: string;
  slug: string;
  title: string;
  title_en: string | null;
  short_desc: string | null;
  short_desc_en: string | null;
  goal_cents: number;
  is_public: boolean;
  accepts_donations: boolean;
}

export interface FinanceDonation {
  id: string;
  project_id: string | null;
  donor_name: string | null;
  donor_first_name: string | null;
  donor_last_name: string | null;
  display_mode: string | null;
  is_anonymous: boolean | null;
  amount_cents: number;
  method: string;
  donated_at: string;
  donor_message: string | null;
}

export interface FinanceExpense {
  id: string;
  project_id: string | null;
  description: string;
  description_en: string | null;
  supplier: string | null;
  amount_cents: number;
  expense_date: string;
  category: string | null;
  funding_source: FundingSource;
  payment_method: string;
  receipt_ref: string | null;
  note: string | null;
  note_en: string | null;
}

export interface FinanceTransfer {
  id: string;
  transfer_date: string;
  direction: TransferDirection;
  amount_cents: number;
  note: string | null;
  note_en: string | null;
}

export interface BankStatement {
  id: string;
  period_start: string;
  period_end: string;
  opening_cents: number;
  closing_cents: number;
  income_cents: number;
  expense_cents: number;
  note: string | null;
  note_en: string | null;
  imported_at: string | null;
}

/** `get_community_fee_summary()` RPC – agregatai BE asmens duomenų. */
export interface FeePeriodSummary {
  year: number;
  fee_type: string;
  name: string;
  fee_amount_cents: number;
  payer_count: number;
  payment_count: number;
  total_cents: number;
  cash_cents: number;
  transfer_cents: number;
}

export interface FeeMonthSummary {
  month: string; // „YYYY-MM"
  payment_count: number;
  total_cents: number;
  cash_cents: number;
  transfer_cents: number;
}

/**
 * Nario mokesčiai, susumuoti PER VISĄ banko išrašo laikotarpį. Leidžia nariams
 * rodomą sutikrinimą skaičiuoti tiksliai, neatskleidžiant atskirų datų:
 * mėnesio tikslumo pjūvis mokėjimą, atėjusį po išrašo pabaigos tą patį mėnesį,
 * įskaičiuotų ir parodytų netikrą skirtumą.
 */
export interface FeeStatementSummary {
  statement_id: string;
  payment_count: number;
  total_cents: number;
  cash_cents: number;
  transfer_cents: number;
}

/**
 * Nario mokesčiai dienos tikslumu. Nariams tokio pjūvio NEDUODAM – kartu su
 * suma ir data jis leistų atsekti konkretų žmogų. Admin'ui jis prieinamas
 * (RLS jam atveria `payments`) ir būtinas sutikrinimui: skirtumas be datos
 * nepasako, kurioje išrašo eilutėje ieškoti.
 */
export interface FeeDaySummary {
  date: string; // „YYYY-MM-DD"
  payment_count: number;
  total_cents: number;
  cash_cents: number;
  transfer_cents: number;
}

// ---------------------------------------------------------------------------
// Pagalbinės
// ---------------------------------------------------------------------------

/** Auka grynaisiais? `sepa`, `card` ir `other` visi keliauja per sąskaitą. */
export function isCashDonation(method: string): boolean {
  return method === "cash";
}

export function isCashExpense(paymentMethod: string): boolean {
  return paymentMethod === "grynieji";
}

/** Ar operacija patenka į skaičiuojamą laikotarpį (nuo pradinio likučio). */
function onOrAfter(date: string, from: string | null): boolean {
  if (!from) return true;
  return date >= from;
}

const sum = <T,>(rows: T[], pick: (row: T) => number) =>
  rows.reduce((total, row) => total + pick(row), 0);

// ---------------------------------------------------------------------------
// Likučiai
// ---------------------------------------------------------------------------

export interface BalanceInput {
  openingBalance: OpeningBalance | null;
  donations: FinanceDonation[];
  expenses: FinanceExpense[];
  transfers: FinanceTransfer[];
  /** Nario mokesčių įplaukos pagal mėnesį – iš `get_community_fee_summary`. */
  feeMonths: FeeMonthSummary[];
}

export interface Balances {
  asOfDate: string | null;
  openingCents: number;
  donationCents: number;
  donationCashCents: number;
  feeCents: number;
  feeCashCents: number;
  incomeCents: number;
  expenseCents: number;
  expenseCashCents: number;
  toBankCents: number;
  toCashCents: number;
  /** Bendra bendruomenės pinigų suma: bankas + kasa. */
  totalCents: number;
  bankCents: number;
  cashCents: number;
}

export function computeBalances(input: BalanceInput): Balances {
  const from = input.openingBalance?.as_of_date ?? null;
  const openingCents = input.openingBalance?.amount_cents ?? 0;

  const donations = input.donations.filter((d) => onOrAfter(d.donated_at, from));
  const expenses = input.expenses.filter((e) => onOrAfter(e.expense_date, from));
  const transfers = input.transfers.filter((t) => onOrAfter(t.transfer_date, from));
  // `by_month` raktas yra „YYYY-MM", todėl lyginam su pradinio likučio mėnesiu
  const fromMonth = from ? from.slice(0, 7) : null;
  const feeMonths = input.feeMonths.filter((m) => !fromMonth || m.month >= fromMonth);

  const donationCents = sum(donations, (d) => d.amount_cents);
  const donationCashCents = sum(
    donations.filter((d) => isCashDonation(d.method)),
    (d) => d.amount_cents
  );

  const feeCents = sum(feeMonths, (m) => m.total_cents);
  const feeCashCents = sum(feeMonths, (m) => m.cash_cents);

  const expenseCents = sum(expenses, (e) => e.amount_cents);
  const expenseCashCents = sum(
    expenses.filter((e) => isCashExpense(e.payment_method)),
    (e) => e.amount_cents
  );

  const toBankCents = sum(
    transfers.filter((t) => t.direction === "kasa_i_banka"),
    (t) => t.amount_cents
  );
  const toCashCents = sum(
    transfers.filter((t) => t.direction === "bankas_i_kasa"),
    (t) => t.amount_cents
  );

  const incomeCents = donationCents + feeCents;
  const totalCents = openingCents + incomeCents - expenseCents;

  // Pradinis likutis – banko sąskaitos likutis (kasa vedama atskirai)
  const bankCents =
    openingCents +
    (donationCents - donationCashCents) +
    (feeCents - feeCashCents) -
    (expenseCents - expenseCashCents) +
    toBankCents -
    toCashCents;

  const cashCents = donationCashCents + feeCashCents - expenseCashCents - toBankCents + toCashCents;

  return {
    asOfDate: from,
    openingCents,
    donationCents,
    donationCashCents,
    feeCents,
    feeCashCents,
    incomeCents,
    expenseCents,
    expenseCashCents,
    toBankCents,
    toCashCents,
    totalCents,
    bankCents,
    cashCents,
  };
}

// ---------------------------------------------------------------------------
// Lėšų paskirstymas į „kišenes"
// ---------------------------------------------------------------------------

/**
 * Iš kurios „kišenės" apmokėta išlaida.
 *
 * Sprendžia `funding_source`, NE `project_id` – būtent to trūko iki šiol:
 * elektra, apmokėta iš nario mokesčių, neturi mažinti liepto aukų likučio.
 * `bendruomenes-fondas` projektas pats yra nepaskirstytų lėšų kišenė.
 */
export function expenseBucketKey(
  expense: FinanceExpense,
  fundProjectId: string | null
): string {
  if (expense.funding_source === "nario_mokesciai") return FEE_BUDGET_BUCKET;
  if (expense.funding_source === "bendruomenes_fondas") {
    return fundProjectId ?? FEE_BUDGET_BUCKET;
  }
  return expense.project_id ?? FEE_BUDGET_BUCKET;
}

/** Sintetinės kišenės, neturinčios `fundraising_projects` eilutės. */
export const FEE_BUDGET_BUCKET = "__nario_mokesciai__";

export type BucketLineKind = "donation" | "sponsor" | "fee" | "opening" | "expense";

export interface BucketLine {
  key: string;
  label: string;
  labelEn: string | null;
  amountCents: number;
  count: number;
  kind: BucketLineKind;
}

export interface FinanceBucket {
  key: string;
  slug: string | null;
  title: string;
  titleEn: string | null;
  goalCents: number;
  isPublic: boolean;
  /** Sintetinė kišenė (nario mokesčių biudžetas) neturi projekto puslapio. */
  isSynthetic: boolean;
  receivedCents: number;
  spentCents: number;
  remainingCents: number;
  /** Kiek dar trūksta iki tikslo (0, jei tikslo nėra arba pasiektas). */
  stillNeededCents: number;
  incomeLines: BucketLine[];
  expenseLines: BucketLine[];
  donations: FinanceDonation[];
  expenses: FinanceExpense[];
}

/** Iki kiek eilučių kortelėje rodom detaliai, o ne sugrupuotai. */
const DETAIL_LINE_LIMIT = 4;

export interface BucketInput extends BalanceInput {
  projects: FinanceProject[];
  locale: Locale;
}

/**
 * Sudėlioja korteles: po vieną kiekvienam projektui + nario mokesčių biudžetas.
 *
 * Invariantas: visų kortelių `remainingCents` suma == `computeBalances().totalCents`.
 * Jei nesutampa – duomenyse yra išlaida, kurios šaltinis rodo į neegzistuojantį
 * projektą; puslapis tokį likutį parodo atskira „nepaskirstyta" eilute.
 */
export function buildBuckets(input: BucketInput): FinanceBucket[] {
  const from = input.openingBalance?.as_of_date ?? null;
  const fromMonth = from ? from.slice(0, 7) : null;

  const donations = input.donations.filter((d) => onOrAfter(d.donated_at, from));
  const expenses = input.expenses.filter((e) => onOrAfter(e.expense_date, from));
  const feeMonths = input.feeMonths.filter((m) => !fromMonth || m.month >= fromMonth);

  const fundProject = input.projects.find((p) => p.slug === "bendruomenes-fondas") ?? null;

  const donationsByBucket = new Map<string, FinanceDonation[]>();
  for (const d of donations) {
    const key = d.project_id ?? FEE_BUDGET_BUCKET;
    const list = donationsByBucket.get(key) ?? [];
    list.push(d);
    donationsByBucket.set(key, list);
  }

  const expensesByBucket = new Map<string, FinanceExpense[]>();
  for (const e of expenses) {
    const key = expenseBucketKey(e, fundProject?.id ?? null);
    const list = expensesByBucket.get(key) ?? [];
    list.push(e);
    expensesByBucket.set(key, list);
  }

  const buckets: FinanceBucket[] = input.projects.map((project) => {
    const own = donationsByBucket.get(project.id) ?? [];
    const spent = expensesByBucket.get(project.id) ?? [];
    return makeBucket({
      key: project.id,
      slug: project.slug,
      title: project.title,
      titleEn: project.title_en,
      goalCents: project.goal_cents,
      isPublic: project.is_public,
      isSynthetic: false,
      donations: own,
      expenses: spent,
      extraIncomeLines: [],
      extraIncomeCents: 0,
    });
  });

  // Nario mokesčių biudžetas – ne projektas, bet turi savo pajamas
  // (mokesčiai + pradinis likutis) ir savo išlaidas.
  const feeTotal = sum(feeMonths, (m) => m.total_cents);
  const feeCount = sum(feeMonths, (m) => m.payment_count);
  const openingCents = input.openingBalance?.amount_cents ?? 0;

  const feeLines: BucketLine[] = [];
  if (openingCents !== 0) {
    feeLines.push({
      key: "opening",
      label: "Likutis laikotarpio pradžioje",
      labelEn: "Balance at the start of the period",
      amountCents: openingCents,
      count: 0,
      kind: "opening",
    });
  }
  if (feeTotal !== 0) {
    feeLines.push({
      key: "fees",
      label: "Nario ir stojamieji mokesčiai",
      labelEn: "Membership and joining fees",
      amountCents: feeTotal,
      count: feeCount,
      kind: "fee",
    });
  }

  buckets.push(
    makeBucket({
      key: FEE_BUDGET_BUCKET,
      slug: null,
      title: "Nario mokesčių biudžetas",
      titleEn: "Membership fee budget",
      goalCents: 0,
      isPublic: false,
      isSynthetic: true,
      donations: donationsByBucket.get(FEE_BUDGET_BUCKET) ?? [],
      expenses: expensesByBucket.get(FEE_BUDGET_BUCKET) ?? [],
      extraIncomeLines: feeLines,
      extraIncomeCents: openingCents + feeTotal,
    })
  );

  // Tuščios kortelės (nei pajamų, nei išlaidų) nieko nepasako – nerodom
  return buckets
    .filter((b) => b.receivedCents !== 0 || b.spentCents !== 0)
    .sort((a, b) => b.remainingCents - a.remainingCents);
}

function makeBucket(args: {
  key: string;
  slug: string | null;
  title: string;
  titleEn: string | null;
  goalCents: number;
  isPublic: boolean;
  isSynthetic: boolean;
  donations: FinanceDonation[];
  expenses: FinanceExpense[];
  extraIncomeLines: BucketLine[];
  extraIncomeCents: number;
}): FinanceBucket {
  const donationCents = sum(args.donations, (d) => d.amount_cents);
  const receivedCents = donationCents + args.extraIncomeCents;
  const spentCents = sum(args.expenses, (e) => e.amount_cents);
  const remainingCents = receivedCents - spentCents;

  return {
    key: args.key,
    slug: args.slug,
    title: args.title,
    titleEn: args.titleEn,
    goalCents: args.goalCents,
    isPublic: args.isPublic,
    isSynthetic: args.isSynthetic,
    receivedCents,
    spentCents,
    remainingCents,
    stillNeededCents: args.goalCents > 0 ? Math.max(0, args.goalCents - receivedCents) : 0,
    incomeLines: [...args.extraIncomeLines, ...donationLines(args.donations)],
    expenseLines: expenseLines(args.expenses),
    donations: [...args.donations].sort((a, b) => b.donated_at.localeCompare(a.donated_at)),
    expenses: [...args.expenses].sort((a, b) => b.expense_date.localeCompare(a.expense_date)),
  };
}

/**
 * Pajamų eilutės kortelėje. Kol aukų nedaug – vardinis sąrašas; kai daug –
 * dvi grupės: bendruomenės narių aukos ir rėmėjų/institucijų parama
 * (`display_mode = 'full'` praktiškai ir reiškia juridinį asmenį ar rėmėją,
 * davusį sutikimą viešinti vardą).
 */
function donationLines(donations: FinanceDonation[]): BucketLine[] {
  if (donations.length === 0) return [];

  if (donations.length <= DETAIL_LINE_LIMIT) {
    return donations.map((d) => ({
      key: d.id,
      // Vardas per kaukę uždedamas UI sluoksnyje – čia tik nuoroda į įrašą
      label: "",
      labelEn: null,
      amountCents: d.amount_cents,
      count: 1,
      kind: (d.display_mode === "full" ? "sponsor" : "donation") as BucketLineKind,
    }));
  }

  const sponsors = donations.filter((d) => d.display_mode === "full");
  const people = donations.filter((d) => d.display_mode !== "full");

  const lines: BucketLine[] = [];
  if (people.length > 0) {
    lines.push({
      key: "people",
      label: "Bendruomenės narių ir svečių aukos",
      labelEn: "Donations from members and guests",
      amountCents: sum(people, (d) => d.amount_cents),
      count: people.length,
      kind: "donation",
    });
  }
  if (sponsors.length > 0) {
    lines.push({
      key: "sponsors",
      label: "Rėmėjų ir institucijų parama",
      labelEn: "Support from sponsors and institutions",
      amountCents: sum(sponsors, (d) => d.amount_cents),
      count: sponsors.length,
      kind: "sponsor",
    });
  }
  return lines;
}

/** Išlaidų eilutės: kol jų nedaug – kiekviena atskirai, vėliau – pagal kategoriją. */
function expenseLines(expenses: FinanceExpense[]): BucketLine[] {
  if (expenses.length === 0) return [];

  if (expenses.length <= DETAIL_LINE_LIMIT) {
    return expenses
      .map((e) => ({
        key: e.id,
        label: e.description,
        labelEn: e.description_en,
        amountCents: e.amount_cents,
        count: 1,
        kind: "expense" as BucketLineKind,
      }))
      .sort((a, b) => b.amountCents - a.amountCents);
  }

  const byCategory = new Map<string, { amountCents: number; count: number }>();
  for (const e of expenses) {
    const key = e.category ?? "kita";
    const cur = byCategory.get(key) ?? { amountCents: 0, count: 0 };
    cur.amountCents += e.amount_cents;
    cur.count += 1;
    byCategory.set(key, cur);
  }

  return Array.from(byCategory.entries())
    .map(([key, v]) => ({
      key,
      // Kategorijos etiketė verčiama UI sluoksnyje (i18n)
      label: "",
      labelEn: null,
      amountCents: v.amountCents,
      count: v.count,
      kind: "expense" as BucketLineKind,
    }))
    .sort((a, b) => b.amountCents - a.amountCents);
}

// ---------------------------------------------------------------------------
// Sutikrinimas su banku
// ---------------------------------------------------------------------------

export interface Reconciliation {
  statement: BankStatement | null;
  /** Sistemos banko likutis paskutinę išrašo dieną. */
  systemBankCents: number;
  statementClosingCents: number;
  differenceCents: number;
  systemIncomeCents: number;
  systemExpenseCents: number;
  incomeDifferenceCents: number;
  expenseDifferenceCents: number;
  cashCents: number;
  isBalanced: boolean;
}

export interface ReconciliationInput extends BalanceInput {
  statement: BankStatement | null;
  /** Admin'o pjūvis dienos tikslumu; jei yra, naudojamas pirmiausia. */
  feeDays?: FeeDaySummary[];
  /** Nario pjūvis pagal išrašą – tikslus, bet be datų. */
  feeStatements?: FeeStatementSummary[];
}

/**
 * Sulygina sistemos banko judėjimą su rankiniu būdu suvestu banko išrašu.
 *
 * Skaičiuojama TIK banko pusė: grynieji per sąskaitą neina, todėl kasos
 * operacijos iš abiejų pusių išimamos, o kasa↔bankas pervedimai – įtraukiami
 * (jie sąskaitoje matomi).
 */
export function reconcile(input: ReconciliationInput): Reconciliation {
  const statement = input.statement;
  const periodStart = statement?.period_start ?? input.openingBalance?.as_of_date ?? null;
  const periodEnd = statement?.period_end ?? null;

  const inPeriod = (date: string) =>
    (!periodStart || date >= periodStart) && (!periodEnd || date <= periodEnd);

  const donations = input.donations.filter(
    (d) => inPeriod(d.donated_at) && !isCashDonation(d.method)
  );
  const expenses = input.expenses.filter(
    (e) => inPeriod(e.expense_date) && !isCashExpense(e.payment_method)
  );
  const transfers = input.transfers.filter((t) => inPeriod(t.transfer_date));

  // Tikslumo eiliškumas: dienos pjūvis (admin) → išrašo pjūvis (nariams,
  // irgi tikslus) → mėnesio pjūvis (paskutinė išeitis, jei išrašo dar nėra).
  const statementFees =
    statement && input.feeStatements
      ? input.feeStatements.find((f) => f.statement_id === statement.id)
      : undefined;

  const feeRows: { transfer_cents: number }[] = input.feeDays
    ? input.feeDays.filter((d) => inPeriod(d.date))
    : statementFees
      ? [statementFees]
      : input.feeMonths.filter((m) => {
          const startMonth = periodStart ? periodStart.slice(0, 7) : null;
          const endMonth = periodEnd ? periodEnd.slice(0, 7) : null;
          return (!startMonth || m.month >= startMonth) && (!endMonth || m.month <= endMonth);
        });

  const systemIncomeCents =
    sum(donations, (d) => d.amount_cents) +
    sum(feeRows, (m) => m.transfer_cents) +
    sum(
      transfers.filter((t) => t.direction === "kasa_i_banka"),
      (t) => t.amount_cents
    );

  const systemExpenseCents =
    sum(expenses, (e) => e.amount_cents) +
    sum(
      transfers.filter((t) => t.direction === "bankas_i_kasa"),
      (t) => t.amount_cents
    );

  const openingCents = statement?.opening_cents ?? input.openingBalance?.amount_cents ?? 0;
  const systemBankCents = openingCents + systemIncomeCents - systemExpenseCents;
  const statementClosingCents = statement?.closing_cents ?? systemBankCents;

  const balances = computeBalances(input);

  return {
    statement,
    systemBankCents,
    statementClosingCents,
    differenceCents: systemBankCents - statementClosingCents,
    systemIncomeCents,
    systemExpenseCents,
    incomeDifferenceCents: statement ? systemIncomeCents - statement.income_cents : 0,
    expenseDifferenceCents: statement ? systemExpenseCents - statement.expense_cents : 0,
    cashCents: balances.cashCents,
    isBalanced: statement ? systemBankCents - statement.closing_cents === 0 : true,
  };
}

/**
 * Dienos pjūvis sutikrinimui: kurią dieną banko judėjimas nesutampa.
 * Rankiniu būdu būtent šito ieškojimo ir užtrukdavo valandos.
 */
export interface DailyBankRow {
  date: string;
  incomeCents: number;
  expenseCents: number;
  runningCents: number;
  items: { label: string; amountCents: number; kind: "income" | "expense" }[];
}

export function dailyBankBreakdown(input: ReconciliationInput): DailyBankRow[] {
  const statement = input.statement;
  const periodStart = statement?.period_start ?? input.openingBalance?.as_of_date ?? null;
  const periodEnd = statement?.period_end ?? null;
  const inPeriod = (date: string) =>
    (!periodStart || date >= periodStart) && (!periodEnd || date <= periodEnd);

  const byDate = new Map<string, DailyBankRow>();
  const row = (date: string): DailyBankRow => {
    const existing = byDate.get(date);
    if (existing) return existing;
    const created: DailyBankRow = {
      date,
      incomeCents: 0,
      expenseCents: 0,
      runningCents: 0,
      items: [],
    };
    byDate.set(date, created);
    return created;
  };

  for (const d of input.donations) {
    if (!inPeriod(d.donated_at) || isCashDonation(d.method)) continue;
    const r = row(d.donated_at);
    r.incomeCents += d.amount_cents;
    r.items.push({ label: d.donor_name || "—", amountCents: d.amount_cents, kind: "income" });
  }

  for (const e of input.expenses) {
    if (!inPeriod(e.expense_date) || isCashExpense(e.payment_method)) continue;
    const r = row(e.expense_date);
    r.expenseCents += e.amount_cents;
    r.items.push({ label: e.description, amountCents: e.amount_cents, kind: "expense" });
  }

  for (const t of input.transfers) {
    if (!inPeriod(t.transfer_date)) continue;
    const r = row(t.transfer_date);
    if (t.direction === "kasa_i_banka") {
      r.incomeCents += t.amount_cents;
      r.items.push({ label: t.note || "", amountCents: t.amount_cents, kind: "income" });
    } else {
      r.expenseCents += t.amount_cents;
      r.items.push({ label: t.note || "", amountCents: t.amount_cents, kind: "expense" });
    }
  }

  if (input.feeDays) {
    // Admin'o pjūvis – tikslios datos, todėl eilutė krenta į savo dieną
    for (const d of input.feeDays) {
      if (!inPeriod(d.date) || d.transfer_cents === 0) continue;
      const r = row(d.date);
      r.incomeCents += d.transfer_cents;
      r.items.push({ label: "", amountCents: d.transfer_cents, kind: "income" });
    }
  } else {
    // Be jo mokesčiai turimi tik mėnesio tikslumu (RPC datų neatiduoda – PII),
    // todėl priskiriami mėnesio pirmai dienai.
    const startMonth = periodStart ? periodStart.slice(0, 7) : null;
    const endMonth = periodEnd ? periodEnd.slice(0, 7) : null;
    for (const m of input.feeMonths) {
      if (startMonth && m.month < startMonth) continue;
      if (endMonth && m.month > endMonth) continue;
      if (m.transfer_cents === 0) continue;
      const r = row(`${m.month}-01`);
      r.incomeCents += m.transfer_cents;
      r.items.push({ label: "", amountCents: m.transfer_cents, kind: "income" });
    }
  }

  const rows = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  let running = statement?.opening_cents ?? input.openingBalance?.amount_cents ?? 0;
  for (const r of rows) {
    running += r.incomeCents - r.expenseCents;
    r.runningCents = running;
  }
  return rows;
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/** RFC 4180 laukas: kabutės dvigubinamos, laukas kabutėse, jei reikia. */
function csvCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * CSV su BOM – be jo Excel lietuviškas raides atidaro kaip šiukšles.
 * Skaitmenys eksportuojami eurais su tašku (ne centais) – tai failas žmogui.
 */
export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const body = [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  return `﻿${body}\r\n`;
}

export function centsToCsvAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}
