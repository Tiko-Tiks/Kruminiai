import { getMemberActivity } from "@/actions/activity";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  Users,
  Activity,
  Clock,
  UserCheck,
  UserX,
  Calendar,
  AlertCircle,
} from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Aktyvumas | Administravimas",
};

function formatRelative(lastLogin: string | null, daysSince: number | null): string {
  if (!lastLogin || daysSince === null) return "Niekada";
  if (daysSince === 0) return "Šiandien";
  if (daysSince === 1) return "Vakar";
  if (daysSince < 7) return `Prieš ${daysSince} d.`;
  if (daysSince < 30) return `Prieš ${Math.floor(daysSince / 7)} sav.`;
  if (daysSince < 365) return `Prieš ${Math.floor(daysSince / 30)} mėn.`;
  return `Prieš ${Math.floor(daysSince / 365)} m.`;
}

function activityColor(daysSince: number | null): string {
  if (daysSince === null) return "text-gray-400";
  if (daysSince <= 7) return "text-green-700 font-medium";
  if (daysSince <= 30) return "text-blue-700";
  if (daysSince <= 90) return "text-amber-700";
  return "text-gray-500";
}

export default async function ActivityPage() {
  const data = await getMemberActivity();

  if (data.unavailable) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Aktyvumas</h1>
        <Card>
          <div className="p-6 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900 mb-1">
                Auth duomenys nepasiekiami
              </p>
              <p className="text-sm text-gray-600">
                Trūksta SUPABASE_SERVICE_ROLE_KEY env var&apos;o. Pridėkite jį
                prie .env.local IR Vercel Dashboard&apos;o, kad būtų galima gauti
                auth.users last_sign_in_at duomenis.
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Narių aktyvumas</h1>
        <p className="text-sm text-gray-500 mt-1">
          Portalo prisijungimo statistika ir narių aktyvumas
        </p>
      </div>

      {/* Pagrindinės kortelės */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card>
          <div className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-gray-500" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Iš viso paskyrų
              </p>
            </div>
            <p className="text-3xl font-bold text-gray-900">{data.total_accounts}</p>
            {data.pending_approval > 0 && (
              <p className="text-xs text-amber-600 mt-1">
                {data.pending_approval} laukia patvirtinimo
              </p>
            )}
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <UserCheck className="h-4 w-4 text-green-700" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Prisijungę
              </p>
            </div>
            <p className="text-3xl font-bold text-green-700">{data.ever_signed_in}</p>
            <p className="text-xs text-gray-500 mt-1">
              {data.total_accounts > 0
                ? `${Math.round((data.ever_signed_in / data.total_accounts) * 100)}% iš visų`
                : "—"}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-4 w-4 text-blue-700" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Aktyvūs (30 d.)
              </p>
            </div>
            <p className="text-3xl font-bold text-blue-700">{data.active_30d}</p>
            <p className="text-xs text-gray-500 mt-1">
              7 d.: {data.active_7d} · 90 d.: {data.active_90d}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <UserX className="h-4 w-4 text-gray-500" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Niekada
              </p>
            </div>
            <p className="text-3xl font-bold text-gray-500">{data.never_signed_in}</p>
            <p className="text-xs text-gray-500 mt-1">
              Sukurta paskyra, bet dar neprisijungę
            </p>
          </div>
        </Card>
      </div>

      {/* Aiškinimas */}
      <Card className="bg-blue-50/30 border-blue-200 mb-6">
        <div className="p-4 text-xs text-gray-700 space-y-2">
          <div className="flex items-start gap-2">
            <Clock className="h-4 w-4 text-blue-700 flex-shrink-0 mt-0.5" />
            <p>
              <strong className="text-gray-900">Prisijungimo spalvos:</strong>{" "}
              <span className="text-green-700 font-medium">žalia</span> – per 7 d. ·{" "}
              <span className="text-blue-700">mėlyna</span> – per 30 d. ·{" "}
              <span className="text-amber-700">gintaras</span> – per 90 d. ·{" "}
              <span className="text-gray-500">pilka</span> – seniau arba niekada
            </p>
          </div>
          <div className="flex items-start gap-2">
            <UserCheck className="h-4 w-4 text-green-700 flex-shrink-0 mt-0.5" />
            <p>
              <strong className="text-gray-900">Statusai:</strong>{" "}
              <strong className="text-yellow-700">Laukia patvirtinimo</strong> – pats
              užsiregistravo, admin&apos;as dar nepatvirtino ·{" "}
              <strong className="text-green-700">Aktyvi</strong> – patvirtinta
              paskyra, narys bent kartą prisijungė ·{" "}
              <strong className="text-blue-700">Pakviesta</strong> – paskyra
              sukurta ir patvirtinta, bet narys dar neprisijungė (negavo / neaktyvavo
              welcome laiško)
            </p>
          </div>
        </div>
      </Card>

      {/* Narių lentelė */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500">
                <th className="px-6 py-3 font-medium">Vartotojas</th>
                <th className="px-6 py-3 font-medium">El. paštas</th>
                <th className="px-6 py-3 font-medium">Paskutinis prisijungimas</th>
                <th className="px-6 py-3 font-medium">Paskyros sukurta</th>
                <th className="px-6 py-3 font-medium">Statusas</th>
              </tr>
            </thead>
            <tbody>
              {data.members.map((m) => (
                <tr key={m.profile_id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-6 py-3 font-medium text-gray-900">{m.full_name}</td>
                  <td className="px-6 py-3 text-gray-600 text-xs font-mono">{m.email}</td>
                  <td className={`px-6 py-3 ${activityColor(m.days_since_last_login)}`}>
                    {formatRelative(m.last_sign_in_at, m.days_since_last_login)}
                  </td>
                  <td className="px-6 py-3 text-gray-500 text-xs whitespace-nowrap">
                    <Calendar className="h-3 w-3 inline mr-1" />
                    {new Date(m.created_at).toLocaleDateString("lt-LT")}
                  </td>
                  <td className="px-6 py-3">
                    {!m.is_approved ? (
                      <Badge variant="warning">Laukia patvirtinimo</Badge>
                    ) : m.has_signed_in ? (
                      <Badge variant="success">Aktyvi</Badge>
                    ) : (
                      <Badge variant="info">Pakviesta</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
