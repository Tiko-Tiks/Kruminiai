import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/authz";
import { loadAdminFeeDays, loadCommunityFinance } from "@/lib/finance-data";
import { computeBalances, dailyBankBreakdown, reconcile } from "@/lib/finance";
import { ReconciliationPanel } from "./ReconciliationPanel";
import type { DailyRow, StatementRow, TransferAdminRow } from "./types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sutikrinimas su banku",
  robots: { index: false, follow: false, nocache: true },
};

export default async function ReconciliationPage({
  searchParams,
}: {
  searchParams: { israsas?: string };
}) {
  const supabase = createServerSupabaseClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-800">
        {auth.error}
      </div>
    );
  }

  // Dienos tikslumo mokesčių pjūvis – tik admin'ui; be jo sutikrinimas
  // atsakytų „kurį mėnesį", o ne „kurią dieną" nesutampa.
  const [data, feeDays] = await Promise.all([loadCommunityFinance(), loadAdminFeeDays()]);

  const balanceInput = {
    openingBalance: data.openingBalance,
    donations: data.donations,
    expenses: data.expenses,
    transfers: data.transfers,
    feeMonths: data.feeMonths,
  };

  // Pasirinktas išrašas (arba naujausias). Sutikrinimas visada rišamas prie
  // KONKRETAUS laikotarpio – kitaip skirtumas nieko nepasako.
  const statement =
    data.statements.find((s) => s.id === searchParams.israsas) ?? data.statements[0] ?? null;

  const recon = reconcile({ ...balanceInput, statement, feeDays });
  const balances = computeBalances(balanceInput);
  const daily = dailyBankBreakdown({ ...balanceInput, statement, feeDays });

  const dailyRows: DailyRow[] = daily.map((d) => ({
    date: d.date,
    incomeCents: d.incomeCents,
    expenseCents: d.expenseCents,
    runningCents: d.runningCents,
    items: d.items.map((i) => ({
      label: i.label || (i.kind === "income" ? "Nario mokesčiai (dienos suma)" : "—"),
      amountCents: i.amountCents,
      kind: i.kind,
    })),
  }));

  const statementRows: StatementRow[] = data.statements.map((s) => ({
    id: s.id,
    periodStart: s.period_start,
    periodEnd: s.period_end,
    openingCents: s.opening_cents,
    closingCents: s.closing_cents,
    incomeCents: s.income_cents,
    expenseCents: s.expense_cents,
    note: s.note,
  }));

  const transferRows: TransferAdminRow[] = data.transfers.map((t) => ({
    id: t.id,
    date: t.transfer_date,
    direction: t.direction,
    amountCents: t.amount_cents,
    note: t.note,
  }));

  return (
    <div>
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Į suvestinę
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Sutikrinimas su banku</h1>
        <p className="text-sm text-gray-500 mt-1 max-w-3xl">
          Suveskite banko išrašo laikotarpį ir sumas – sistema iškart parodys, ar jos sutampa,
          ir kurią dieną atsiranda skirtumas. Būtent šito ieškojimo 2026-09-15 prireikė kelių
          valandų rankomis.
        </p>
      </div>

      <ReconciliationPanel
        selectedStatementId={statement?.id ?? null}
        statements={statementRows}
        transfers={transferRows}
        recon={{
          hasStatement: Boolean(statement),
          systemIncomeCents: recon.systemIncomeCents,
          systemExpenseCents: recon.systemExpenseCents,
          systemBankCents: recon.systemBankCents,
          statementIncomeCents: statement?.income_cents ?? 0,
          statementExpenseCents: statement?.expense_cents ?? 0,
          statementClosingCents: recon.statementClosingCents,
          incomeDifferenceCents: recon.incomeDifferenceCents,
          expenseDifferenceCents: recon.expenseDifferenceCents,
          differenceCents: recon.differenceCents,
        }}
        totals={{
          totalCents: balances.totalCents,
          bankCents: balances.bankCents,
          cashCents: balances.cashCents,
        }}
        openingBalance={
          data.openingBalance
            ? {
                asOfDate: data.openingBalance.as_of_date,
                amountCents: data.openingBalance.amount_cents,
                note: data.openingBalance.note,
              }
            : null
        }
        daily={dailyRows}
      />
    </div>
  );
}
