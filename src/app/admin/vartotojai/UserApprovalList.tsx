"use client";

import { useState } from "react";
import { approveUser, revokeUser } from "@/actions/users";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, Clock } from "lucide-react";

interface Profile {
  id: string;
  full_name: string;
  role: string;
  is_approved: boolean;
  member_id: string | null;
  management_role: string | null;
  created_at: string;
}

/**
 * Etiketė rodoma po vartotojo vardo. Prioritetas:
 *   1. Sistemos rolė (super_admin, admin) – jei tai admin'as
 *   2. Valdymo organas iš community_management (pirmininkas / tarybos
 *      narys / revizorius)
 *   3. „Narys" – paprastas portalo vartotojas
 *
 * profiles.role visada turi būti 'member' eiliniam nariui (taip kuriama
 * per bulk-invite). „Administratorius" rodom TIK kai role='admin'.
 */
function getRoleLabel(profile: Profile): { label: string; tone: "admin" | "board" | "member" } {
  if (profile.role === "super_admin") return { label: "Super admin", tone: "admin" };
  if (profile.role === "admin") return { label: "Administratorius", tone: "admin" };
  if (profile.management_role === "pirmininkas") return { label: "Pirmininkas", tone: "board" };
  if (profile.management_role === "tarybos_narys") return { label: "Tarybos narys", tone: "board" };
  if (profile.management_role === "revizorius") return { label: "Revizorius", tone: "board" };
  return { label: "Narys", tone: "member" };
}

export function UserApprovalList({ profiles }: { profiles: Profile[] }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleApprove = async (id: string, name: string) => {
    // Narystė patvirtinama TIK gavus apmokėjimą (stojamasis + nario mokestis).
    if (
      !confirm(
        `Patvirtinti narystę: ${name}?\n\nTvirtinkite tik GAVĘ apmokėjimą (stojamasis + nario mokestis). ` +
          `Patvirtinus, narys gaus prieigą prie portalo ir pasveikinimo laišką.`
      )
    ) {
      return;
    }
    setLoading(id);
    setError(null);
    // Patvirtinant per server action'ą – jis ne tik nustato is_approved=true,
    // bet ir užtikrina, kad žmogus atsiranda narių registre + patvirtina el.
    // paštą, kad galėtų prisijungti (žr. approveUser).
    const res = await approveUser(id);
    if (res?.error) setError(res.error);
    router.refresh();
    setLoading(null);
  };

  const handleRevoke = async (id: string) => {
    setLoading(id);
    setError(null);
    const res = await revokeUser(id);
    if (res?.error) setError(res.error);
    router.refresh();
    setLoading(null);
  };

  const pending = profiles.filter((p) => !p.is_approved);
  const approved = profiles.filter((p) => p.is_approved);

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      {/* Laukiantys patvirtinimo */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Clock className="h-5 w-5 text-amber-500" />
          Laukiantys patvirtinimo ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
            Nėra laukiančių patvirtinimo
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {pending.map((profile) => (
              <div key={profile.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="font-medium text-gray-900">{profile.full_name}</p>
                  <p className="text-xs text-gray-400">
                    Registruotas: {new Date(profile.created_at).toLocaleDateString("lt-LT")}
                  </p>
                </div>
                <button
                  onClick={() => handleApprove(profile.id, profile.full_name)}
                  disabled={loading === profile.id}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-700 text-white text-sm font-medium hover:bg-green-600 disabled:opacity-50 transition-colors"
                >
                  <CheckCircle className="h-4 w-4" />
                  {loading === profile.id ? "..." : "Patvirtinti"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Patvirtinti vartotojai */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          Patvirtinti ({approved.length})
        </h2>
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {approved.map((profile) => {
            const role = getRoleLabel(profile);
            const colorClass =
              role.tone === "admin"
                ? "text-blue-600"
                : role.tone === "board"
                  ? "text-amber-700 font-medium"
                  : "text-gray-400";
            return (
              <div
                key={profile.id}
                className="flex items-center justify-between px-5 py-4"
              >
                <div>
                  <p className="font-medium text-gray-900">{profile.full_name}</p>
                  <p className={`text-xs ${colorClass}`}>{role.label}</p>
                </div>
                <button
                  onClick={() => handleRevoke(profile.id)}
                  disabled={loading === profile.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 text-xs font-medium hover:bg-red-50 hover:text-red-600 hover:border-red-200 disabled:opacity-50 transition-colors"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  {loading === profile.id ? "..." : "Atšaukti"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
