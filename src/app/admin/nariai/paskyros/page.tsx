import { getMembersAccountStatus } from "@/actions/portal-invites";
import { Card } from "@/components/ui/Card";
import { Badge, statusBadgeVariant } from "@/components/ui/Badge";
import { MEMBER_STATUS_LABELS } from "@/lib/constants";
import { ArrowLeft, UserCheck, UserX, Mail, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { InvitePanel } from "./InvitePanel";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Portalų paskyros | Administravimas",
};

export default async function AccountsPage() {
  const members = await getMembersAccountStatus();

  const withAccount = members.filter((m) => m.has_account);
  const withoutAccount = members.filter((m) => !m.has_account && m.email);
  const noEmail = members.filter((m) => !m.email);

  return (
    <div>
      <Link
        href="/admin/nariai"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Atgal į narius
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Portalų paskyros</h1>
        <p className="text-sm text-gray-500 mt-1">
          Masinis paskyrų kūrimas nariams. Sukūrus paskyrą, narys gauna el. laišką
          su slaptažodžio nustatymo nuoroda ir gali prisijungti į portalą.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <Card>
          <div className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <UserCheck className="h-4 w-4 text-green-700" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Su paskyromis
              </p>
            </div>
            <p className="text-3xl font-bold text-green-700">{withAccount.length}</p>
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <Mail className="h-4 w-4 text-blue-700" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Be paskyrų (su el. paštu)
              </p>
            </div>
            <p className="text-3xl font-bold text-blue-700">{withoutAccount.length}</p>
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Be el. pašto
              </p>
            </div>
            <p className="text-3xl font-bold text-amber-600">{noEmail.length}</p>
          </div>
        </Card>
      </div>

      <InvitePanel candidates={withoutAccount} />

      <Card className="mt-6">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
            Visi nariai ({members.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500">
                <th className="px-6 py-3 font-medium">Vardas, pavardė</th>
                <th className="px-6 py-3 font-medium">El. paštas</th>
                <th className="px-6 py-3 font-medium">Statusas</th>
                <th className="px-6 py-3 font-medium">Paskyra</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-6 py-3 font-medium text-gray-900">
                    <Link
                      href={`/admin/nariai/${m.id}`}
                      className="hover:text-blue-600"
                    >
                      {m.first_name} {m.last_name}
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-gray-600">
                    {m.email || (
                      <span className="text-amber-600 inline-flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" /> nėra
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    <Badge variant={statusBadgeVariant(m.status)}>
                      {MEMBER_STATUS_LABELS[m.status] || m.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-3">
                    {m.has_account ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded">
                        <UserCheck className="h-3 w-3" />
                        Turi ({m.is_approved ? "patvirtinta" : "laukia"})
                      </span>
                    ) : m.email ? (
                      <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2 py-1 rounded">
                        <UserX className="h-3 w-3" />
                        Neturi
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
                        Reikia el. pašto
                      </span>
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
