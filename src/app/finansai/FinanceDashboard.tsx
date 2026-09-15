"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeftRight,
  Banknote,
  CheckCircle2,
  ChevronDown,
  Download,
  Landmark,
  PiggyBank,
  Receipt,
  Wallet,
} from "lucide-react";
import { useLocale, useT } from "@/components/i18n/LocaleProvider";
import { formatDate, formatMoney } from "@/lib/utils";
import { centsToCsvAmount, toCsv } from "@/lib/finance";
import type {
  BalancesView,
  BucketView,
  DonationRow,
  ExpenseRow,
  FeeRow,
  FeeSpendingRow,
  ProjectOption,
  ReconciliationView,
  TransferRow,
} from "./types";

type TabKey = "donations" | "expenses" | "fees" | "transfers";

interface Props {
  locale: "lt" | "en";
  balances: BalancesView;
  buckets: BucketView[];
  unallocatedCents: number;
  reconciliation: ReconciliationView;
  donations: DonationRow[];
  expenses: ExpenseRow[];
  transfers: TransferRow[];
  fees: FeeRow[];
  feeSpending: FeeSpendingRow[];
  projectOptions: ProjectOption[];
}

/** Bendras filtrų rinkinys abiem sąrašams – tušti laukai reiškia „visi". */
interface Filters {
  project: string;
  method: string;
  category: string;
  fundingSource: string;
  from: string;
  to: string;
  sort: "date_desc" | "date_asc" | "amount_desc" | "amount_asc";
}

const EMPTY_FILTERS: Filters = {
  project: "",
  method: "",
  category: "",
  fundingSource: "",
  from: "",
  to: "",
  sort: "date_desc",
};

/** „Bendros (be projekto)" – atskira reikšmė, nes `project_id` yra NULL. */
const GENERAL_PROJECT = "__general__";

