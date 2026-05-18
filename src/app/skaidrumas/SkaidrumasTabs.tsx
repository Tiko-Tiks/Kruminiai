"use client";

import { useState } from "react";
import { Coins, FileText, FolderOpen, CalendarDays, Heart, TrendingUp, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface DocumentRow {
  id: string;
  title: string;
  file_path: string;
  file_name: string;
  category: string;
  published_at: string | null;
  file_size: number | null;
}

interface NewsRow {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  published_at: string | null;
}

interface YearStats {
  year: number;
  collected_cents: number;
  potential_cents: number;
  paid_count: number;
  unpaid_count: number;
}

interface DonationRow {
  id: string;
  donor_name: string | null;
  amount_cents: number;
  donated_at: string;
  is_anonymous: boolean;
}

interface Props {
  ataskaitos: DocumentRow[];
  protokolai: DocumentRow[];
  istatai: DocumentRow[];
  news: NewsRow[];
  yearStats: YearStats[];
  totalFeesCollected: number;
  totalDebt: number;
  donations: DonationRow[];
  totalDonations: number;
  lieptasGoalCents: number;
}

function eur(cents: number): string {
  return (cents / 100).toFixed(0);
}

const tabs = [
  { id: "finansai", label: "Finansai", icon: Coins },
  { id: "nutarimai", label: "Nutarimai", icon: FileText },
  { id: "projektai", label: "Projektai", icon: FolderOpen },
  { id: "susirinkimai", label: "Susirinkimai", icon: CalendarDays },
] as const;

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("lt-LT", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function getDocumentUrl(filePath: string) {
  if (filePath.startsWith('__api__/')) return `/api/dokumentai/${filePath.replace('__api__/', '')}`;
  if (filePath.startsWith('__public__/')) return `/${filePath.replace('__public__/', '')}`;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/documents/${filePath}`;
}

function EmptyState() {
  return (
    <p className="text-center text-gray-400 py-8">
      Duomenų nėra arba jie nėra vieši.
    </p>
  );
}

function DocumentTable({ documents, categoryLabel }: { documents: DocumentRow[]; categoryLabel: string }) {
  if (documents.length === 0) return <EmptyState />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 font-semibold text-gray-700 uppercase text-xs tracking-wider">
              Data
            </th>
            <th className="text-left py-3 px-4 font-semibold text-gray-700 uppercase text-xs tracking-wider">
              {categoryLabel}
            </th>
            <th className="text-right py-3 px-4 font-semibold text-gray-700 uppercase text-xs tracking-wider">
              Failas
            </th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr key={doc.id} className="border-b border-gray-100 hover:bg-gray-50/50">
              <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
                {formatDate(doc.published_at)}
              </td>
              <td className="py-3 px-4 text-gray-900">{doc.title}</td>
              <td className="py-3 px-4 text-right">
                <a
                  href={getDocumentUrl(doc.file_path)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-700 hover:text-green-800 font-medium text-xs"
                >
                  Atsisiųsti
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SkaidrumasTabs({
  ataskaitos,
  protokolai,
  istatai,
  news,
  yearStats,
  totalFeesCollected,
  totalDebt,
  donations,
  totalDonations,
  lieptasGoalCents,
}: Props) {
  const [activeTab, setActiveTab] = useState<string>("finansai");
  const currentYear = new Date().getFullYear();
  const currentYearStats = yearStats.find((y) => y.year === currentYear);
  const lieptasPercent =
    lieptasGoalCents > 0
      ? Math.min(100, Math.round((totalDonations / lieptasGoalCents) * 100))
      : 0;

  return (
    <>
      {/* Tabs */}
      <div className="bg-gray-100 rounded-xl p-1 grid grid-cols-2 sm:grid-cols-4 gap-1 mb-8">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                isActive
                  ? "bg-green-800 text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Finansai */}
      {activeTab === "finansai" && (
        <div className="space-y-6">
          {/* Suvestinės kortelės */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-2">
                <Coins className="h-4 w-4 text-green-700" />
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Šiemet surinkta
                </p>
              </div>
              <p className="text-2xl font-bold text-green-800">
                {eur(currentYearStats?.collected_cents || 0)} €
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {currentYearStats?.paid_count || 0} nariai · {currentYear} m.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-green-700" />
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Iš viso surinkta
                </p>
              </div>
              <p className="text-2xl font-bold text-green-800">
                {eur(totalFeesCollected)} €
              </p>
              <p className="text-xs text-gray-500 mt-1">visi metai</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Skolos
                </p>
              </div>
              <p className="text-2xl font-bold text-red-700">{eur(totalDebt)} €</p>
              <p className="text-xs text-gray-500 mt-1">visi metai</p>
            </div>

            <div className="bg-white rounded-2xl border border-amber-200 p-5">
              <div className="flex items-center gap-2 mb-2">
                <Heart className="h-4 w-4 text-amber-600" />
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Liepto aukos
                </p>
              </div>
              <p className="text-2xl font-bold text-amber-700">
                {eur(totalDonations)} €
              </p>
              <p className="text-xs text-gray-500 mt-1">
                iš {eur(lieptasGoalCents)} € ({lieptasPercent}%)
              </p>
            </div>
          </div>

          {/* Nario mokesčiai pagal metus */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                Nario mokesčiai pagal metus
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/50">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 uppercase text-xs tracking-wider">
                      Metai
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700 uppercase text-xs tracking-wider">
                      Surinkta
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700 uppercase text-xs tracking-wider">
                      Galima surinkti
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700 uppercase text-xs tracking-wider">
                      Skola
                    </th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700 uppercase text-xs tracking-wider">
                      Sumokėjo
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {yearStats.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <EmptyState />
                      </td>
                    </tr>
                  ) : (
                    yearStats.map((y) => {
                      const debt = y.potential_cents - y.collected_cents;
                      const totalEligible = y.paid_count + y.unpaid_count;
                      return (
                        <tr
                          key={y.year}
                          className="border-b border-gray-100 hover:bg-gray-50/50"
                        >
                          <td className="py-3 px-4 font-semibold text-gray-900">
                            {y.year}
                          </td>
                          <td className="py-3 px-4 text-right text-green-700 font-semibold">
                            {eur(y.collected_cents)} €
                          </td>
                          <td className="py-3 px-4 text-right text-gray-500">
                            {eur(y.potential_cents)} €
                          </td>
                          <td className="py-3 px-4 text-right text-red-700">
                            {debt > 0 ? `${eur(debt)} €` : "—"}
                          </td>
                          <td className="py-3 px-4 text-right text-gray-600 text-xs">
                            {y.paid_count} iš {totalEligible}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Liepto aukos */}
          {donations.length > 0 && (
            <div className="bg-white rounded-2xl border border-amber-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-amber-100 bg-amber-50/40 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                  Liepto projekto aukos
                </h3>
                <span className="text-xs text-amber-700 font-semibold">
                  {donations.length}{" "}
                  {donations.length === 1 ? "auka" : "aukos"}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/50">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 uppercase text-xs tracking-wider">
                        Data
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 uppercase text-xs tracking-wider">
                        Aukotojas
                      </th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700 uppercase text-xs tracking-wider">
                        Suma
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {donations.map((d) => (
                      <tr
                        key={d.id}
                        className="border-b border-gray-100 hover:bg-gray-50/50"
                      >
                        <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
                          {formatDate(d.donated_at)}
                        </td>
                        <td className="py-3 px-4 text-gray-900">
                          {d.is_anonymous ? (
                            <span className="text-gray-500 italic">Anonimas</span>
                          ) : (
                            d.donor_name || "—"
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-amber-700">
                          {eur(d.amount_cents)} €
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Ataskaitų dokumentai (jei yra) */}
          {ataskaitos.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                  Finansinės ataskaitos
                </h3>
              </div>
              <DocumentTable documents={ataskaitos} categoryLabel="Ataskaita" />
            </div>
          )}
        </div>
      )}

      {/* Nutarimai */}
      {activeTab === "nutarimai" && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <DocumentTable documents={[...protokolai, ...istatai]} categoryLabel="Dokumentas" />
        </div>
      )}

      {/* Projektai */}
      {activeTab === "projektai" && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {news.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="divide-y divide-gray-100">
              {news.map((article) => (
                <a
                  key={article.id}
                  href={`/naujienos/${article.slug}`}
                  className="block px-6 py-4 hover:bg-gray-50/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{article.title}</p>
                      {article.excerpt && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{article.excerpt}</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                      {formatDate(article.published_at)}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Susirinkimai */}
      {activeTab === "susirinkimai" && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <DocumentTable documents={protokolai} categoryLabel="Susirinkimas" />
        </div>
      )}
    </>
  );
}
