import { getVotingTokenData } from "@/actions/tokens";
import { VotingFlow } from "./VotingFlow";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { COMMUNITY_LEGAL } from "@/lib/constants";

export const metadata = {
  title: "Balsavimas",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";

interface TokenData {
  error?: string;
  voted_at?: string;
  meeting?: {
    id: string;
    title: string;
    description: string | null;
    meeting_date: string;
    location: string;
  };
  member?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
  };
  resolutions?: {
    id: string;
    resolution_number: number;
    title: string;
    description: string | null;
    requires_qualified_majority: boolean;
    is_procedural: boolean;
    documents: {
      id: string;
      title: string;
      file_path: string;
      file_name: string;
      file_size: number | null;
      category: string;
    }[];
  }[];
  expires_at?: string;
  live_intent_at?: string | null;
}

export default async function VotingPage({ params }: { params: { token: string } }) {
  const data = (await getVotingTokenData(params.token)) as TokenData;

  if (!data || data.error) {
    return <ErrorView code={data?.error || "invalid_token"} votedAt={data?.voted_at} />;
  }

  if (!data.meeting || !data.member || !data.resolutions) {
    return <ErrorView code="invalid_token" />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-5">
          <h1 className="text-lg font-semibold text-gray-900">{COMMUNITY_LEGAL.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">Nuotolinis balsavimas</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <VotingFlow token={params.token} data={data as Required<TokenData>} />
      </main>

      <footer className="max-w-3xl mx-auto px-4 py-8 text-center text-xs text-gray-400">
        {COMMUNITY_LEGAL.name} · Įm. kodas {COMMUNITY_LEGAL.code} · {COMMUNITY_LEGAL.address}
      </footer>
    </div>
  );
}

function ErrorView({ code, votedAt }: { code: string; votedAt?: string }) {
  const messages: Record<string, { icon: React.ReactNode; title: string; text: string }> = {
    invalid_token: {
      icon: <XCircle className="h-12 w-12 text-red-500" />,
      title: "Neteisinga nuoroda",
      text: "Nuoroda negaliojanti arba neteisinga. Susisiekite su bendruomenės pirmininku.",
    },
    already_voted: {
      icon: <CheckCircle2 className="h-12 w-12 text-green-500" />,
      title: "Jūs jau balsavote",
      text: votedAt
        ? `Jūsų balsas užregistruotas ${new Date(votedAt).toLocaleString("lt-LT")}. Ačiū!`
        : "Jūsų balsas jau užregistruotas. Ačiū!",
    },
    expired: {
      icon: <Clock className="h-12 w-12 text-amber-500" />,
      title: "Balsavimo laikas baigėsi",
      text: "Šios nuorodos galiojimas pasibaigė – susirinkimas jau prasidėjo arba pasibaigė.",
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
