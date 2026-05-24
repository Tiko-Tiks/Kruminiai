"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { sendContactUpdateSmsBatch } from "@/actions/contact-updates";
import { toast } from "sonner";
import {
  Send,
  CheckSquare,
  Square,
  Clock,
  Eye,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";

interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  last_token_sent_at: string | null;
  last_token_viewed_at: string | null;
  last_token_completed_at: string | null;
}

export function ContactUpdatePanel({ candidates }: { candidates: Candidate[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(
    new Set(candidates.filter((c) => !c.last_token_completed_at).map((c) => c.id))
  );
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ member: string; reason: string }[]>([]);
  const [lastResult, setLastResult] = useState<{ sent: number; failed: number } | null>(
    null
  );

  if (candidates.length === 0) {
    return (
      <Card>
        <div className="p-6 text-center text-gray-500 text-sm">
          Visi nariai turi el. paštą arba laukia telefonų pridėjimo.
        </div>
      </Card>
    );
  }

  const toggleAll = () => {
    if (selected.size === candidates.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(candidates.map((c) => c.id)));
    }
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleSubmit = async () => {
    if (selected.size === 0) {
      toast.error("Pažymėkite bent vieną narį");
      return;
    }
    const confirmed = confirm(
      `Siųsti SMS ${selected.size} nariams? Kiekvienas gaus vienkartinę nuorodą atnaujinti kontaktus.`
    );
    if (!confirmed) return;

    setLoading(true);
    setErrors([]);
    const result = await sendContactUpdateSmsBatch(Array.from(selected));
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    const parts: string[] = [];
    if (result.sent) parts.push(`${result.sent} išsiųsta`);
    if (result.failed) parts.push(`${result.failed} nepavyko`);
    toast.success(parts.join(", ") || "Atlikta");
    setLastResult({ sent: result.sent || 0, failed: result.failed || 0 });
    setErrors(result.errors || []);
    router.refresh();
  };

  const formatDate = (s: string | null) => {
    if (!s) return null;
    return new Date(s).toLocaleString("lt-LT", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Vilnius",
    });
  };

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <div className="p-6">
        {(errors.length > 0 || lastResult) && (
          <div className="mb-4 space-y-2">
            {lastResult && lastResult.sent > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                ✓ Išsiųsta {lastResult.sent} SMS žinučių.
              </div>
            )}
            {errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-red-900 flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4" />
                    {errors.length} klaida{errors.length === 1 ? "" : "(-os)"}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setErrors([])}
                    className="text-red-700 hover:text-red-900"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <ul className="space-y-1 text-sm text-red-800">
                  {errors.map((e, i) => (
                    <li key={i} className="font-mono text-xs">
                      <strong>{e.member}:</strong> {e.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <MessageIcon /> SMS kontaktų atnaujinimui ({candidates.length} kandidatų)
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Kiekvienas gaus SMS su vienkartine nuoroda:{" "}
              <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                kruminiai.lt/duomenys/[token]
              </code>
            </p>
          </div>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={loading || selected.size === 0}
            loading={loading}
          >
            <Send className="h-4 w-4" />
            Siųsti pažymėtiems ({selected.size})
          </Button>
        </div>

        <div className="bg-white rounded-lg border border-blue-100">
          <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
            <button
              type="button"
              onClick={toggleAll}
              className="text-sm font-medium text-blue-700 hover:text-blue-900 inline-flex items-center gap-1.5"
            >
              {selected.size === candidates.length ? (
                <CheckSquare className="h-4 w-4" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              {selected.size === candidates.length ? "Atžymėti visus" : "Pažymėti visus"}
            </button>
            <span className="text-xs text-gray-500">
              {selected.size} iš {candidates.length} pažymėtų
            </span>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            <ul className="divide-y divide-gray-50">
              {candidates.map((c) => {
                const isSelected = selected.has(c.id);
                const sent = formatDate(c.last_token_sent_at);
                const viewed = formatDate(c.last_token_viewed_at);
                const completed = formatDate(c.last_token_completed_at);
                return (
                  <li key={c.id}>
                    <label className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggle(c.id)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-900">
                            {c.first_name} {c.last_name}
                          </span>
                          <span className="text-xs text-gray-500 font-mono">
                            {c.phone}
                          </span>
                        </div>
                        {(sent || viewed || completed) && (
                          <div className="flex items-center gap-3 mt-1 text-xs">
                            {sent && (
                              <span className="text-gray-500 inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" /> Išsiųsta {sent}
                              </span>
                            )}
                            {viewed && (
                              <span className="text-blue-700 inline-flex items-center gap-1">
                                <Eye className="h-3 w-3" /> Peržiūrėjo {viewed}
                              </span>
                            )}
                            {completed && (
                              <span className="text-green-700 inline-flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Atnaujino {completed}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </Card>
  );
}

function MessageIcon() {
  return (
    <svg className="h-5 w-5 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
  );
}
