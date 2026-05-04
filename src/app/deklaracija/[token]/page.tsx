import { getDeclarationTokenData } from "@/actions/declarations";
import { DeclarationForm } from "./DeclarationForm";
import { COMMUNITY_LEGAL } from "@/lib/constants";
import { XCircle, Clock } from "lucide-react";

export const metadata = {
  title: "Narystės patvirtinimas",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";

interface TokenData {
  error?: string;
  member?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
  };
  declaration?: {
    submitted_at: string | null;
    intent: string | null;
    email: string | null;
    notes: string | null;
  };
  debt?: {
    unpaid_periods: { fee_period_id: string; year: number; amount_cents: number }[];
    total_cents: number;
  };
  expires_at?: string;
}

export default async function DeclarationPage({ params }: { params: { token: string } }) {
  const data = (await getDeclarationTokenData(params.token)) as TokenData;

  if (!data || data.error) {
    return <ErrorView code={data?.error || "invalid_token"} />;
  }

  if (!data.member || !data.declaration) {
    return <ErrorView code="invalid_token" />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-5">
          <h1 className="text-lg font-semibold text-gray-900">{COMMUNITY_LEGAL.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">Nario duomenų patvirtinimas</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <DeclarationForm
          token={params.token}
          member={data.member}
          existingDeclaration={data.declaration}
          debt={data.debt}
        />
      </main>

      <footer className="max-w-2xl mx-auto px-4 py-8 text-center text-xs text-gray-400">
        {COMMUNITY_LEGAL.name} · Įm. kodas {COMMUNITY_LEGAL.code} · {COMMUNITY_LEGAL.address}
      </footer>
    </div>
  );
}

function ErrorView({ code }: { code: string }) {
  const messages: Record<string, { icon: React.ReactNode; title: string; text: string }> = {
    invalid_token: {
      icon: <XCircle className="h-12 w-12 text-red-500" />,
      title: "Neteisinga nuoroda",
      text: "Nuoroda negaliojanti. Susisiekite su bendruomenės pirmininku.",
    },
    expired: {
      icon: <Clock className="h-12 w-12 text-amber-500" />,
      title: "Terminas pasibaigęs",
      text: "Šios nuorodos galiojimas pasibaigė – susirinkimas jau prasidėjo.",
    },
  };

  const m = messages[code] || messages.invalid_token;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 max-w-md w-full text-center">
        <div className="flex justify-center mb-4">{m.icon}</div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">{m.title}</h1>
        <p className="text-sm text-gray-600">{m.text}</p>
      </div>
    </div>
  );
}
