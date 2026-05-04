"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { generateAndSendDeclarations, resendDeclarationSms } from "@/actions/declarations";
import {
  Send,
  RotateCcw,
  Users,
  CheckCircle2,
  Clock,
  Banknote,
  CreditCard,
  UserMinus,
  Phone,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

interface DeclarationRow {
  id: string;
  token: string;
  sent_at: string | null;
  submitted_at: string | null;
  intent: string | null;
  email: string | null;
  notes: string | null;
  member:
    | {
        id: string;
        first_name: string;
        last_name: string;
        phone: string | null;
        email: string | null;
        status: string;
      }
    | { id: string; first_name: string; last_name: string; phone: string | null; email: string | null; status: string }[]
    | null;
}

interface Stats {
  total: number;
  sent: number;
  submitted: number;
  pending: number;
  continue_cash: number;
  continue_transfer: number;
  withdraw: number;
  declarations: DeclarationRow[];
}

const INTENT_LABEL: Record<string, string> = {
  continue_cash: "Tęsia – grynais",
  continue_transfer: "Tęsia – pavedimu",
  withdraw: "Atsisako",
};

const INTENT_STYLE: Record<string, string> = {
  continue_cash: "bg-green-50 text-green-700 border-green-200",
  continue_transfer: "bg-blue-50 text-blue-700 border-blue-200",
  withdraw: "bg-red-50 text-red-700 border-red-200",
};

export function DeclarationAdminPanel({ stats }: { stats: Stats }) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [resending, setResending] = useState(false);
  const [filter, setFilter] = useState<"all" | "submitted" | "pending" | "withdraw">("all");

  async function handleSend() {
    if (!confirm("Siųsti SMS visiems aktyviems nariams su narystės patvirtinimo nuoroda?")) return;
    setSending(true);
    const result = await generateAndSendDeclarations();
    setSending(false);

    if (!result.success) {
      toast.error(result.error || "Klaida");
      return;
    }
    toast.success(
      `Išsiųsta ${result.smsSent} SMS${result.smsSkipped ? ` (${result.smsSkipped} praleisti)` : ""}`
    );
    router.refresh();
  }

  async function handleResend() {
    if (!confirm(`Siųsti priminimą ${stats.pending} nariams, kurie dar neatsakė?`)) return;
    setResending(true);
    const result = await resendDeclarationSms();
    setResending(false);

    if (!result.success) {
      toast.error("Klaida");
      return;
    }
    toast.success(`Priminimo SMS išsiųsta: ${result.smsSent}`);
    router.refresh();
  }

  const filtered = stats.declarations.filter((d) => {
    if (filter === "all") return true;
    if (filter === "submitted") return !!d.submitted_at;
    if (filter === "pending") return !d.submitted_at;
    if (filter === "withdraw") return d.intent === "withdraw";
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Statistikos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<Users className="h-4 w-4 text-gray-500" />}
          label="Iš viso išsiųsta"
          value={stats.sent}
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4 text-green-600" />}
          label="Atsakė"
          value={stats.submitted}
          color="text-green-700"
        />
        <StatCard
          icon={<Clock className="h-4 w-4 text-amber-600" />}
          label="Laukia"
          value={stats.pending}
          color="text-amber-700"
        />
        <StatCard
          icon={<UserMinus className="h-4 w-4 text-red-600" />}
          label="Atsisako narystės"
          value={stats.withdraw}
          color="text-red-700"
        />
      </div>

      {/* Sumokėjimo intencija */}
      {stats.submitted > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <BreakdownCard
            icon={<Banknote className="h-5 w-5 text-green-700" />}
            label="Tęs narystę – grynais"
            value={stats.continue_cash}
          />
          <BreakdownCard
            icon={<CreditCard className="h-5 w-5 text-blue-700" />}
            label="Tęs narystę – pavedimu"
            value={stats.continue_transfer}
          />
          <BreakdownCard
            icon={<UserMinus className="h-5 w-5 text-red-600" />}
            label="Atsisako narystės"
            value={stats.withdraw}
          />
        </div>
      )}

      {/* Veiksmai */}
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-gray-900">SMS siuntimas</h2>
        </CardHeader>
        <CardContent>
          {stats.total === 0 ? (
            <div className="text-center py-3">
              <p className="text-sm text-gray-600 mb-3">
                Tokenai dar nesugeneruoti. Paspauskit, kad sukurtų ir išsiųstų SMS visiems aktyviems
                nariams.
              </p>
              <Button onClick={handleSend} loading={sending}>
                <Send className="h-4 w-4" />
                Siųsti SMS visiems nariams
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSend} loading={sending} variant="outline">
                <Send className="h-4 w-4" />
                Siųsti naujiems nariams
              </Button>
              <Button
                onClick={handleResend}
                loading={resending}
                disabled={stats.pending === 0}
                variant="outline"
              >
                <RotateCcw className="h-4 w-4" />
                Priminimas neatsakiusiems ({stats.pending})
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sąrašas su filtru */}
      {stats.total > 0 && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-gray-900">Atsakymai</h2>
              <div className="flex flex-wrap gap-1.5">
                <FilterBtn active={filter === "all"} onClick={() => setFilter("all")}>
                  Visi ({stats.total})
                </FilterBtn>
                <FilterBtn
                  active={filter === "submitted"}
                  onClick={() => setFilter("submitted")}
                >
                  Atsakė ({stats.submitted})
                </FilterBtn>
                <FilterBtn active={filter === "pending"} onClick={() => setFilter("pending")}>
                  Laukia ({stats.pending})
                </FilterBtn>
                <FilterBtn active={filter === "withdraw"} onClick={() => setFilter("withdraw")}>
                  Atsisako ({stats.withdraw})
                </FilterBtn>
              </div>
            </div>
          </CardHeader>
          <div className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <p className="px-5 py-8 text-sm text-gray-400 text-center">Nėra įrašų</p>
            ) : (
              filtered.map((d) => {
                const m = Array.isArray(d.member) ? d.member[0] : d.member;
                if (!m) return null;
                return (
                  <div key={d.id} className="px-5 py-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm text-gray-900">
                          {m.first_name} {m.last_name}
                        </span>
                        {!m.phone && (
                          <span className="text-xs text-gray-400" title="Be telefono">
                            <Phone className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                      {d.notes && (
                        <p className="text-xs text-gray-600 italic mt-1 line-clamp-2">
                          „{d.notes}&rdquo;
                        </p>
                      )}
                      {d.email && (
                        <p className="text-xs text-gray-500 mt-1">{d.email}</p>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-right">
                      {d.submitted_at && d.intent ? (
                        <>
                          <span
                            className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border ${INTENT_STYLE[d.intent]}`}
                          >
                            {INTENT_LABEL[d.intent]}
                          </span>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatDate(d.submitted_at)}
                          </p>
                        </>
                      ) : d.sent_at ? (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-medium">
                          <Clock className="h-3 w-3" /> Laukia
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Neišsiųsta</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color = "text-gray-900",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
      <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500 mb-1">
        {icon}
        {label}
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function BreakdownCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
      <div className="flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function FilterBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
        active ? "bg-green-700 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
      }`}
    >
      {children}
    </button>
  );
}
