import { createServerSupabaseClient } from "@/lib/supabase-server";
import { Card, CardContent } from "@/components/ui/Card";
import { Mail, Phone, CheckCircle2, XCircle } from "lucide-react";

export const dynamic = "force-dynamic";

const KIND_LABELS: Record<string, string> = {
  overdue_reminder: "Mokesčių priminimas",
  membership_declaration: "Narystės deklaracija",
  voting_token: "Balsavimo nuoroda",
  voting_resend: "Pakartotinis balsavimo SMS",
  vote_confirmation: "Balsavimo patvirtinimas",
  other: "Kita",
};

interface Row {
  id: string;
  channel: "sms" | "email";
  kind: string;
  recipient: string;
  subject: string | null;
  status: "sent" | "failed";
  error: string | null;
  external_id: string | null;
  batch_id: string | null;
  segments: number | null;
  sent_at: string;
  member: { first_name: string; last_name: string } | null;
}

async function getNotifications(): Promise<Row[]> {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from("notification_log")
    .select(
      "id, channel, kind, recipient, subject, status, error, external_id, batch_id, segments, sent_at, member:members(first_name, last_name)"
    )
    .order("sent_at", { ascending: false })
    .limit(500);

  return ((data || []) as unknown as Row[]).map((r) => ({
    ...r,
    member: Array.isArray(r.member) ? r.member[0] : r.member,
  }));
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("lt-LT", {
    timeZone: "Europe/Vilnius",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function NotificationsPage() {
  const rows = await getNotifications();

  // Grupuojam pagal batch_id (paskutinės 50 batch'ų virš)
  const batches = new Map<string, Row[]>();
  const standalone: Row[] = [];
  for (const r of rows) {
    if (r.batch_id) {
      const arr = batches.get(r.batch_id) || [];
      arr.push(r);
      batches.set(r.batch_id, arr);
    } else {
      standalone.push(r);
    }
  }

  const sortedBatches = Array.from(batches.entries())
    .map(([id, items]) => {
      const first = items[0];
      const sent = items.filter((i) => i.status === "sent").length;
      const failed = items.filter((i) => i.status === "failed").length;
      return {
        batchId: id,
        kind: first.kind,
        channel: first.channel,
        sentAt: items.reduce((latest, i) => (i.sent_at > latest ? i.sent_at : latest), first.sent_at),
        items,
        sent,
        failed,
      };
    })
    .sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Pranešimų žurnalas</h1>
        <p className="text-sm text-gray-500 mt-1">
          Visi išsiųsti SMS ir el. laiškai – mokesčių priminimai, balsavimo nuorodos, deklaracijos.
        </p>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm text-gray-400 py-8 text-center">
              Pranešimų žurnalas tuščias. Pirmasis įrašas atsiras po pirmo siuntimo.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Batch'ai */}
          {sortedBatches.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                Siuntimo grupės ({sortedBatches.length})
              </h2>
              <div className="space-y-3">
                {sortedBatches.map((batch) => (
                  <Card key={batch.batchId}>
                    <CardContent>
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            {batch.channel === "sms" ? (
                              <Phone className="h-4 w-4 text-amber-600" />
                            ) : (
                              <Mail className="h-4 w-4 text-blue-600" />
                            )}
                            <span className="font-semibold text-gray-900">
                              {KIND_LABELS[batch.kind] || batch.kind}
                            </span>
                            <span className="text-xs text-gray-400">
                              ({batch.channel.toUpperCase()})
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">{formatTime(batch.sentAt)}</p>
                        </div>
                        <div className="text-right text-sm">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium">
                            <CheckCircle2 className="h-3 w-3" /> {batch.sent}
                          </span>
                          {batch.failed > 0 && (
                            <span className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-xs font-medium">
                              <XCircle className="h-3 w-3" /> {batch.failed}
                            </span>
                          )}
                        </div>
                      </div>

                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                          Rodyti gavėjus ({batch.items.length})
                        </summary>
                        <div className="mt-3 border-t border-gray-100 pt-3 space-y-1.5 max-h-80 overflow-y-auto">
                          {batch.items.map((r) => (
                            <div
                              key={r.id}
                              className="flex items-center justify-between gap-3 text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {r.status === "sent" ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                                ) : (
                                  <XCircle className="h-3.5 w-3.5 text-red-600 flex-shrink-0" />
                                )}
                                <span className="font-medium text-gray-700 truncate">
                                  {r.member
                                    ? `${r.member.first_name} ${r.member.last_name}`
                                    : "—"}
                                </span>
                                <span className="text-gray-400 truncate">{r.recipient}</span>
                              </div>
                              {r.error && (
                                <span className="text-red-600 text-xs truncate max-w-xs">
                                  {r.error}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </details>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Pavieniai */}
          {standalone.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                Pavieniai pranešimai ({standalone.length})
              </h2>
              <Card>
                <CardContent>
                  <div className="divide-y divide-gray-100">
                    {standalone.map((r) => (
                      <div key={r.id} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {r.channel === "sms" ? (
                                <Phone className="h-3.5 w-3.5 text-amber-600" />
                              ) : (
                                <Mail className="h-3.5 w-3.5 text-blue-600" />
                              )}
                              <span className="text-sm font-medium text-gray-900">
                                {KIND_LABELS[r.kind] || r.kind}
                              </span>
                              {r.status === "sent" ? (
                                <span className="px-1.5 py-0.5 rounded bg-green-50 text-green-700 text-xs">
                                  sent
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-700 text-xs">
                                  failed
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500">
                              {r.recipient}
                              {r.member ? ` · ${r.member.first_name} ${r.member.last_name}` : ""}
                            </p>
                            {r.error && (
                              <p className="text-xs text-red-600 mt-0.5">{r.error}</p>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 whitespace-nowrap">
                            {formatTime(r.sent_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
