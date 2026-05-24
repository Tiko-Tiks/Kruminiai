"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { bulkCreateMemberAccounts } from "@/actions/portal-invites";
import { toast } from "sonner";
import { Send, Users, CheckSquare, Square, AlertCircle, X } from "lucide-react";

interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
}

export function InvitePanel({ candidates }: { candidates: Candidate[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(
    new Set(candidates.map((c) => c.id))
  );
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ member: string; reason: string }[]>([]);
  const [lastResult, setLastResult] = useState<{ created: number; emailed: number } | null>(null);

  if (candidates.length === 0) {
    return (
      <Card>
        <div className="p-6 text-center text-gray-500 text-sm">
          Visi aktyvūs ir pasyvūs nariai su el. paštu jau turi paskyras.
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
      `Sukurti paskyras ${selected.size} nariams? Kiekvienas gaus el. laišką su slaptažodžio nustatymo nuoroda.`
    );
    if (!confirmed) return;

    setLoading(true);
    setErrors([]);
    const result = await bulkCreateMemberAccounts(Array.from(selected));
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      setErrors([{ member: "Sistema", reason: result.error }]);
      return;
    }

    const parts: string[] = [];
    if (result.created) parts.push(`${result.created} paskyrų sukurta`);
    if (result.emailed) parts.push(`${result.emailed} laiškų išsiųsta`);
    if (result.errors && result.errors.length > 0) {
      parts.push(`${result.errors.length} klaidų`);
    }
    toast.success(parts.join(", ") || "Operacija atlikta");

    setLastResult({ created: result.created || 0, emailed: result.emailed || 0 });
    setErrors(result.errors || []);
    router.refresh();
  };

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <div className="p-6">
        {/* Klaidos / rezultatai – rodom virš sąrašo, kad iškart matytųsi */}
        {(errors.length > 0 || lastResult) && (
          <div className="mb-4 space-y-2">
            {lastResult && (lastResult.created > 0 || lastResult.emailed > 0) && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                ✓ Sukurta {lastResult.created} paskyrų, išsiųsta {lastResult.emailed} laiškų.
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
                    title="Užverti"
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
              <Users className="h-5 w-5 text-blue-700" />
              Paskyrų kūrimas ({candidates.length} kandidatų)
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Pažymėkite, kuriems nariams sukurti paskyras. Kiekvienas gaus el. laišką
              su nuoroda nustatyti slaptažodžiui.
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
          <div className="max-h-96 overflow-y-auto">
            <ul className="divide-y divide-gray-50">
              {candidates.map((c) => {
                const isSelected = selected.has(c.id);
                return (
                  <li key={c.id}>
                    <label className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggle(c.id)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="flex-1 text-sm text-gray-900 font-medium">
                        {c.first_name} {c.last_name}
                      </span>
                      <span className="text-xs text-gray-500 font-mono">{c.email}</span>
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
