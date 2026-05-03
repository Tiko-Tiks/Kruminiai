"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Send, RotateCcw, Users, CheckCircle2, Clock, Phone, UserCheck } from "lucide-react";
import { generateAndSendVotingTokens, resendVotingSms } from "@/actions/tokens";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface TokenStat {
  id: string;
  sent_at: string | null;
  voted_at: string | null;
  live_intent_at: string | null;
  member:
    | { first_name: string; last_name: string; phone: string | null }
    | { first_name: string; last_name: string; phone: string | null }[]
    | null;
}

interface Props {
  meetingId: string;
  stats: {
    total: number;
    sent: number;
    voted: number;
    liveIntent: number;
    pending: number;
    tokens: TokenStat[];
  };
}

export function RemoteVotingPanel({ meetingId, stats }: Props) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleSendInitial() {
    if (!confirm("Siųsti SMS visiems aktyviems nariams su balsavimo nuoroda?")) return;
    setSending(true);
    const result = await generateAndSendVotingTokens(meetingId);
    setSending(false);

    if (!result.success) {
      toast.error(result.error || "Klaida");
      return;
    }
    const skipped = result.smsSkipped ?? 0;
    toast.success(
      `Išsiųsta ${result.smsSent ?? 0} SMS${skipped ? ` (praleista ${skipped} – be telefono / jau balsavę)` : ""}`
    );
    if (result.errors && result.errors.length > 0) {
      console.warn("SMS klaidos:", result.errors);
      toast.warning(`${result.errors.length} klaidų – patikrinkite konsolę`);
    }
    router.refresh();
  }

  async function handleResend() {
    if (!confirm(`Siųsti priminimą ${stats.pending} nariams, kurie dar nebalsavo?`)) return;
    setResending(true);
    const result = await resendVotingSms(meetingId);
    setResending(false);

    if (!result.success) {
      toast.error("Klaida");
      return;
    }
    toast.success(`Priminimo SMS išsiųsta: ${result.smsSent ?? 0}`);
    if (result.errors && result.errors.length > 0) {
      console.warn("SMS klaidos:", result.errors);
    }
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Nuotolinis balsavimas (SMS)</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Nariai gauna SMS su nuoroda – balsuoja iš anksto, įskaitomi į kvorumą
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {stats.total === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-gray-600 mb-4">
              Tokenai dar nesugeneruoti. Paspauskite mygtuką, kad sistema sukurtų unikalią nuorodą
              kiekvienam aktyviam nariui ir išsiųstų SMS.
            </p>
            <Button onClick={handleSendInitial} loading={sending}>
              <Send className="h-4 w-4" />
              Siųsti SMS visiems nariams
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Stat
                icon={<CheckCircle2 className="h-4 w-4 text-green-600" />}
                label="Balsavo nuotoliu"
                value={stats.voted}
                color="text-green-700"
              />
              <Stat
                icon={<UserCheck className="h-4 w-4 text-blue-600" />}
                label="Atvyks gyvai"
                value={stats.liveIntent}
                color="text-blue-700"
              />
              <Stat
                icon={<Clock className="h-4 w-4 text-amber-600" />}
                label="Dar neatsakė"
                value={stats.pending}
                color="text-amber-700"
              />
              <Stat
                icon={<Users className="h-4 w-4 text-gray-500" />}
                label="Iš viso narių"
                value={stats.total}
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleSendInitial}
                loading={sending}
                disabled={resending}
                className="flex-1"
              >
                <Send className="h-4 w-4" />
                Siųsti naujiems
              </Button>
              <Button
                variant="outline"
                onClick={handleResend}
                loading={resending}
                disabled={sending || stats.pending === 0}
                className="flex-1"
              >
                <RotateCcw className="h-4 w-4" />
                Priminimas ({stats.pending})
              </Button>
            </div>

            <div className="border-t border-gray-100 pt-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Balsavimo statusas
              </h3>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {stats.tokens.map((t) => {
                  const member = Array.isArray(t.member) ? t.member[0] : t.member;
                  if (!member) return null;
                  return (
                    <div
                      key={t.id}
                      className="flex items-center justify-between py-1.5 text-sm"
                    >
                      <span className="text-gray-700">
                        {member.first_name} {member.last_name}
                      </span>
                      <div className="flex items-center gap-2">
                        {!member.phone && (
                          <span title="Be telefono" className="text-gray-300">
                            <Phone className="h-3.5 w-3.5" />
                          </span>
                        )}
                        {t.voted_at ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded">
                            <CheckCircle2 className="h-3 w-3" />
                            Balsavo
                          </span>
                        ) : t.live_intent_at ? (
                          <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                            <UserCheck className="h-3 w-3" />
                            Atvyks gyvai
                          </span>
                        ) : t.sent_at ? (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                            <Clock className="h-3 w-3" />
                            Laukia
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">Neišsiųsta</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({
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
    <div className="bg-gray-50 rounded-lg p-3 text-center">
      <div className="flex items-center justify-center gap-1 text-xs text-gray-500 mb-1">
        {icon}
        {label}
      </div>
      <div className={`text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}
