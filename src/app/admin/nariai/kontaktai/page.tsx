import { getMembersForContactUpdate } from "@/actions/contact-updates";
import { Card } from "@/components/ui/Card";
import { ArrowLeft, MessageSquare, AlertTriangle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { ContactUpdatePanel } from "./ContactUpdatePanel";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Kontaktų atnaujinimas | Administravimas",
};

export default async function ContactsAdminPage() {
  const members = await getMembersForContactUpdate();

  const candidates = members.filter((m) => !m.email && m.phone); // turi tel, neturi email
  const withoutPhone = members.filter((m) => !m.email && !m.phone);
  const withEmail = members.filter((m) => m.email);

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
        <h1 className="text-2xl font-bold text-gray-900">Kontaktų atnaujinimas</h1>
        <p className="text-sm text-gray-500 mt-1">
          Siųskite SMS nariams, kurie neturi el. pašto, su vienkartine nuoroda
          užpildyti savo kontaktus.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <Card>
          <div className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-4 w-4 text-green-700" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Su el. paštu
              </p>
            </div>
            <p className="text-3xl font-bold text-green-700">{withEmail.length}</p>
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="h-4 w-4 text-blue-700" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Be el. pašto (su tel.)
              </p>
            </div>
            <p className="text-3xl font-bold text-blue-700">{candidates.length}</p>
            <p className="text-xs text-gray-500 mt-1">Galima siųsti SMS</p>
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Be tel. ir el. pašto
              </p>
            </div>
            <p className="text-3xl font-bold text-amber-600">{withoutPhone.length}</p>
            <p className="text-xs text-gray-500 mt-1">Reikia rankinio pridėjimo</p>
          </div>
        </Card>
      </div>

      <ContactUpdatePanel candidates={candidates} />

      {withoutPhone.length > 0 && (
        <Card className="mt-6">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
              Be telefono ir el. pašto ({withoutPhone.length})
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Šių narių kontaktus reikia pridėti rankiniu būdu per nario kortelę.
            </p>
          </div>
          <div className="divide-y divide-gray-50">
            {withoutPhone.map((m) => (
              <Link
                key={m.id}
                href={`/admin/nariai/${m.id}`}
                className="flex items-center justify-between px-6 py-3 hover:bg-gray-50/50"
              >
                <span className="text-sm font-medium text-gray-900">
                  {m.first_name} {m.last_name}
                </span>
                <span className="text-xs text-amber-700">Redaguoti →</span>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
