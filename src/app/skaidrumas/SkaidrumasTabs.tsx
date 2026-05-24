"use client";

import {
  Coins,
  Heart,
  AlertCircle,
  ArrowRight,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { DocumentLink } from "@/components/DocumentLink";

interface DocumentRow {
  id: string;
  title: string;
  file_path: string;
  file_name: string;
  category: string;
  published_at: string | null;
  file_size: number | null;
}

interface YearStats {
  year: number;
  collected_cents: number;
  metinis_collected_cents: number;
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
  yearStats: YearStats[];
  totalDebt: number;
  donations: DonationRow[];
  totalDonations: number;
  lieptasGoalCents: number;
}

function eur(cents: number): string {
  return (cents / 100).toFixed(0);
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("lt-LT", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function EmptyState({ message = "Duomenų nėra." }: { message?: string }) {
  return <p className="text-center text-gray-400 py-8 text-sm">{message}</p>;
}

/**
 * Skaidrumas puslapis – tik FINANSŲ peržiūra:
 *   • metinė nario mokesčių statistika
 *   • aukų rinkimo projektų progresas (Lieptas ir kt.)
 *   • aukotojų sąrašas
 *   • finansinių ataskaitų greita prieiga
 *
 * Visi kiti dokumentai (įstatai, protokolai, sutartys) gyvena /dokumentai
 * puslapyje, kad nebūtų dubliavimo. Apačioje pridėta nuoroda į pilną
 * dokumentų archyvą.
 */
export function SkaidrumasTabs({
  ataskaitos,
  yearStats,
  totalDebt,
  donations,
  totalDonations,
  lieptasGoalCents,
}: Props) {
  const currentYear = new Date().getFullYear();
  const currentYearStats = yearStats.find((y) => y.year === currentYear);
  const lieptasPercent =
    lieptasGoalCents > 0
      ? Math.min(100, Math.round((totalDonations / lieptasGoalCents) * 100))
      : 0;

  return (
    <div className="space-y-6">
      {/* Suvestinės kortelės */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
            <AlertCircle className="h-4 w-4 text-red-600" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Nario mokesčio skola
            </p>
          </div>
          <p className="text-2xl font-bold text-red-700">{eur(totalDebt)} €</p>
          <p className="text-xs text-gray-500 mt-1">Sukaupta per visus metus</p>
        </div>

        <div className="bg-white rounded-2xl border border-amber-200 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Heart className="h-4 w-4 text-amber-600" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Lieptui aukota
            </p>
          </div>
          <p className="text-2xl font-bold text-amber-700">{eur(totalDonations)} €</p>
          <p className="text-xs text-gray-500 mt-1">
            iš {eur(lieptasGoalCents)} € tikslo ({lieptasPercent}%)
          </p>
        </div>
      </div>

      {/* Nario mokesčiai pagal metus */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
            Nario mokesčiai pagal metus
          </h2>
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
                  // Skola = potencialas (metinis × narių) - sumokėtas metinis
                  // (NEAtimam stojamųjų ar tikslinio, kad nesusidarytų neigiama skola)
                  const debt = Math.max(0, y.potential_cents - y.metinis_collected_cents);
                  const totalEligible = y.paid_count + y.unpaid_count;
                  return (
                    <tr
                      key={y.year}
                      className="border-b border-gray-100 hover:bg-gray-50/50"
                    >
                      <td className="py-3 px-4 font-semibold text-gray-900">{y.year}</td>
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

      {/* Liepto projektas su nuoroda į pilną puslapį */}
      {lieptasGoalCents > 0 && (
        <Link
          href="/lieptas"
          className="block bg-gradient-to-br from-amber-50 via-white to-amber-50/50 rounded-2xl border-2 border-amber-200 p-5 hover:border-amber-300 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-amber-400 flex items-center justify-center shadow-sm">
              <Heart className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-0.5">
                Aukų rinkimo projektas
              </p>
              <h3 className="font-semibold text-gray-900 mb-2">
                Lieptas – padėk man atsinaujinti!
              </h3>
              <div className="flex items-baseline justify-between gap-3 text-sm mb-1.5">
                <span className="font-semibold text-gray-900">
                  {eur(totalDonations)} €
                  <span className="text-gray-400 font-normal">
                    {" "}
                    iš {eur(lieptasGoalCents)} €
                  </span>
                </span>
                <span className="text-xs text-gray-500">
                  {donations.length}{" "}
                  {donations.length === 1 ? "aukotojas" : "aukotojai"}
                </span>
              </div>
              <div className="h-2 bg-amber-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-amber-500"
                  style={{ width: `${lieptasPercent}%` }}
                />
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-amber-600 flex-shrink-0" />
          </div>
        </Link>
      )}

      {/* Aukotojų sąrašas */}
      {donations.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-amber-100 bg-amber-50/40 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
              Aukos Liepto projektui
            </h2>
            <span className="text-xs text-amber-700 font-semibold">
              {donations.length} {donations.length === 1 ? "auka" : "aukos"}
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

      {/* Finansinės ataskaitos – tik PDF dokumentai. Visi kiti dokumentai
          (įstatai, protokolai, sutartys) gyvena /dokumentai puslapyje, kad
          šis puslapis liktų sutelktas į finansus. */}
      {ataskaitos.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
              Finansinės ataskaitos
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {ataskaitos.map((doc) => (
              <DocumentLink
                key={doc.id}
                filePath={doc.file_path}
                title={doc.title}
                fileSize={doc.file_size}
                meta={formatDate(doc.published_at)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Nuoroda į pilną dokumentų archyvą */}
      <Link
        href="/dokumentai"
        className="flex items-center justify-between gap-3 bg-white rounded-2xl border border-gray-200 px-6 py-5 hover:border-green-300 hover:shadow-sm transition-all group"
      >
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-green-700" />
          <div>
            <p className="font-semibold text-gray-900">Visi bendruomenės dokumentai</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Įstatai, protokolai, ataskaitos, sutartys – pilnas archyvas
            </p>
          </div>
        </div>
        <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-green-700 transition-colors" />
      </Link>
    </div>
  );
}
