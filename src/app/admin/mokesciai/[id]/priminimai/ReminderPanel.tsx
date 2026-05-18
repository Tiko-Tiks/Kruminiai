"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { sendOverdueDeclarationReminders } from "@/actions/declarations";
import type { ChannelChoice } from "@/actions/reminders";
import { Mail, MessageSquare, AlertCircle, CheckCircle2, User, Phone, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";

interface UnpaidMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  status?: string;
  totalCents?: number;
  yearsUnpaid?: number;
}

interface Props {
  feePeriodId: string;
  period: {
    year: number;
    name: string;
    amount_cents: number;
  };
  unpaid: UnpaidMember[];
  counts: {
    total: number;
    withEmail: number;
    withPhone: number;
    withBoth: number;
    withNothing: number;
  };
}

export function ReminderPanel({ period, unpaid, counts }: Props) {
  const router = useRouter();
  const [channel, setChannel] = useState<ChannelChoice>("both");
  const [sending, setSending] = useState(false);

  // Pradinis pasirinkimas – visi pasiekiami nariai (turi email arba telefoną)
  const reachableIds = useMemo(
    () =>
      unpaid
        .filter((m) => (m.email && m.email.trim()) || (m.phone && m.phone.trim()))
        .map((m) => m.id),
    [unpaid]
  );

  const [selected, setSelected] = useState<Set<string>>(() => new Set(reachableIds));

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(reachableIds));
  const deselectAll = () => setSelected(new Set());
  const selectMultiYear = () =>
    setSelected(
      new Set(
        unpaid
          .filter((m) => (m.yearsUnpaid ?? 1) > 1 && reachableIds.includes(m.id))
          .map((m) => m.id)
      )
    );

  // Skaičiavimai pagal pasirinkimą + kanalą
  const selectedMembers = useMemo(
    () => unpaid.filter((m) => selected.has(m.id)),
    [unpaid, selected]
  );

  const willEmail = selectedMembers.filter((m) => m.email && m.email.trim()).length;
  const willSms = selectedMembers.filter((m) => m.phone && m.phone.trim()).length;
  const willSend = (() => {
    if (channel === "email") return willEmail;
    if (channel === "sms") return willSms;
    return selectedMembers.filter((m) => (m.email && m.email.trim()) || (m.phone && m.phone.trim())).length;
  })();

  const smsToSend = channel === "email" ? 0 : willSms;
  const estimatedCost = (smsToSend * 0.03).toFixed(2);

  async function handleSend() {
    if (selected.size === 0) {
      toast.error("Pasirinkite bent vieną narį");
      return;
    }
    const channelLabel =
      channel === "both" ? "el. paštu + SMS" : channel === "email" ? "tik el. paštu" : "tik SMS";
    if (
      !confirm(
        `Siųsti priminimą su patvirtinimo nuoroda ${willSend} nariams ${channelLabel}?\n\nApytikslė SMS kaina: ${estimatedCost} EUR.`
      )
    )
      return;

    setSending(true);
    const result = await sendOverdueDeclarationReminders(Array.from(selected), channel);
    setSending(false);

    if (!("success" in result) || !result.success) {
      const msg = "error" in result ? result.error : "Nežinoma klaida";
      toast.error(typeof msg === "string" ? msg : "Klaida siunčiant priminimus");
      return;
    }
    toast.success(`Išsiųsta: ${result.emailsSent} email + ${result.smsSent} SMS`);
    if (result.errors.length > 0) {
      console.warn("Klaidos:", result.errors);
      toast.warning(`${result.errors.length} klaidų – patikrinkite konsolę`);
    }
    router.refresh();
  }

  if (counts.total === 0) {
    return (
      <Card>
        <div className="p-12 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Visi nariai sumokėjo!</h3>
          <p className="text-sm text-gray-500">
            Už {period.year} m. metinį mokestį skolos nėra. Priminti nereikia.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-900">
        <p className="font-medium mb-1 flex items-center gap-1.5">
          <LinkIcon className="h-4 w-4" /> Kaip veikia priminimas su nuoroda
        </p>
        <p className="text-blue-800">
          Kiekvienam pasirinktam nariui sukuriama (arba pakartotinai panaudojama) asmeninė
          deklaracijos nuoroda <code className="text-xs bg-blue-100 px-1 rounded">kruminiai.lt/deklaracija/[token]</code>.
          Email ir SMS turės šią nuorodą – narys gali patvirtinti narystę, pasirinkti
          mokėjimo būdą (grynais / pavedimu) arba pranešti apie išstojimą.
        </p>
      </div>

      {/* Statistikos kortelės */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Iš viso skolingų" value={counts.total} accent="amber" />
        <StatCard label="Turi el. paštą" value={counts.withEmail} icon={<Mail className="h-4 w-4" />} />
        <StatCard label="Turi telefoną" value={counts.withPhone} icon={<Phone className="h-4 w-4" />} />
        <StatCard
          label="Be kontaktų"
          value={counts.withNothing}
          accent={counts.withNothing > 0 ? "red" : undefined}
        />
      </div>

      {/* Kanalo pasirinkimas */}
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-gray-900">Kanalas</h2>
          <p className="text-xs text-gray-500 mt-0.5">Email – nemokama. SMS – ~0,03 EUR/žinutei.</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ChannelOption
              active={channel === "both"}
              onClick={() => setChannel("both")}
              icon={
                <span className="flex">
                  <Mail className="h-5 w-5" />
                  <MessageSquare className="h-5 w-5 -ml-1" />
                </span>
              }
              title="Email + SMS"
              desc="Geriausias pasiekiamumas"
            />
            <ChannelOption
              active={channel === "email"}
              onClick={() => setChannel("email")}
              icon={<Mail className="h-5 w-5" />}
              title="Tik el. paštu"
              desc="Nemokama"
            />
            <ChannelOption
              active={channel === "sms"}
              onClick={() => setChannel("sms")}
              icon={<MessageSquare className="h-5 w-5" />}
              title="Tik SMS"
              desc={`~${(reachableIds.length * 0.03).toFixed(2)} EUR maks`}
            />
          </div>
        </CardContent>
      </Card>

      {/* Greitos pasirinkimo komandos + sąrašas su checkbox'ais */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                Skolingi nariai ({counts.total})
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Pažymėkit, kam siųsti priminimą. Be kontaktų nariai – išjungti.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <QuickBtn onClick={selectAll}>Pažymėti visus</QuickBtn>
              <QuickBtn onClick={deselectAll}>Atžymėti visus</QuickBtn>
              <QuickBtn onClick={selectMultiYear}>Tik daugiamečiai</QuickBtn>
            </div>
          </div>
        </CardHeader>
        <div className="divide-y divide-gray-100">
          {unpaid.map((m) => {
            const hasEmail = !!(m.email && m.email.trim());
            const hasPhone = !!(m.phone && m.phone.trim());
            const reachable = hasEmail || hasPhone;
            const isSelected = selected.has(m.id);
            const willReceive =
              isSelected &&
              ((channel === "both" && reachable) ||
                (channel === "email" && hasEmail) ||
                (channel === "sms" && hasPhone));
            const totalEur = ((m.totalCents ?? 0) / 100).toFixed(2);
            const multiYear = (m.yearsUnpaid ?? 1) > 1;

            return (
              <label
                key={m.id}
                className={`flex items-center gap-3 px-5 py-3 cursor-pointer select-none ${
                  !reachable ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={!reachable}
                  onChange={() => reachable && toggleOne(m.id)}
                  className="h-4 w-4 rounded border-gray-300 text-green-700 focus:ring-green-500"
                />
                <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-900">
                      {m.first_name} {m.last_name}
                    </p>
                    {m.status === "pasyvus" && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-200 text-gray-700">
                        Pasyvus
                      </span>
                    )}
                    {multiYear && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">
                        {m.yearsUnpaid} m. skola
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-0.5">
                    <span className="font-semibold text-red-700">{totalEur} EUR</span>
                    {hasEmail && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {m.email}
                      </span>
                    )}
                    {hasPhone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {m.phone}
                      </span>
                    )}
                    {!reachable && (
                      <span className="flex items-center gap-1 text-red-600">
                        <AlertCircle className="h-3 w-3" />
                        Nėra kontaktų
                      </span>
                    )}
                  </div>
                </div>
                {willReceive ? (
                  <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full font-medium">
                    <CheckCircle2 className="h-3 w-3" />
                    Bus išsiųsta
                  </span>
                ) : isSelected && !reachable ? (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    Nepasiekiamas
                  </span>
                ) : !isSelected ? (
                  <span className="text-xs text-gray-400">Praleista</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                    Be šio kanalo
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </Card>

      {/* Sticky siuntimo juosta */}
      <div className="sticky bottom-0 -mx-4 sm:mx-0 bg-white border-t border-gray-200 px-4 sm:px-6 py-4 shadow-lg sm:rounded-xl sm:border">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-gray-700">
            Pasirinkta: <strong className="text-gray-900">{selected.size}</strong> · Bus
            išsiųsta: <strong className="text-green-700">{willSend}</strong>{" "}
            <span className="text-gray-500">
              ({willEmail} email, {willSms} SMS)
            </span>
            {smsToSend > 0 && (
              <span className="text-gray-500"> · ~{estimatedCost} EUR</span>
            )}
          </div>
          <Button onClick={handleSend} loading={sending} disabled={willSend === 0}>
            Siųsti priminimus
          </Button>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
  accent?: "amber" | "red";
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        accent === "amber"
          ? "bg-amber-50 border-amber-200"
          : accent === "red"
            ? "bg-red-50 border-red-200"
            : "bg-white border-gray-200"
      }`}
    >
      <div className="flex items-center gap-1.5 text-xs text-gray-600 mb-1">
        {icon}
        {label}
      </div>
      <div
        className={`text-2xl font-bold ${
          accent === "amber" ? "text-amber-700" : accent === "red" ? "text-red-700" : "text-gray-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function ChannelOption({
  active,
  onClick,
  icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left p-4 rounded-lg border-2 transition-all ${
        active ? "border-green-600 bg-green-50" : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      <div className={`mb-2 ${active ? "text-green-700" : "text-gray-500"}`}>{icon}</div>
      <p className="font-semibold text-sm text-gray-900">{title}</p>
      <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
    </button>
  );
}

function QuickBtn({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs px-2.5 py-1 rounded-full font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
    >
      {children}
    </button>
  );
}
