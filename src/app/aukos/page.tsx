import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { formatDate, formatCurrency } from "@/lib/utils";
import { getDict } from "@/lib/i18n-server";
import { Heart, Lock, Wallet, Receipt, PiggyBank, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

// Nariams skirtas puslapis – niekada neindeksuojamas ir nekeliauja į sitemap'ą.
export const metadata = {
  title: "Bendruomenės lėšos",
  robots: { index: false, follow: false },
};

interface ProjectSummary {
  id: string;
  slug: string;
  title: string;
  is_public: boolean;
  is_active: boolean;
  goal_cents: number;
  total_cents: number;
  donation_count: number;
  expense_cents: number;
  balance_cents: number;
}

interface DonationRow {
  id: string;
  project_id: string;
  project_slug: string;
  project_title: string;
  /** NULL, kai auka anoniminė – RPC vardo net negrąžina. */
  donor_name: string | null;
  amount_cents: number;
  method: string;
  donated_at: string;
  is_anonymous: boolean;
  donor_message: string | null;
}

interface Overview {
  projects: ProjectSummary[];
  donations: DonationRow[];
  totals: {
    total_cents: number;
    expense_cents: number;
    balance_cents: number;
    donation_count: number;
    project_count: number;
  };
}

export default async function CommunityFundsPage() {
  const supabase = createServerSupabaseClient();
  const t = getDict().communityFunds;

  // Visos aukos (įsk. neviešus projektus) – tik per SECURITY DEFINER RPC.
  // Tiesioginė užklausa į `donations` matytų tik viešų projektų aukas (RLS),
  // o RLS praplėtimas „iššautų" neviešą fondą į viešus puslapius. Žr. migr. 043.
  const { data } = await supabase.rpc("get_member_donations_overview");
  const overview = data as Overview | null;

  // RPC grąžina NULL nepatvirtintam/neprisijungusiam – middleware tokių čia
  // neturėtų praleisti, bet antras barjeras kainuoja vieną eilutę.
  if (!overview) redirect("/prisijungimas?from=/aukos");

  const { projects, donations, totals } = overview;
  const donationWord = (n: number) => (n === 1 ? t.donationSingular : t.donationPlural);

  return (
    <div className="min-h-screen flex flex-col bg-amber-50/50">
      <PublicHeader />

      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-green-800 mb-3">
              {t.pageHeading}
            </h1>
            <p className="text-gray-500 max-w-2xl mx-auto">{t.intro}</p>
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-green-800 bg-green-100 border border-green-200 rounded-full px-3 py-1">
              <Lock className="h-3.5 w-3.5" />
              {t.membersOnlyNote}
            </p>
          </div>

          {/* Bendra lėšų padėtis */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <SummaryCard
              icon={<Wallet className="h-5 w-5 text-amber-600" />}
              label={t.summaryCollected}
              value={formatCurrency(totals.total_cents)}
              meta={`${totals.donation_count} ${donationWord(totals.donation_count)} · ${t.summaryCollectedMeta}`}
              tone="amber"
            />
            <SummaryCard
              icon={<Receipt className="h-5 w-5 text-gray-500" />}
              label={t.summarySpent}
              value={formatCurrency(totals.expense_cents)}
              meta={t.summarySpentMeta}
              tone="gray"
            />
            <SummaryCard
              icon={<PiggyBank className="h-5 w-5 text-green-600" />}
              label={t.summaryBalance}
              value={formatCurrency(totals.balance_cents)}
              meta={t.summaryBalanceMeta}
              tone="green"
            />
          </div>

          {/* Suvestinė pagal projektą */}
          {projects.length > 0 && (
            <section className="mb-8">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3">
                {t.projectsTitle}
              </h2>
              <div className="space-y-3">
                {projects.map((p) => {
                  const percent =
                    p.goal_cents > 0
                      ? Math.round((p.total_cents / p.goal_cents) * 100)
                      : 0;
                  return (
                    <div
                      key={p.id}
                      className="bg-white rounded-2xl border border-amber-200 p-5 sm:p-6"
                    >
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <h3 className="text-base sm:text-lg font-bold text-gray-900">
                          {p.title}
                        </h3>
                        {!p.is_public && (
                          <span
                            title={t.internalHint}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-800 text-white uppercase tracking-wide"
                          >
                            <Lock className="h-3 w-3" />
                            {t.internalBadge}
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          {p.donation_count} {donationWord(p.donation_count)}
                        </span>
                        {p.is_public && (
                          <Link
                            href={`/projektai/${p.slug}`}
                            className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800"
                          >
                            {t.viewProject}
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <Figure label={t.projectCollected} value={formatCurrency(p.total_cents)} className="text-amber-700" />
                        <Figure label={t.projectSpent} value={formatCurrency(p.expense_cents)} className="text-gray-700" />
                        <Figure label={t.projectBalance} value={formatCurrency(p.balance_cents)} className="text-green-700" />
                      </div>

                      {p.goal_cents > 0 && (
                        <div className="mt-4 space-y-1.5">
                          <div className="flex items-baseline justify-between gap-3 text-xs text-gray-500">
                            <span>{t.ofGoal.replace("{goal}", (p.goal_cents / 100).toFixed(0))}</span>
                            <span className="font-semibold text-amber-700">{percent}%</span>
                          </div>
                          <div className="h-2 bg-amber-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-amber-400 to-amber-500"
                              style={{ width: `${Math.min(100, percent)}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Visos aukos – naujausios viršuje */}
          <section className="bg-white rounded-2xl border border-amber-200 overflow-hidden">
            <div className="px-5 sm:px-6 py-4 border-b border-amber-100 bg-amber-50/40 flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                {t.donationsTitle}
              </h2>
              <span className="text-xs text-amber-700 font-semibold whitespace-nowrap">
                {donations.length} {donationWord(donations.length)}
              </span>
            </div>

            {donations.length === 0 ? (
              <div className="p-10 text-center">
                <Heart className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">{t.emptyState}</p>
              </div>
            ) : (
              <>
                {/* Telefonui – kortelės (5 stulpelių lentelė netelpa) */}
                <ul className="sm:hidden divide-y divide-gray-100">
                  {donations.map((d) => (
                    <li key={d.id} className="px-5 py-3.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-medium text-gray-900 break-words">
                          {d.is_anonymous ? (
                            <span className="text-gray-500 italic">{t.anonymousDonor}</span>
                          ) : (
                            d.donor_name || "—"
                          )}
                        </span>
                        <span className="font-semibold text-amber-700 whitespace-nowrap">
                          {formatCurrency(d.amount_cents)}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                        <span>{formatDate(d.donated_at)}</span>
                        <span aria-hidden>·</span>
                        <span className="text-gray-600">{d.project_title}</span>
                      </div>
                      {d.donor_message && (
                        <p className="mt-1.5 text-xs text-gray-600 italic break-words">
                          {`„${d.donor_message}“`}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>

                {/* Planšetei / kompiuteriui – lentelė */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50/50">
                        <Th>{t.colDate}</Th>
                        <Th>{t.colDonor}</Th>
                        <Th>{t.colProject}</Th>
                        <Th className="text-right">{t.colAmount}</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {donations.map((d) => (
                        <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50/50 align-top">
                          <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
                            {formatDate(d.donated_at)}
                          </td>
                          <td className="py-3 px-4 text-gray-900">
                            {d.is_anonymous ? (
                              <span className="text-gray-500 italic">{t.anonymousDonor}</span>
                            ) : (
                              d.donor_name || "—"
                            )}
                            {d.donor_message && (
                              <p className="mt-0.5 text-xs text-gray-500 italic">
                                {`„${d.donor_message}“`}
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-4 text-gray-600">{d.project_title}</td>
                          <td className="py-3 px-4 text-right font-semibold text-amber-700 whitespace-nowrap">
                            {formatCurrency(d.amount_cents)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>

          <p className="mt-6 text-center text-sm text-gray-500">
            {t.feesLinkPrefix}{" "}
            <Link href="/skaidrumas" className="text-green-700 hover:underline font-medium">
              {t.feesLinkWord}
            </Link>
            .
          </p>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  meta,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  meta: string;
  tone: "amber" | "gray" | "green";
}) {
  const border =
    tone === "amber"
      ? "border-amber-200"
      : tone === "green"
        ? "border-green-200"
        : "border-gray-200";
  const valueColor =
    tone === "amber"
      ? "text-amber-700"
      : tone === "green"
        ? "text-green-700"
        : "text-gray-800";

  return (
    <div className={`bg-white rounded-2xl border ${border} p-5`}>
      <div className="flex items-center gap-2 mb-1.5">
        {icon}
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{meta}</p>
    </div>
  );
}

function Figure({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
        {label}
      </p>
      <p className={`font-semibold ${className ?? "text-gray-900"}`}>{value}</p>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`text-left py-3 px-4 font-semibold text-gray-700 uppercase text-xs tracking-wider ${className ?? ""}`}
    >
      {children}
    </th>
  );
}