export function FinanceDashboard(props: Props) {
  const t = useT().finance;
  const locale = useLocale();
  const money = (cents: number) => formatMoney(cents, locale);

  const [tab, setTab] = useState<TabKey>("donations");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

  const inRange = (date: string) =>
    (!filters.from || date >= filters.from) && (!filters.to || date <= filters.to);

  const matchesProject = (projectId: string | null) => {
    if (!filters.project) return true;
    if (filters.project === GENERAL_PROJECT) return projectId === null;
    return projectId === filters.project;
  };

  const sortRows = <T extends { date: string; amountCents: number }>(rows: T[]): T[] => {
    const sorted = [...rows];
    switch (filters.sort) {
      case "date_asc":
        return sorted.sort((a, b) => a.date.localeCompare(b.date));
      case "amount_desc":
        return sorted.sort((a, b) => b.amountCents - a.amountCents);
      case "amount_asc":
        return sorted.sort((a, b) => a.amountCents - b.amountCents);
      default:
        return sorted.sort((a, b) => b.date.localeCompare(a.date));
    }
  };

  const visibleDonations = useMemo(
    () =>
      sortRows(
        props.donations.filter(
          (d) =>
            inRange(d.date) &&
            matchesProject(d.projectId) &&
            (!filters.method || d.method === filters.method)
        )
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.donations, filters]
  );

  const visibleExpenses = useMemo(
    () =>
      sortRows(
        props.expenses.filter(
          (e) =>
            inRange(e.date) &&
            matchesProject(e.projectId) &&
            (!filters.category || (e.category ?? "kita") === filters.category) &&
            (!filters.fundingSource || e.fundingSource === filters.fundingSource)
        )
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.expenses, filters]
  );

  const visibleTransfers = useMemo(
    () => sortRows(props.transfers.filter((tr) => inRange(tr.date))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.transfers, filters]
  );

  const donationSum = visibleDonations.reduce((s, d) => s + d.amountCents, 0);
  const expenseSum = visibleExpenses.reduce((s, e) => s + e.amountCents, 0);

  const projectSelectOptions = [
    { value: "", label: t.optionAll },
    ...props.projectOptions.map((p) => ({ value: p.id, label: p.title })),
    { value: GENERAL_PROJECT, label: t.optionGeneral },
  ];

  const hasActiveFilters =
    filters.project !== "" ||
    filters.method !== "" ||
    filters.category !== "" ||
    filters.fundingSource !== "" ||
    filters.from !== "" ||
    filters.to !== "";

  return (
    <div className="space-y-8">
      <SummaryBlock {...props} money={money} t={t} />

      <ReconciliationCard recon={props.reconciliation} money={money} t={t} />

      {/* ------------------------------------------------------------------ */}
      {/* Sąrašai                                                             */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <div className="flex flex-wrap gap-1 border-b border-gray-200 mb-4">
          <TabButton active={tab === "donations"} onClick={() => setTab("donations")}>
            {t.donationsTitle}
          </TabButton>
          <TabButton active={tab === "expenses"} onClick={() => setTab("expenses")}>
            {t.expensesTitle}
          </TabButton>
          <TabButton active={tab === "fees"} onClick={() => setTab("fees")}>
            {t.feesTitle}
          </TabButton>
          <TabButton active={tab === "transfers"} onClick={() => setTab("transfers")}>
            {t.transfersTitle}
          </TabButton>
        </div>

        {(tab === "donations" || tab === "expenses" || tab === "transfers") && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {tab !== "transfers" && (
                <FilterSelect
                  label={t.filterProject}
                  value={filters.project}
                  onChange={(v) => setFilter("project", v)}
                  options={projectSelectOptions}
                />
              )}

              {tab === "donations" && (
                <FilterSelect
                  label={t.filterMethod}
                  value={filters.method}
                  onChange={(v) => setFilter("method", v)}
                  options={[
                    { value: "", label: t.optionAll },
                    ...Object.entries(t.methods).map(([value, label]) => ({ value, label })),
                  ]}
                />
              )}

              {tab === "expenses" && (
                <>
                  <FilterSelect
                    label={t.filterCategory}
                    value={filters.category}
                    onChange={(v) => setFilter("category", v)}
                    options={[
                      { value: "", label: t.optionAll },
                      ...Object.entries(t.categories).map(([value, label]) => ({ value, label })),
                    ]}
                  />
                  <FilterSelect
                    label={t.filterFundingSource}
                    value={filters.fundingSource}
                    onChange={(v) => setFilter("fundingSource", v)}
                    options={[
                      { value: "", label: t.optionAll },
                      ...Object.entries(t.fundingSources).map(([value, label]) => ({
                        value,
                        label,
                      })),
                    ]}
                  />
                </>
              )}

              <div className="grid grid-cols-2 gap-2">
                <FilterDate
                  label={t.filterFrom}
                  value={filters.from}
                  onChange={(v) => setFilter("from", v)}
                />
                <FilterDate
                  label={t.filterTo}
                  value={filters.to}
                  onChange={(v) => setFilter("to", v)}
                />
              </div>

              <FilterSelect
                label={t.sortLabel}
                value={filters.sort}
                onChange={(v) => setFilter("sort", v as Filters["sort"])}
                options={[
                  { value: "date_desc", label: t.sortDateDesc },
                  { value: "date_asc", label: t.sortDateAsc },
                  { value: "amount_desc", label: t.sortAmountDesc },
                  { value: "amount_asc", label: t.sortAmountAsc },
                ]}
              />
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="mt-3 text-xs text-green-700 hover:text-green-800 hover:underline"
              >
                {t.resetFilters}
              </button>
            )}
          </div>
        )}

        {tab === "donations" && (
          <ListCard
            title={t.donationsTitle}
            subtitle={t.donationsSubtitle}
            countLabel={t.rowsShown
              .replace("{count}", String(visibleDonations.length))
              .replace("{sum}", money(donationSum))}
            onExport={() =>
              downloadCsv(
                "bendruomenes-aukos.csv",
                toCsv(
                  [t.colDate, t.colDonor, t.colAmount, t.colProject, t.colMethod, t.colMessage],
                  visibleDonations.map((d) => [
                    d.date,
                    d.donor,
                    centsToCsvAmount(d.amountCents),
                    d.projectTitle,
                    d.methodLabel,
                    d.message ?? "",
                  ])
                )
              )
            }
            exportLabel={t.exportDonations}
            exportHint={t.exportHint}
            empty={visibleDonations.length === 0 ? t.noRows : null}
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-100">
                  <Th>{t.colDate}</Th>
                  <Th>{t.colDonor}</Th>
                  <Th className="hidden sm:table-cell">{t.colProject}</Th>
                  <Th className="hidden md:table-cell">{t.colMethod}</Th>
                  <Th className="text-right">{t.colAmount}</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {visibleDonations.map((d) => (
                  <tr key={d.id} className="hover:bg-amber-50/40">
                    <Td className="whitespace-nowrap text-gray-500">{formatDate(d.date)}</Td>
                    <Td>
                      <span className="font-medium text-gray-900">{d.donor}</span>
                      {d.message && (
                        <span className="block text-xs text-gray-500 italic">
                          &bdquo;{d.message}&ldquo;
                        </span>
                      )}
                    </Td>
                    <Td className="hidden sm:table-cell text-gray-600">{d.projectTitle}</Td>
                    <Td className="hidden md:table-cell text-gray-600">{d.methodLabel}</Td>
                    <Td className="text-right font-semibold text-green-700 whitespace-nowrap">
                      {money(d.amountCents)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ListCard>
        )}

        {tab === "expenses" && (
          <ListCard
            title={t.expensesTitle}
            subtitle={t.expensesSubtitle}
            countLabel={t.rowsShown
              .replace("{count}", String(visibleExpenses.length))
              .replace("{sum}", money(expenseSum))}
            onExport={() =>
              downloadCsv(
                "bendruomenes-islaidos.csv",
                toCsv(
                  [
                    t.colDate,
                    t.colDescription,
                    t.colSupplier,
                    t.colAmount,
                    t.colCategory,
                    t.colProject,
                    t.colFundingSource,
                    t.colReceipt,
                  ],
                  visibleExpenses.map((e) => [
                    e.date,
                    e.description,
                    e.supplier ?? "",
                    centsToCsvAmount(e.amountCents),
                    e.categoryLabel ?? "",
                    e.projectTitle,
                    e.fundingSourceLabel,
                    e.receiptRef ?? "",
                  ])
                )
              )
            }
            exportLabel={t.exportExpenses}
            exportHint={t.exportHint}
            empty={visibleExpenses.length === 0 ? t.noRows : null}
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-100">
                  <Th>{t.colDate}</Th>
                  <Th>{t.colDescription}</Th>
                  <Th className="hidden lg:table-cell">{t.colCategory}</Th>
                  <Th>{t.colFundingSource}</Th>
                  <Th className="text-right">{t.colAmount}</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {visibleExpenses.map((e) => (
                  <tr key={e.id} className="hover:bg-amber-50/40">
                    <Td className="whitespace-nowrap text-gray-500">{formatDate(e.date)}</Td>
                    <Td>
                      <span className="font-medium text-gray-900">{e.description}</span>
                      <span className="block text-xs text-gray-500">
                        {[e.supplier, e.projectTitle, e.receiptRef]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </Td>
                    <Td className="hidden lg:table-cell text-gray-600">
                      {e.categoryLabel ?? "—"}
                    </Td>
                    <Td>
                      {/* Būtent to trūko iki šiol – iš kurios kišenės pinigai */}
                      <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-800">
                        {e.fundingSourceLabel}
                      </span>
                      <span className="block text-xs text-gray-400 mt-0.5">
                        {e.paymentMethodLabel}
                      </span>
                    </Td>
                    <Td className="text-right font-semibold text-gray-900 whitespace-nowrap">
                      −{money(e.amountCents)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ListCard>
        )}

        {tab === "fees" && (
          <FeesPanel
            fees={props.fees}
            spending={props.feeSpending}
            money={money}
            t={t}
            onExport={() =>
              downloadCsv(
                "nario-mokesciai.csv",
                toCsv(
                  [t.colYear, t.colFeeType, t.colPayers, t.colCollected, t.colCash, t.colTransfer],
                  props.fees.map((f) => [
                    f.year,
                    f.feeTypeLabel,
                    f.payerCount,
                    centsToCsvAmount(f.totalCents),
                    centsToCsvAmount(f.cashCents),
                    centsToCsvAmount(f.transferCents),
                  ])
                )
              )
            }
          />
        )}

        {tab === "transfers" && (
          <ListCard
            title={t.transfersTitle}
            subtitle={t.transfersHint}
            countLabel={null}
            onExport={null}
            exportLabel={null}
            exportHint={null}
            empty={visibleTransfers.length === 0 ? t.noRows : null}
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-100">
                  <Th>{t.colDate}</Th>
                  <Th>{t.colDirection}</Th>
                  <Th className="hidden sm:table-cell">{t.colNote}</Th>
                  <Th className="text-right">{t.colAmount}</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {visibleTransfers.map((tr) => (
                  <tr key={tr.id} className="hover:bg-amber-50/40">
                    <Td className="whitespace-nowrap text-gray-500">{formatDate(tr.date)}</Td>
                    <Td className="text-gray-900 font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        <ArrowLeftRight className="h-3.5 w-3.5 text-gray-400" />
                        {tr.directionLabel}
                      </span>
                    </Td>
                    <Td className="hidden sm:table-cell text-gray-600">{tr.note ?? "—"}</Td>
                    <Td className="text-right font-semibold text-gray-900 whitespace-nowrap">
                      {money(tr.amountCents)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ListCard>
        )}
      </section>

      {/* Suvestinės eksportas – nepriklauso nuo aktyvaus tab'o */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() =>
            downloadCsv(
              "finansu-suvestine.csv",
              toCsv(
                [
                  t.colProject,
                  t.receivedLabel,
                  t.spentLabel,
                  t.remainingLabel,
                  t.goalLabel,
                  t.stillNeededLabel,
                ],
                props.buckets.map((b) => [
                  b.title,
                  centsToCsvAmount(b.receivedCents),
                  centsToCsvAmount(b.spentCents),
                  centsToCsvAmount(b.remainingCents),
                  b.goalCents > 0 ? centsToCsvAmount(b.goalCents) : "",
                  b.stillNeededCents > 0 ? centsToCsvAmount(b.stillNeededCents) : "",
                ])
              )
            )
          }
          className="inline-flex items-center gap-2 text-sm text-green-700 hover:text-green-800 hover:underline"
        >
          <Download className="h-4 w-4" />
          {t.exportSummary}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Suvestinė + projektų kortelės
// ---------------------------------------------------------------------------

function SummaryBlock({
  balances,
  buckets,
  unallocatedCents,
  money,
  t,
}: {
  balances: BalancesView;
  buckets: BucketView[];
  unallocatedCents: number;
  money: (cents: number) => string;
  t: ReturnType<typeof useT>["finance"];
}) {
  return (
    <section className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-br from-green-700 to-green-800 text-white p-6 md:p-8 shadow-sm">
        <p className="text-green-100 text-sm font-medium uppercase tracking-wide">
          {t.communityHas}
        </p>
        <p className="text-4xl md:text-5xl font-bold mt-2">{money(balances.totalCents)}</p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-4 text-green-50">
          <span className="inline-flex items-center gap-2">
            <Landmark className="h-4 w-4" />
            {t.inBank} <strong className="font-semibold">{money(balances.bankCents)}</strong>
          </span>
          <span className="inline-flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            {t.inCash} <strong className="font-semibold">{money(balances.cashCents)}</strong>
          </span>
        </div>
        {balances.asOfDate && (
          <p className="text-xs text-green-200 mt-3">
            {t.asOfLabel.replace("{date}", formatDate(balances.asOfDate))}
          </p>
        )}
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            {t.allocationTitle}
          </h2>
        </div>
        <p className="text-xs text-gray-500 mb-3">{t.allocationHint}</p>
        <div className="flex flex-wrap gap-2">
          {buckets.map((b) => (
            <span
              key={b.key}
              className="inline-flex items-baseline gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm"
            >
              <span className="text-gray-600">{b.title}</span>
              <strong className="font-semibold text-gray-900">{money(b.remainingCents)}</strong>
            </span>
          ))}
          {unallocatedCents !== 0 && (
            <span className="inline-flex items-baseline gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm">
              <span className="text-amber-800">{t.unallocated}</span>
              <strong className="font-semibold text-amber-900">{money(unallocatedCents)}</strong>
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {buckets.map((bucket) => (
          <BucketCard key={bucket.key} bucket={bucket} money={money} t={t} />
        ))}
      </div>
    </section>
  );
}

/**
 * Projekto kortelė. Neišskleista rodo esmę (gauta / išleista / liko) – narys
 * supranta būklę nespausdamas nieko. Išskleidus – detalus eilučių sąrašas.
 */
function BucketCard({
  bucket,
  money,
  t,
}: {
  bucket: BucketView;
  money: (cents: number) => string;
  t: ReturnType<typeof useT>["finance"];
}) {
  const [open, setOpen] = useState(false);

  const percent =
    bucket.goalCents > 0 ? Math.round((bucket.receivedCents / bucket.goalCents) * 100) : 0;
  const barPercent = Math.min(100, Math.max(0, percent));
  const overspent = bucket.remainingCents < 0;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
      <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold text-gray-900 uppercase tracking-wide text-sm">
            {/* Nuoroda TIK viešam projektui: /projektai/[slug] filtruoja
                `is_public = true`, tad nevieši (pvz. Bendruomenės fondas)
                ten grąžintų 404. Jų sudėtis matoma išskleidus šią kortelę. */}
            {bucket.slug && bucket.isPublic ? (
              <Link href={`/projektai/${bucket.slug}`} className="hover:text-green-700">
                {bucket.title}
              </Link>
            ) : (
              bucket.title
            )}
          </h3>
          {bucket.subtitle && <p className="text-xs text-gray-500 mt-0.5">{bucket.subtitle}</p>}
          {!bucket.isPublic && bucket.slug && (
            <span
              className="inline-block mt-1 text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600"
              title={t.internalHint}
            >
              {t.internalBadge}
            </span>
          )}
        </div>
        {bucket.goalCents > 0 && (
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-gray-500">{t.goalLabel}</p>
            <p className="text-sm font-semibold text-gray-700">{money(bucket.goalCents)}</p>
          </div>
        )}
      </div>

      <div className="px-5 py-4 space-y-4 flex-1">
        <Section
          icon={<PiggyBank className="h-4 w-4 text-green-600" />}
          label={t.receivedLabel}
          amount={money(bucket.receivedCents)}
          amountClass="text-green-700"
          lines={bucket.incomeLines}
          open={open}
          money={money}
        />

        <Section
          icon={<Receipt className="h-4 w-4 text-gray-500" />}
          label={t.spentLabel}
          amount={`−${money(bucket.spentCents)}`}
          amountClass="text-gray-800"
          lines={bucket.expenseLines}
          open={open}
          money={money}
        />

        <div className="border-t border-gray-100 pt-3 space-y-1">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold text-gray-700">{t.remainingLabel}</span>
            <span
              className={`text-lg font-bold ${overspent ? "text-red-600" : "text-green-700"}`}
            >
              {money(bucket.remainingCents)}
            </span>
          </div>
          {overspent && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> {t.overspent}
            </p>
          )}
          {bucket.goalCents > 0 &&
            (bucket.stillNeededCents > 0 ? (
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-gray-500">{t.stillNeededLabel}</span>
                <span className="font-semibold text-amber-700">
                  {money(bucket.stillNeededCents)}
                </span>
              </div>
            ) : (
              <p className="text-sm text-green-700 font-medium flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" /> {t.goalReached}
              </p>
            ))}
        </div>

        {bucket.goalCents > 0 && (
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-green-500 to-green-700 h-full rounded-full transition-all"
              style={{ width: `${barPercent}%` }}
            />
          </div>
        )}
      </div>

      {(bucket.incomeLines.length > 0 || bucket.expenseLines.length > 0) && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="px-5 py-2.5 text-xs font-medium text-green-700 hover:bg-green-50 border-t border-gray-100 inline-flex items-center justify-center gap-1.5"
        >
          {open ? t.hideDetails : t.showDetails}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      )}
    </div>
  );
}

function Section({
  icon,
  label,
  amount,
  amountClass,
  lines,
  open,
  money,
}: {
  icon: React.ReactNode;
  label: string;
  amount: string;
  amountClass: string;
  lines: BucketView["incomeLines"];
  open: boolean;
  money: (cents: number) => string;
}) {
  if (lines.length === 0) return null;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          {icon}
          {label}
        </span>
        <span className={`font-semibold ${amountClass}`}>{amount}</span>
      </div>
      {open && (
        <ul className="mt-2 space-y-1 pl-6">
          {lines.map((line) => (
            <li key={line.key} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-gray-600 min-w-0">
                {line.label}
                {line.count > 1 && (
                  <span className="text-xs text-gray-400"> ({line.count})</span>
                )}
              </span>
              <span className="text-gray-700 whitespace-nowrap">{money(line.amountCents)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sutikrinimas
// ---------------------------------------------------------------------------

function ReconciliationCard({
  recon,
  money,
  t,
}: {
  recon: ReconciliationView;
  money: (cents: number) => string;
  t: ReturnType<typeof useT>["finance"];
}) {
  const ok = recon.differenceCents === 0;

  return (
    <section
      className={`rounded-xl border p-5 ${
        !recon.hasStatement
          ? "bg-white border-gray-200"
          : ok
            ? "bg-green-50 border-green-200"
            : "bg-red-50 border-red-300"
      }`}
    >
      <div className="flex items-start gap-3">
        {recon.hasStatement ? (
          ok ? (
            <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0" />
          ) : (
            <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0" />
          )
        ) : (
          <Banknote className="h-6 w-6 text-gray-400 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-gray-900">{t.reconTitle}</h2>
          {recon.hasStatement && recon.periodStart && recon.periodEnd && (
            <p className="text-xs text-gray-500 mt-0.5">
              {t.reconPeriod
                .replace("{from}", formatDate(recon.periodStart))
                .replace("{to}", formatDate(recon.periodEnd))}
            </p>
          )}

          {recon.hasStatement ? (
            <>
              <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <Stat label={t.reconSystemBank} value={money(recon.systemBankCents)} />
                <Stat label={t.reconStatementBank} value={money(recon.statementClosingCents)} />
                <Stat label={t.reconCash} value={money(recon.cashCents)} />
                <Stat
                  label={t.reconDifference}
                  value={money(recon.differenceCents)}
                  valueClass={ok ? "text-green-700" : "text-red-700"}
                />
              </dl>
              <p className={`text-sm mt-3 ${ok ? "text-green-800" : "text-red-800 font-medium"}`}>
                {ok ? t.reconOk : t.reconWarn}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-500 mt-2">{t.reconNoStatement}</p>
          )}
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  valueClass = "text-gray-900",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className={`text-lg font-semibold ${valueClass}`}>{value}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Nario mokesčiai
// ---------------------------------------------------------------------------

function FeesPanel({
  fees,
  spending,
  money,
  t,
  onExport,
}: {
  fees: FeeRow[];
  spending: FeeSpendingRow[];
  money: (cents: number) => string;
  t: ReturnType<typeof useT>["finance"];
  onExport: () => void;
}) {
  return (
    <div className="space-y-4">
      <ListCard
        title={t.feesTitle}
        subtitle={t.feesSubtitle}
        countLabel={null}
        onExport={onExport}
        exportLabel={t.exportSummary}
        exportHint={null}
        empty={fees.length === 0 ? t.noRows : null}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-100">
              <Th>{t.colYear}</Th>
              <Th>{t.colFeeType}</Th>
              <Th className="text-right">{t.colPayers}</Th>
              <Th className="text-right hidden sm:table-cell">{t.colCash}</Th>
              <Th className="text-right hidden sm:table-cell">{t.colTransfer}</Th>
              <Th className="text-right">{t.colCollected}</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {fees.map((f) => (
              <tr key={`${f.year}-${f.feeType}`} className="hover:bg-amber-50/40">
                <Td className="font-medium text-gray-900">{f.year}</Td>
                <Td className="text-gray-600">{f.feeTypeLabel}</Td>
                <Td className="text-right text-gray-700">{f.payerCount}</Td>
                <Td className="text-right hidden sm:table-cell text-gray-500">
                  {money(f.cashCents)}
                </Td>
                <Td className="text-right hidden sm:table-cell text-gray-500">
                  {money(f.transferCents)}
                </Td>
                <Td className="text-right font-semibold text-green-700">{money(f.totalCents)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListCard>

      {spending.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-gray-900 mb-3">{t.feesUsedForTitle}</h3>
          <ul className="space-y-2">
            {spending.map((s) => (
              <li key={s.label} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-gray-600">
                  {s.label}
                  <span className="text-xs text-gray-400"> ({s.count})</span>
                </span>
                <span className="font-medium text-gray-900">−{money(s.amountCents)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-gray-500">{t.feesPrivacyNote}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bendri gabaliukai
// ---------------------------------------------------------------------------

function ListCard({
  title,
  subtitle,
  countLabel,
  onExport,
  exportLabel,
  exportHint,
  empty,
  children,
}: {
  title: string;
  subtitle: string | null;
  countLabel: string | null;
  onExport: (() => void) | null;
  exportLabel: string | null;
  exportHint: string | null;
  empty: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5 max-w-2xl">{subtitle}</p>}
          {countLabel && <p className="text-xs text-gray-600 mt-1 font-medium">{countLabel}</p>}
        </div>
        {onExport && exportLabel && (
          <div className="text-right">
            <button
              type="button"
              onClick={onExport}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <Download className="h-3.5 w-3.5" />
              {exportLabel}
            </button>
            {exportHint && <p className="text-[11px] text-gray-400 mt-1 max-w-[16rem]">{exportHint}</p>}
          </div>
        )}
      </div>

      {empty ? (
        <p className="px-5 py-12 text-center text-sm text-gray-400">{empty}</p>
      ) : (
        <div className="overflow-x-auto">{children}</div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
        active
          ? "border-green-700 text-green-800"
          : "border-transparent text-gray-500 hover:text-gray-700"
      }`}
    >
      {children}
    </button>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-500 mb-1">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterDate({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-500 mb-1">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full rounded-lg border border-gray-300 px-2 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
      />
    </label>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-2 font-medium ${className}`}>{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
}

/** CSV atsisiuntimas naršyklėje – be serverio kelionės, matomi būtent filtruoti duomenys. */
function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
