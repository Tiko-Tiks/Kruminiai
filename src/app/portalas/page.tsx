import { getMemberActiveMeetings, getMemberFinancialStatus, getMemberProfile } from "@/actions/portal";
import { formatDateLong, formatCurrency, vocative } from "@/lib/utils";
import { Calendar, MapPin, Vote, Banknote, AlertCircle, CheckCircle2, ArrowRight, FileText, History } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface MeetingItem {
  id: string;
  title: string;
  meeting_date: string;
  location: string;
  status: string;
  has_voted: boolean;
}

interface FinancialUnpaid {
  fee_period_id: string;
  year: number;
  name: string;
  amount_cents: number;
  is_overdue: boolean;
}

export default async function PortalDashboard() {
  const [profileData, meetingsData, financialData] = await Promise.all([
    getMemberProfile(),
    getMemberActiveMeetings(),
    getMemberFinancialStatus(),
  ]);

  type ProfileResult = { profile?: { full_name: string }; member?: { first_name: string; status: string } | null; error?: string };
  type MeetingsResult = { meetings?: MeetingItem[]; error?: string };
  type FinancialResult = { unpaid?: FinancialUnpaid[]; total_debt_cents?: number; error?: string };

  const profile = profileData as ProfileResult;
  const meetings = meetingsData as MeetingsResult;
  const financial = financialData as FinancialResult;

  const noMemberLink = profile?.error === "no_member_link" || !profile?.member;
  const firstName = profile?.member?.first_name || "";
  const greeting = firstName ? `Sveiki, ${vocative(firstName)}!` : "Sveiki!";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{greeting}</h1>
        <p className="text-sm text-gray-500 mt-1">Krūminių kaimo bendruomenės narių portalas</p>
      </div>

      {noMemberLink && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">Paskyra nesusieta su nario įrašu</p>
              <p>
                Susisiekite su bendruomenės administratoriumi, kad jūsų paskyrą susietų su nario duomenimis. Tada galėsite balsuoti, matyti finansų informaciją ir kitas funkcijas.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/portalas/balsavimai"
          className="bg-white rounded-xl border border-gray-200 p-5 hover:border-green-300 hover:shadow-sm transition-all group"
        >
          <div className="flex items-start justify-between mb-3">
            <Vote className="h-6 w-6 text-green-700" />
            <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {meetings?.meetings?.filter((m) => !m.has_voted).length ?? 0}
          </p>
          <p className="text-sm text-gray-500">aktyvių balsavimų</p>
        </Link>

        <Link
          href="/portalas/finansai"
          className={`rounded-xl border p-5 transition-all group ${
            (financial?.total_debt_cents ?? 0) > 0
              ? "bg-red-50 border-red-200 hover:border-red-300"
              : "bg-white border-gray-200 hover:border-green-300 hover:shadow-sm"
          }`}
        >
          <div className="flex items-start justify-between mb-3">
            <Banknote
              className={`h-6 w-6 ${(financial?.total_debt_cents ?? 0) > 0 ? "text-red-600" : "text-green-700"}`}
            />
            <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500" />
          </div>
          <p
            className={`text-2xl font-bold ${(financial?.total_debt_cents ?? 0) > 0 ? "text-red-700" : "text-gray-900"}`}
          >
            {formatCurrency(financial?.total_debt_cents ?? 0)}
          </p>
          <p className="text-sm text-gray-500">
            {(financial?.total_debt_cents ?? 0) > 0 ? "neapmokėta" : "skolų nėra"}
          </p>
        </Link>

        <Link
          href="/portalas/istorija"
          className="bg-white rounded-xl border border-gray-200 p-5 hover:border-green-300 hover:shadow-sm transition-all group"
        >
          <div className="flex items-start justify-between mb-3">
            <History className="h-6 w-6 text-green-700" />
            <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {meetings?.meetings?.filter((m) => m.has_voted).length ?? 0}
          </p>
          <p className="text-sm text-gray-500">balsavimo įrašų</p>
        </Link>
      </div>

      {/* Aktyvūs balsavimai */}
      {(meetings?.meetings?.length ?? 0) > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Artėjantys susirinkimai</h2>
            <Link
              href="/portalas/balsavimai"
              className="text-sm text-green-700 hover:text-green-800 font-medium"
            >
              Visi →
            </Link>
          </div>
          <div className="space-y-3">
            {meetings!.meetings!.slice(0, 3).map((m) => (
              <Link
                key={m.id}
                href={`/portalas/balsavimai/${m.id}`}
                className="block p-4 rounded-lg border border-gray-100 hover:border-green-200 hover:bg-green-50/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 mb-1">{m.title}</h3>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDateLong(m.meeting_date)}{" "}
                        {new Date(m.meeting_date).toLocaleTimeString("lt-LT", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {m.location}
                      </span>
                    </div>
                  </div>
                  {m.has_voted ? (
                    <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-1 rounded font-medium flex-shrink-0">
                      <CheckCircle2 className="h-3 w-3" /> Balsavote
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-2 py-1 rounded font-medium flex-shrink-0">
                      Balsuokite
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Greitos nuorodos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/dokumentai"
          className="bg-white rounded-xl border border-gray-200 p-5 hover:border-green-300 hover:shadow-sm transition-all group flex items-start gap-3"
        >
          <FileText className="h-6 w-6 text-green-700 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 group-hover:text-green-700">Dokumentai</h3>
            <p className="text-sm text-gray-500">Įstatai, protokolai, ataskaitos</p>
          </div>
        </Link>
        <Link
          href="/portalas/profilis"
          className="bg-white rounded-xl border border-gray-200 p-5 hover:border-green-300 hover:shadow-sm transition-all group flex items-start gap-3"
        >
          <FileText className="h-6 w-6 text-green-700 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 group-hover:text-green-700">Mano duomenys</h3>
            <p className="text-sm text-gray-500">Atnaujinkite kontaktus ir duomenis</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
