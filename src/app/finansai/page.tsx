import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { getDict, getLocale } from "@/lib/i18n-server";
import { loadCommunityFinance } from "@/lib/finance-data";
import { formatDonorName } from "@/lib/donor-name";
import {
  buildBuckets,
  computeBalances,
  reconcile,
  type FinanceBucket,
  type FinanceProject,
} from "@/lib/finance";
import { FinanceDashboard } from "./FinanceDashboard";
import type {
  BucketView,
  DonationRow,
  ExpenseRow,
  FeeRow,
  TransferRow,
} from "./types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Bendruomenės finansai",
  // Puslapis skirtas tik prisijungusiems nariams – iš paieškos jį laikom lauke
  robots: { index: false, follow: false, nocache: true },
};

/** Projekto pavadinimas pagal aktyvią kalbą, su LT fallback'u. */
function projectTitle(project: FinanceProject | undefined, locale: "lt" | "en"): string {
  if (!project) return "";
  return (locale === "en" && project.title_en) || project.title;
}

export default async function FinansaiPage() {
  const locale = getLocale();
  const t = getDict().finance;
  const data = await loadCommunityFinance();

  // Antras apsaugos sluoksnis po middleware: jei RLS duomenų neatidavė,
  // rodom aiškią žinutę, o ne suklastotus nulius.
  if (data.accessDenied) {
    return (
      <div className="min-h-screen flex flex-col bg-amber-50/50">
        <PublicHeader />
        <main className="flex-1">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16">
            <h1 className="text-2xl font-bold text-green-800 mb-2">{t.pageHeading}</h1>
            <p className="text-gray-600">{getDict().auth.errNotApproved}</p>
          </div>
        </main>
        <PublicFooter />
      </div>
    );
  }

  const balanceInput = {
    openingBalance: data.openingBalance,
    donations: data.donations,
    expenses: data.expenses,
    transfers: data.transfers,
    feeMonths: data.feeMonths,
  };

  const balances = computeBalances(balanceInput);
  const buckets = buildBuckets({ ...balanceInput, projects: data.projects, locale });
  // `feeStatements` – tikslios mokesčių sumos išrašo laikotarpiui. Be jų
  // sutikrinimas skaičiuotų mėnesio tikslumu ir mokėjimas, atėjęs po išrašo
  // pabaigos, nariui parodytų netikrą neatitikimą.
  const recon = reconcile({
    ...balanceInput,
    statement: data.statements[0] ?? null,
    feeStatements: data.feeStatements,
  });

  const projectsById = new Map(data.projects.map((p) => [p.id, p]));

  // ---------------------------------------------------------------------------
  // Vaizdo modeliai. Aukotojų vardai per kaukę uždedami ČIA, serveryje – į
  // naršyklę pilnas `donor_name` net nenukeliauja (žr. src/lib/donor-name.ts).
  //
  // Auditorija – `members`: šis puslapis yra už middleware, jį mato tik
  // prisijungę PATVIRTINTI nariai, todėl rodom vardą ir pavardės raidę
  // („Vaida K."). Viešuose projektų puslapiuose lieka tik inicialai.
  // ---------------------------------------------------------------------------

  const donationRows: DonationRow[] = data.donations.map((d) => ({
    id: d.id,
    date: d.donated_at,
    donor: formatDonorName(d, locale, "members"),
    amountCents: d.amount_cents,
    projectId: d.project_id,
    projectTitle: projectTitle(projectsById.get(d.project_id ?? ""), locale),
    method: d.method,
    methodLabel: t.methods[d.method] ?? d.method,
    message: d.donor_message,
  }));

  const expenseRows: ExpenseRow[] = data.expenses.map((e) => ({
    id: e.id,
    date: e.expense_date,
    description: (locale === "en" && e.description_en) || e.description,
    supplier: e.supplier,
    amountCents: e.amount_cents,
    category: e.category,
    categoryLabel: e.category ? t.categories[e.category] ?? e.category : null,
    fundingSource: e.funding_source,
    fundingSourceLabel: t.fundingSources[e.funding_source] ?? e.funding_source,
    paymentMethod: e.payment_method,
    paymentMethodLabel: t.expensePaidFrom[e.payment_method] ?? e.payment_method,
    projectId: e.project_id,
    projectTitle: projectTitle(projectsById.get(e.project_id ?? ""), locale),
    receiptRef: e.receipt_ref,
  }));

  const transferRows: TransferRow[] = data.transfers.map((tr) => ({
    id: tr.id,
    date: tr.transfer_date,
    direction: tr.direction,
    directionLabel: t.directions[tr.direction] ?? tr.direction,
    amountCents: tr.amount_cents,
    note: ((locale === "en" && tr.note_en) || tr.note) ?? null,
  }));

  const feeRows: FeeRow[] = data.feePeriods.map((f) => ({
    year: f.year,
    feeType: f.fee_type,
    feeTypeLabel: t.feeTypes[f.fee_type] ?? f.fee_type,
    payerCount: f.payer_count,
    totalCents: f.total_cents,
    cashCents: f.cash_cents,
    transferCents: f.transfer_cents,
  }));

  const bucketViews: BucketView[] = buckets.map((bucket) => toBucketView(bucket, t, locale));

  // Kortelių likučių suma turi lygiuotis bendrai sumai. Jei ne – duomenyse yra
  // išlaida, kurios šaltinis rodo į neegzistuojantį projektą; tokį likutį
  // parodom atskirai, o ne tyliai pametam.
  const allocatedCents = buckets.reduce((s, b) => s + b.remainingCents, 0);
  const unallocatedCents = balances.totalCents - allocatedCents;

  // Nario mokesčių panaudojimas (§3.5) – kam iškeliavo mokesčių biudžetas
  const feeSpending = expenseRows
    .filter((e) => e.fundingSource === "nario_mokesciai")
    .reduce<Record<string, { label: string; amountCents: number; count: number }>>((acc, e) => {
      const key = e.category ?? "kita";
      const entry = acc[key] ?? {
        label: t.categories[key] ?? key,
        amountCents: 0,
        count: 0,
      };
      entry.amountCents += e.amountCents;
      entry.count += 1;
      acc[key] = entry;
      return acc;
    }, {});

  return (
    <div className="min-h-screen flex flex-col bg-amber-50/50">
      <PublicHeader />

      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-12">
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-green-800">{t.pageHeading}</h1>
            <p className="text-gray-500 mt-2 max-w-3xl">{t.pageIntro}</p>
          </div>

          <FinanceDashboard
            locale={locale}
            balances={{
              totalCents: balances.totalCents,
              bankCents: balances.bankCents,
              cashCents: balances.cashCents,
              asOfDate: balances.asOfDate,
            }}
            buckets={bucketViews}
            unallocatedCents={unallocatedCents}
            reconciliation={{
              hasStatement: Boolean(recon.statement),
              systemBankCents: recon.systemBankCents,
              statementClosingCents: recon.statementClosingCents,
              cashCents: recon.cashCents,
              differenceCents: recon.differenceCents,
              periodStart: recon.statement?.period_start ?? null,
              periodEnd: recon.statement?.period_end ?? null,
            }}
            donations={donationRows}
            expenses={expenseRows}
            transfers={transferRows}
            fees={feeRows}
            feeSpending={Object.values(feeSpending).sort((a, b) => b.amountCents - a.amountCents)}
            projectOptions={data.projects.map((p) => ({
              id: p.id,
              title: projectTitle(p, locale),
            }))}
          />
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

type FinanceDict = ReturnType<typeof getDict>["finance"];

/** Domeno kortelė → vaizdo modelis: etiketės išverstos, vardai užmaskuoti. */
function toBucketView(bucket: FinanceBucket, t: FinanceDict, locale: "lt" | "en"): BucketView {
  const title = (locale === "en" && bucket.titleEn) || bucket.title;

  const donationById = new Map(bucket.donations.map((d) => [d.id, d]));
  const expenseById = new Map(bucket.expenses.map((e) => [e.id, e]));

  return {
    key: bucket.key,
    slug: bucket.slug,
    title,
    // Bendrai kišenei paaiškinam, kas joje guli – kitaip nesimato, kad nario
    // mokesčiai yra būtent čia.
    subtitle: bucket.isGeneralPot ? t.generalPotDesc : null,
    goalCents: bucket.goalCents,
    isPublic: bucket.isPublic,
    isGeneralPot: bucket.isGeneralPot,
    receivedCents: bucket.receivedCents,
    spentCents: bucket.spentCents,
    remainingCents: bucket.remainingCents,
    stillNeededCents: bucket.stillNeededCents,
    incomeLines: bucket.incomeLines.map((line) => {
      const donation = donationById.get(line.key);
      const label = donation
        ? formatDonorName(donation, locale, "members")
        : line.kind === "opening"
          ? t.openingBalanceLine
          : line.kind === "fee"
            ? t.feesLine
            : line.key === "sponsors"
              ? t.sponsorDonationsLine
              : line.key === "people"
                ? t.memberDonationsLine
                : ((locale === "en" && line.labelEn) || line.label);
      return { key: line.key, label, amountCents: line.amountCents, count: line.count };
    }),
    expenseLines: bucket.expenseLines.map((line) => {
      const expense = expenseById.get(line.key);
      const label = expense
        ? (locale === "en" && expense.description_en) || expense.description
        : t.categories[line.key] ?? ((locale === "en" && line.labelEn) || line.label || line.key);
      return { key: line.key, label, amountCents: line.amountCents, count: line.count };
    }),
  };
}
