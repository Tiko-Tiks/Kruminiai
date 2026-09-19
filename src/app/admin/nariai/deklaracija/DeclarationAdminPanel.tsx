"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { DatePicker } from "@/components/ui/DatePicker";
import { generateAndSendDeclarations, resendDeclarationSms } from "@/actions/declarations";
import {
  declarationReminderSmsText,
  declarationSmsText,
  isCalendarDate,
  smsSegments,
} from "@/lib/notification-texts";
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
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

interface DeclarationRow {
  id: string;
  token: string;
  sent_at: string | null;
  viewed_at: string | null;
  view_count: number | null;
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
  viewed: number;
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

// Peržiūros pavyzdys – tikslus tekstas, kurį gaus narys (tik vardas ir tokenas
// pakeisti pavyzdiniais). Naudojamos tos pačios funkcijos kaip siunčiant.
const PREVIEW_NAME = "Vardas";
const PREVIEW_URL = `https://kruminiai.lt/deklaracija/${"0".repeat(32)}`;

/**
 * Praleistųjų paaiškinimas pranešime. `expiryFailed` rodomas atskirai – tai ne
 * „be telefono", o nepavykęs galiojimo įrašas, todėl SMS sąmoningai nesiųsta.
 */
function skippedSuffix(skipped: number, expiryFailed: number): string {
  const parts: string[] = [];
  if (skipped > 0) parts.push(`${skipped} praleista`);
  if (expiryFailed > 0) parts.push(`${expiryFailed} be galiojimo įrašo – nesiųsta`);
  return parts.length > 0 ? ` (${parts.join(", ")})` : "";
}

export function DeclarationAdminPanel({
  stats,
  expiry,
  recipients,
  pendingDebtors,
}: {
  stats: Stats;
  /** Galiojimo ribos iš `declarationExpiryBounds` – ta pati logika kaip serverio validacijoje. */
  expiry: { min: string; default: string; responseDays: number };
  recipients: { total: number; withPhone: number };
  /** Neatsakiusieji, kurie DABAR yra skolingi ir turi telefoną – tik jiems eina priminimas. */
  pendingDebtors: number;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [sending, setSending] = useState(false);
  const [resending, setResending] = useState(false);
  const [filter, setFilter] = useState<"all" | "submitted" | "viewed" | "pending" | "withdraw">("all");

  function readExpiresAt(): string {
    if (!formRef.current) return "";
    const value = new FormData(formRef.current).get("expires_at");
    return typeof value === "string" ? value.trim() : "";
  }

  /**
   * Tos pačios patikros kaip server action'e – kad patvirtinimo lange nebūtų
   * rodoma diena, kurios kalendoriuje nėra (pvz. vasario 30), nei terminas,
   * trumpesnis už gavėjui žadamą atsakymo langą.
   */
  function checkedExpiresAt(): string | null {
    const value = readExpiresAt();
    if (!value) {
      toast.error("Nurodykite, iki kada nuoroda galioja");
      return null;
    }
    if (!isCalendarDate(value)) {
      toast.error("Tokios datos kalendoriuje nėra");
      return null;
    }
    if (value < expiry.min) {
      toast.error(
        `Galiojimo data turi būti bent ${expiry.responseDays} dienos nuo šiandien ` +
          `(anksčiausia – ${expiry.min})`
      );
      return null;
    }
    return value;
  }

  async function handleSend() {
    const expiresAt = checkedExpiresAt();
    if (!expiresAt) return;
    if (
      !confirm(
        `Siųsti SMS tik skolingiems nariams, kurie dar neturi deklaracijos?\nNuoroda galios iki ${expiresAt} (imtinai).`
      )
    )
      return;
    setSending(true);
    const result = await generateAndSendDeclarations(expiresAt);
    setSending(false);

    if (!result.success) {
      toast.error(result.error || "Klaida");
      return;
    }
    toast.success(
      `Išsiųsta ${result.smsSent} SMS${skippedSuffix(result.smsSkipped, result.expiryFailed)}`
    );
    router.refresh();
  }

  async function handleResend() {
    const expiresAt = checkedExpiresAt();
    if (!expiresAt) return;
    if (
      !confirm(
        `Siųsti priminimą ${pendingDebtors} nariams, kurie dar neatsakė ir tebėra skolingi?\nNuoroda galios iki ${expiresAt} (imtinai).`
      )
    )
      return;
    setResending(true);
    const result = await resendDeclarationSms(expiresAt);
    setResending(false);

    if (!result.success) {
      toast.error(result.errors[0] || "Klaida");
      return;
    }
    toast.success(
      `Priminimo SMS išsiųsta: ${result.smsSent}${skippedSuffix(result.skipped, result.expiryFailed)}`
    );
    router.refresh();
  }

  const firstSms = declarationSmsText({
    locale: "lt",
    firstName: PREVIEW_NAME,
    url: PREVIEW_URL,
  });
  const reminderSms = declarationReminderSmsText({
    locale: "lt",
    firstName: PREVIEW_NAME,
    url: PREVIEW_URL,
  });

  const filtered = stats.declarations.filter((d) => {
    if (filter === "all") return true;
    if (filter === "submitted") return !!d.submitted_at;
    if (filter === "viewed") return !!d.viewed_at && !d.submitted_at;
    if (filter === "pending") return !d.submitted_at;
    if (filter === "withdraw") return d.intent === "withdraw";
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Statistikos */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard
          icon={<Users className="h-4 w-4 text-gray-500" />}
          label="Iš viso išsiųsta"
          value={stats.sent}
        />
        <StatCard
          icon={<Eye className="h-4 w-4 text-purple-600" />}
          label="Atidarė (be atsakymo)"
          value={stats.viewed}
          color="text-purple-700"
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
          <form ref={formRef} onSubmit={(e) => e.preventDefault()} className="space-y-4">
            <p className="text-sm text-gray-700">
              Gavėjai: <strong>{recipients.withPhone}</strong> skolingi nariai su telefono
              numeriu
              {recipients.total > recipients.withPhone
                ? ` (iš ${recipients.total}; likusiems SMS neišsiųsime)`
                : ""}
              .
            </p>

            <div className="max-w-xs">
              <DatePicker
                name="expires_at"
                label="Nuoroda galioja iki (imtinai)"
                defaultValue={expiry.default}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Galiojimas įrašomas kiekvienam šios kampanijos tokenui – ir naujam, ir
                pakartotinai siunčiamam. Anksčiausia galima data – <strong>{expiry.min}</strong>,
                minimalus atsakymo langas yra {expiry.responseDays} d.
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
              <p className="text-xs font-medium text-gray-700">
                Tekstas, kurį gaus narys (vardas ir nuoroda – pavyzdiniai):
              </p>
              <SmsPreview label="Pirmas siuntimas" text={firstSms} />
              <SmsPreview label="Priminimas" text={reminderSms} />
            </div>

            {stats.total === 0 ? (
              <div className="text-center py-1">
                <p className="text-sm text-gray-600 mb-3">
                  Tokenai dar nesugeneruoti. Paspauskit, kad sukurtų ir išsiųstų SMS skolingiems
                  nariams.
                </p>
                <Button type="button" onClick={handleSend} loading={sending}>
                  <Send className="h-4 w-4" />
                  Siųsti SMS skolingiems nariams
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={handleSend} loading={sending} variant="outline">
                  <Send className="h-4 w-4" />
                  Siųsti neturintiems deklaracijos
                </Button>
                <Button
                  type="button"
                  onClick={handleResend}
                  loading={resending}
                  disabled={pendingDebtors === 0}
                  variant="outline"
                >
                  <RotateCcw className="h-4 w-4" />
                  Priminimas skolingiems neatsakiusiems ({pendingDebtors})
                </Button>
              </div>
            )}
          </form>
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
                <FilterBtn active={filter === "viewed"} onClick={() => setFilter("viewed")}>
                  Atidarė ({stats.viewed})
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
                      ) : d.viewed_at ? (
                        <>
                          <span className="inline-flex items-center gap-1 text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded font-medium">
                            <Eye className="h-3 w-3" /> Atidarė
                            {d.view_count && d.view_count > 1 ? ` ×${d.view_count}` : ""}
                          </span>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatDate(d.viewed_at)}
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

function SmsPreview({ label, text }: { label: string; text: string }) {
  const segments = smsSegments(text);
  return (
    <div>
      <p className="text-xs text-gray-500">
        {label} · {text.length} simb. · {segments} SMS segment{segments === 1 ? "as" : "ai"}
      </p>
      <p className="text-xs text-gray-800 font-mono break-words">{text}</p>
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
