"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateResolutionStatus, updateResolution, deleteResolution, setResolutionResults } from "@/actions/voting";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { RESOLUTION_STATUS_LABELS } from "@/lib/constants";
import { Resolution, Document } from "@/lib/types";
import { ResolutionDocuments } from "./ResolutionDocuments";
import { toast } from "sonner";
import {
  Vote,
  CheckCircle,
  XCircle,
  Trash2,
  ChevronDown,
  ChevronUp,
  Scale,
  Gavel,
  FileText,
} from "lucide-react";

function statusVariant(status: string) {
  switch (status) {
    case "projektas": return "default" as const;
    case "svarstomas": return "info" as const;
    case "balsuojamas": return "warning" as const;
    case "patvirtintas": return "success" as const;
    case "atmestas": return "danger" as const;
    default: return "default" as const;
  }
}

interface ResolutionWithDocs extends Resolution {
  resolution_documents?: { id: string; sort_order: number; document: Document | null }[];
}

interface Props {
  resolutions: ResolutionWithDocs[];
  meetingId: string;
  meetingStatus: string;
  allDocuments: Document[];
}

export function ResolutionsList({ resolutions, meetingId, meetingStatus, allDocuments }: Props) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [editingTexts, setEditingTexts] = useState<Record<string, { discussion: string; decision: string }>>({});

  const canModify = meetingStatus !== "baigtas" && meetingStatus !== "atšauktas";

  const handleStatusChange = async (id: string, status: string) => {
    setLoading(id);
    const result = await updateResolutionStatus(id, status, meetingId);
    if (result.error) toast.error(typeof result.error === "string" ? result.error : "Klaida");
    else {
      toast.success(`Statusas: ${RESOLUTION_STATUS_LABELS[status]}`);
      router.refresh();
    }
    setLoading(null);
  };

  const handleSaveTexts = async (id: string) => {
    const texts = editingTexts[id];
    if (!texts) return;
    setLoading(id);
    const result = await updateResolution(id, meetingId, {
      discussion_text: texts.discussion,
      decision_text: texts.decision,
    });
    if (result.error) toast.error(typeof result.error === "string" ? result.error : "Klaida");
    else {
      toast.success("Išsaugota");
      router.refresh();
    }
    setLoading(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Ištrinti šį klausimą?")) return;
    setLoading(id);
    const result = await deleteResolution(id, meetingId);
    if (result.error) toast.error(typeof result.error === "string" ? result.error : "Klaida");
    else {
      toast.success("Klausimas ištrintas");
      router.refresh();
    }
    setLoading(null);
  };

  if (resolutions.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
        Nėra darbotvarkės klausimų
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {resolutions.map((res) => {
        const isExpanded = expandedId === res.id;
        const totalVotes = res.result_for + res.result_against + res.result_abstain;
        const isPassed = res.requires_qualified_majority
          ? res.result_for >= Math.ceil((totalVotes * 2) / 3)
          : res.result_for > res.result_against;

        return (
          <div
            key={res.id}
            className="bg-white rounded-xl border border-gray-200 overflow-hidden"
          >
            {/* Header */}
            <div
              className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50"
              onClick={() => setExpandedId(isExpanded ? null : res.id)}
            >
              <span className="text-sm font-bold text-gray-400 w-8">
                {res.resolution_number}.
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {res.title}
                  </span>
                  {res.is_procedural && (
                    <Gavel className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                  )}
                  {res.requires_qualified_majority && (
                    <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                      2/3
                    </span>
                  )}
                </div>
              </div>
              <Badge variant={statusVariant(res.status)}>
                {RESOLUTION_STATUS_LABELS[res.status]}
              </Badge>
              {totalVotes > 0 && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="text-green-600 font-medium">{res.result_for}</span>
                  /
                  <span className="text-red-600 font-medium">{res.result_against}</span>
                  /
                  <span className="text-gray-400">{res.result_abstain}</span>
                </div>
              )}
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              )}
            </div>

            {/* Expanded content */}
            {isExpanded && (
              <div className="px-5 pb-4 border-t border-gray-100 pt-4 space-y-4">
                {res.description && (
                  <p className="text-sm text-gray-600">{res.description}</p>
                )}

                {/* Susiję dokumentai */}
                {!res.is_procedural && (
                  <ResolutionDocuments
                    resolutionId={res.id}
                    meetingId={meetingId}
                    attached={res.resolution_documents || []}
                    allDocuments={allDocuments}
                    canModify={canModify}
                  />
                )}

                {/* Balsavimo rezultatai */}
                {totalVotes > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Scale className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Balsavimo rezultatai</span>
                      {(res.status === "patvirtintas" || res.status === "atmestas") && (
                        <Badge variant={isPassed ? "success" : "danger"}>
                          {isPassed ? "Priimta" : "Nepriimta"}
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{res.result_for}</div>
                        <div className="text-xs text-gray-500">Už</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">{res.result_against}</div>
                        <div className="text-xs text-gray-500">Prieš</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-400">{res.result_abstain}</div>
                        <div className="text-xs text-gray-500">Susilaikė</div>
                      </div>
                    </div>
                    {res.requires_qualified_majority && (
                      <p className="text-xs text-amber-600 mt-2 text-center">
                        Reikalinga 2/3 dauguma ({Math.ceil((totalVotes * 2) / 3)} balsų)
                      </p>
                    )}
                  </div>
                )}

                {/* Protokolo tekstai */}
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      SVARSTYTA (protokolui)
                    </label>
                    <textarea
                      value={editingTexts[res.id]?.discussion ?? res.discussion_text ?? ""}
                      onChange={(e) =>
                        setEditingTexts({
                          ...editingTexts,
                          [res.id]: {
                            discussion: e.target.value,
                            decision: editingTexts[res.id]?.decision ?? res.decision_text ?? "",
                          },
                        })
                      }
                      placeholder="Svarstymo aprašymas..."
                      rows={2}
                      className="w-full text-sm rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">
                      NUTARTA (protokolui)
                    </label>
                    <textarea
                      value={editingTexts[res.id]?.decision ?? res.decision_text ?? ""}
                      onChange={(e) =>
                        setEditingTexts({
                          ...editingTexts,
                          [res.id]: {
                            discussion: editingTexts[res.id]?.discussion ?? res.discussion_text ?? "",
                            decision: e.target.value,
                          },
                        })
                      }
                      placeholder="Nutarimo tekstas..."
                      rows={2}
                      className="w-full text-sm rounded-lg border border-gray-200 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  {editingTexts[res.id] && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSaveTexts(res.id)}
                      loading={loading === res.id}
                    >
                      Išsaugoti tekstus
                    </Button>
                  )}
                </div>

                {/* Veiksmai */}
                {canModify && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
                    {res.status === "projektas" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusChange(res.id, "balsuojamas")}
                        loading={loading === res.id}
                      >
                        <Vote className="h-4 w-4" />
                        Atidaryti balsavimą
                      </Button>
                    )}

                    {res.status === "balsuojamas" && (
                      <>
                        <QuickVoteForm
                          resolutionId={res.id}
                          meetingId={meetingId}
                          loading={loading === res.id}
                          onStatusChange={handleStatusChange}
                        />
                      </>
                    )}

                    {!res.is_procedural && res.status === "projektas" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(res.id)}
                        loading={loading === res.id}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function QuickVoteForm({
  resolutionId,
  meetingId,
}: {
  resolutionId: string;
  meetingId: string;
  loading: boolean;
  onStatusChange: (id: string, status: string) => void;
}) {
  const router = useRouter();
  const [uz, setUz] = useState("");
  const [pries, setPries] = useState("0");
  const [susilaike, setSusilaike] = useState("0");
  const [saving, setSaving] = useState(false);

  const handleSave = async (status: "patvirtintas" | "atmestas") => {
    setSaving(true);
    const result = await setResolutionResults(resolutionId, meetingId, {
      result_for: parseInt(uz) || 0,
      result_against: parseInt(pries) || 0,
      result_abstain: parseInt(susilaike) || 0,
    }, status);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(status === "patvirtintas" ? "Nutarimas priimtas" : "Nutarimas atmestas");
    }
    router.refresh();
    setSaving(false);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1">
        <label className="text-xs text-green-600 font-medium">Už:</label>
        <input
          type="number"
          min={0}
          value={uz}
          onChange={(e) => setUz(e.target.value)}
          className="w-14 text-sm text-center rounded border border-gray-300 px-1 py-1"
          placeholder="0"
        />
      </div>
      <div className="flex items-center gap-1">
        <label className="text-xs text-red-600 font-medium">Prieš:</label>
        <input
          type="number"
          min={0}
          value={pries}
          onChange={(e) => setPries(e.target.value)}
          className="w-14 text-sm text-center rounded border border-gray-300 px-1 py-1"
        />
      </div>
      <div className="flex items-center gap-1">
        <label className="text-xs text-gray-500 font-medium">Susilaik.:</label>
        <input
          type="number"
          min={0}
          value={susilaike}
          onChange={(e) => setSusilaike(e.target.value)}
          className="w-14 text-sm text-center rounded border border-gray-300 px-1 py-1"
        />
      </div>
      <Button
        size="sm"
        onClick={() => handleSave("patvirtintas")}
        loading={saving}
        disabled={!uz}
      >
        <CheckCircle className="h-3.5 w-3.5" />
        Priimta
      </Button>
      <Button
        size="sm"
        variant="danger"
        onClick={() => handleSave("atmestas")}
        loading={saving}
        disabled={!uz}
      >
        <XCircle className="h-3.5 w-3.5" />
        Atmesta
      </Button>
    </div>
  );
}
