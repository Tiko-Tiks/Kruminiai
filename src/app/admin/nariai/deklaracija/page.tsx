import { getDeclarationStats } from "@/actions/declarations";
import { getMembersWithDebts } from "@/actions/reminders";
import { DeclarationAdminPanel } from "./DeclarationAdminPanel";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { isoToVilniusLocal } from "@/lib/utils";
import { declarationExpiryBounds } from "@/lib/notification-texts";

export const dynamic = "force-dynamic";

export default async function DeclarationAdminPage() {
  const stats = await getDeclarationStats();

  // Numatytoji ir anksčiausia galiojimo data – iš to paties šaltinio kaip
  // server action'o validacija, kad forma nepriimtų to, ką serveris atmes.
  // Skaičiuojama serveryje, kad klientas nesiskirtų nuo SSR rezultato.
  const expiry = declarationExpiryBounds(isoToVilniusLocal(new Date()).slice(0, 10));

  // Gavėjai matomi PRIEŠ siuntimą: deklaracija siunčiama tik skolingiems, o SMS
  // pasiekia tik tuos, kurie turi telefono numerį.
  const { members: debtors } = await getMembersWithDebts();
  const declaredIds = new Set(stats.declarations.flatMap((d) => {
    const member = Array.isArray(d.member) ? d.member[0] : d.member;
    return member ? [member.id] : [];
  }));
  const newDebtors = debtors.filter((m) => !declaredIds.has(m.id));
  const recipients = {
    total: newDebtors.length,
    withPhone: newDebtors.filter((m) => !!m.phone).length,
  };

  // Priminimas siunčiamas tik tiems, kurie DABAR yra skolingi ir turi telefoną –
  // toks pat filtras kaip `resendDeclarationSms`, kad mygtuko skaičius atitiktų
  // tikrovę (sumokėjęs, bet formos nepateikęs narys į jį nebepatenka).
  const debtorIds = new Set(debtors.map((m) => m.id));
  const pendingDebtors = stats.declarations.filter((d) => {
    if (d.submitted_at) return false;
    const member = Array.isArray(d.member) ? d.member[0] : d.member;
    return !!member?.phone && debtorIds.has(member.id);
  }).length;

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
        <h1 className="text-2xl font-bold text-gray-900">Narystės deklaracija</h1>
        <p className="text-sm text-gray-500 mt-1">
          Prieš susirinkimą – nariai patvirtina, ar tęs narystę
        </p>
      </div>

      <DeclarationAdminPanel
        stats={stats}
        expiry={expiry}
        recipients={recipients}
        pendingDebtors={pendingDebtors}
      />
    </div>
  );
}
