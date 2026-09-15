import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { loadCommunityFinance } from "@/lib/finance-data";
import { buildBuckets, computeBalances, reconcile } from "@/lib/finance";
import { formatCurrency, formatMoney } from "@/lib/utils";

/**
 * Admin skydelio įspėjimai – kad 2026-09-15 sutikrinimo istorija nesikartotų.
 *
 * Kiekvienas įspėjimas atitinka konkrečią tuomet rastą klaidą:
 *   * narys be einamųjų metų mokesčio  → pamiršti mokėjimai (2 nariai)
 *   * išlaida be kategorijos           → bendros išlaidos niekur nerašytos
 *   * išlaidos > gautos lėšos          → projekto lėšos „suvalgytos" iš kitur
 *   * likučių skirtumas ≠ 0            → sistema nesutampa su banku
 */
export async function FinanceAlerts() {
  const supabase = createServerSupabaseClient();
  const year = new Date().getFullYear();

  const [data, unpaidRes] = await Promise.all([
    loadCommunityFinance(),
    supabase.rpc("get_members_without_current_fee", { p_year: year }),
  ]);

  const balanceInput = {
    openingBalance: data.openingBalance,
    donations: data.donations,
    expenses: data.expenses,
    transfers: data.transfers,
    feeMonths: data.feeMonths,
  };

  const balances = computeBalances(balanceInput);
  const recon = reconcile({
    ...balanceInput,
    statement: data.statements[0] ?? null,
    feeStatements: data.feeStatements,
  });
  const buckets = buildBuckets({ ...balanceInput, projects: data.projects, locale: "lt" });

  const unpaidMembers = (unpaidRes.data ?? []) as {
    member_id: string;
    first_name: string;
    last_name: string;
  }[];
  const uncategorised = data.expenses.filter((e) => !e.category);
  const overspent = buckets.filter((b) => b.remainingCents < 0);

  const alerts: { key: string; text: string; href: string; detail?: string }[] = [];

  if (recon.statement && recon.differenceCents !== 0) {
    alerts.push({
      key: "recon",
      text: `Sistemos ir banko likučiai nesutampa – skirtumas ${formatCurrency(
        recon.differenceCents
      )}`,
      href: "/admin/finansai/sutikrinimas",
    });
  }

  if (!recon.statement) {
    alerts.push({
      key: "no-statement",
      text: "Banko išrašas dar nesuvestas – nėra su kuo sutikrinti likučio",
      href: "/admin/finansai/sutikrinimas",
    });
  }

  if (uncategorised.length > 0) {
    alerts.push({
      key: "no-category",
      text: `${uncategorised.length} išlaid(os) be kategorijos`,
      href: "/admin/aukos",
      detail: uncategorised
        .slice(0, 3)
        .map((e) => e.description)
        .join(", "),
    });
  }

  for (const bucket of overspent) {
    alerts.push({
      key: `overspent-${bucket.key}`,
      text: `„${bucket.title}" – išlaidos viršija gautas lėšas ${formatCurrency(
        Math.abs(bucket.remainingCents)
      )}`,
      href: "/finansai",
    });
  }

  if (unpaidMembers.length > 0) {
    alerts.push({
      key: "unpaid",
      text: `${unpaidMembers.length} aktyvi(ų) nari(ų) be ${year} m. nario mokesčio įrašo`,
      href: "/admin/mokesciai",
      detail: unpaidMembers
        .slice(0, 5)
        .map((m) => `${m.first_name} ${m.last_name}`)
        .join(", "),
    });
  }

  return (
    <div className="mb-8">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="font-semibold text-gray-900">Finansų būklė</h2>
        <Link
          href="/admin/finansai/sutikrinimas"
          className="text-sm text-green-700 hover:text-green-800 hover:underline"
        >
          Sutikrinimas su banku
        </Link>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 mb-3">
        <p className="text-sm text-gray-500">Bendruomenė turi</p>
        <p className="text-3xl font-bold text-gray-900 mt-1">
          {formatMoney(balances.totalCents)}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          banke {formatMoney(balances.bankCents)} · kasoje {formatMoney(balances.cashCents)}
        </p>
      </div>

      {alerts.length === 0 ? (
        <div className="rounded-xl border border-green-200 bg-green-50 px-5 py-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-800">
            Neatitikimų nerasta – sistema sutampa su banku, visos išlaidos suklasifikuotos.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {alerts.map((a) => (
            <li key={a.key}>
              <Link
                href={a.href}
                className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 hover:bg-amber-100/60 transition-colors"
              >
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-amber-900">{a.text}</p>
                  {a.detail && <p className="text-xs text-amber-700 mt-0.5">{a.detail}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
