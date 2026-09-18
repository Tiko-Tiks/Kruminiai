import { getDeclarationStats } from "@/actions/declarations";
import { getMembersWithDebts } from "@/actions/reminders";
import { DeclarationAdminPanel } from "./DeclarationAdminPanel";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { isoToVilniusLocal } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Numatytoji kampanijos pabaiga – po 14 d. Skaičiuojama serveryje, kad
// klientinis komponentas nesiskirtų nuo SSR rezultato.
const DEFAULT_EXPIRY_DAYS = 14;

export default async function DeclarationAdminPage() {
  const stats = await getDeclarationStats();
  const defaultExpiresAt = isoToVilniusLocal(
    new Date(Date.now() + DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
  ).slice(0, 10);

  // Gavėjai matomi PRIEŠ siuntimą: deklaracija siunčiama tik skolingiems, o SMS
  // pasiekia tik tuos, kurie turi telefono numerį.
  const { members: debtors } = await getMembersWithDebts();
  const recipients = {
    total: debtors.length,
    withPhone: debtors.filter((m) => !!m.phone).length,
  };

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
        defaultExpiresAt={defaultExpiresAt}
        recipients={recipients}
      />
    </div>
  );
}
