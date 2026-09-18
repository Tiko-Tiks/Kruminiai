"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateResolutionStatus,
  updateResolution,
  deleteResolution,
  setResolutionResults,
  reorderResolution,
  recordBallots,
  getBallots,
} from "@/actions/voting";
import { updateMeetingProtocolInfo } from "@/actions/meetings";
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
  ArrowUp,
  ArrowDown,
  Scale,
  Gavel,
  FileText,
  UserCheck,
  AlertCircle,
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

interface LiveAttendee {
  member_id: string;
  member: { id: string; first_name: string; last_name: string } | null;
}

interface Props {
  resolutions: ResolutionWithDocs[];
  meetingId: string;
  meetingStatus: string;
  allDocuments: Document[];
  liveAttendees?: LiveAttendee[];
  communityChairpersonName?: string | null;
  currentChairpersonName?: string | null;
  currentSecretaryName?: string | null;
}

export function ResolutionsList({
  resolutions,
  meetingId,
  meetingStatus,
  allDocuments,
  liveAttendees = [],
  communityChairpersonName = null,
  currentChairpersonName = null,
  currentSecretaryName = null,
}: Props) {
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

  const handleReorder = async (id: string, direction: "up" | "down") => {
    setLoading(id);
    const result = await reorderResolution(id, meetingId, direction);
    if (result.error) toast.error(typeof result.error === "string" ? result.error : "Klaida");
    else router.refresh();
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
      {resolutions.map((res, index) => {
        const isExpanded = expandedId === res.id;
        // NUTARTA tekstas privalomas prieš uždarant klausimą (procedūriniams
        // jį sugeneruoja serveris iš susirinkimo duomenų)
        const needsDecisionText =
          !res.is_procedural && !(res.decision_text && res.decision_text.trim());
        const totalVotes = res.result_for + res.result_against + res.result_abstain;
        const isPassed = res.status === "patvirtintas";

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
              {canModify && resolutions.length > 1 && (
                <div className="flex flex-col -my-1">
                  <button
                    type="button"
                    title="Perkelti aukštyn"
                    disabled={index === 0 || loading === res.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReorder(res.id, "up");
                    }}
                    className="text-gray-300 hover:text-gray-600 disabled:opacity-30 disabled:hover:text-gray-300"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Perkelti žemyn"
                    disabled={index === resolutions.length - 1 || loading === res.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReorder(res.id, "down");
                    }}
                    className="text-gray-300 hover:text-gray-600 disabled:opacity-30 disabled:hover:text-gray-300"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
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

                {!['patvirtintas','atmestas'].includes(res.status) && canModify && <label className="block text-sm text-gray-600">Sprendimo rūšis
                  <select value={res.decision_type || ""} className="ml-2 rounded border p-1" onChange={async e => {
                    const result = await updateResolution(res.id, meetingId, {decision_type: e.target.value as NonNullable<Resolution['decision_type']>});
                    if (result.error) toast.error(result.error); else router.refresh();
                  }}>
                    <option value="" disabled>Pasirinkite sprendimo rūšį</option><option value="ordinary">Įprastas sprendimas</option><option value="statutes">Įstatų keitimas (2/3)</option><option value="transformation">Pertvarkymas (2/3)</option><option value="liquidation">Likvidavimas (2/3)</option>
                  </select>
                </label>}
                {/* Protokolo tekstai */}
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      SVARSTYTA (protokolui)
                    </label>
                    <textarea
                      disabled={!canModify || ['patvirtintas','atmestas'].includes(res.status)}
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
                      disabled={!canModify || ['patvirtintas','atmestas'].includes(res.status)}
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
                    {res.status === "projektas" && res.procedural_type === "pirmininkas_sekretorius" && (
                      <ChairmanSecretaryPicker
                        resolutionId={res.id}
                        meetingId={meetingId}
                        liveAttendees={liveAttendees}
                        defaultChairperson={currentChairpersonName || communityChairpersonName}
                        defaultSecretary={currentSecretaryName}
                      />
                    )}

                    {res.status === "projektas" && res.procedural_type !== "pirmininkas_sekretorius" && (
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
                      <div className="w-full space-y-3">
                        <NamedLiveVotes resolutionId={res.id} meetingId={meetingId} attendees={liveAttendees} />
                        <QuickVoteForm resolutionId={res.id} meetingId={meetingId} needsDecisionText={needsDecisionText} />
                      </div>
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

function NamedLiveVotes({resolutionId, meetingId, attendees}: {resolutionId:string;meetingId:string;attendees:LiveAttendee[]}) {
  const router = useRouter();
  const [recorded, setRecorded] = useState<Record<string,string> | null>(null);
  const [choices, setChoices] = useState<Record<string,string>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    getBallots(resolutionId).then(rows => setRecorded(Object.fromEntries(rows.map(row => [row.member_id,row.vote]))))
      .catch(() => toast.error("Nepavyko perskaityti vardinių balsų"));
  }, [resolutionId]);
  async function save() {
    if (!recorded) return;
    const ballots = attendees.filter(a => choices[a.member_id] && !recorded[a.member_id]).map(a => ({memberId:a.member_id,vote:choices[a.member_id]}));
    if (!ballots.length) return;
    setSaving(true);
    const result = await recordBallots(resolutionId,meetingId,ballots,"fizinis");
    if(result.error) toast.error(result.error);
    else { setRecorded({...recorded,...Object.fromEntries(ballots.map(b=>[b.memberId,b.vote]))}); setChoices({}); toast.success("Vardiniai balsai įrašyti"); router.refresh(); }
    setSaving(false);
  }
  if (!attendees.length) return null;
  return <details className="w-full rounded border p-3 text-sm"><summary>Vardinis gyvų dalyvių balsavimas</summary>
    <p className="my-2 text-xs text-gray-600">Tarybos balsų lygybei išspręsti būtinas vardinis posėdžio pirmininko balsas. Įvedus vardinius gyvus balsus, visus kitus gyvus balsus taip pat įveskite čia; bendruose gyvų balsų laukuose palikite nulius.</p>
    <div className="space-y-2">{attendees.map(a => <label key={a.member_id} className="flex items-center justify-between gap-3">{a.member?.first_name} {a.member?.last_name}
      <select aria-label={`Balsas: ${a.member?.first_name} ${a.member?.last_name}`} className="rounded border p-1" disabled={!recorded || !!recorded[a.member_id]} value={recorded?.[a.member_id] || choices[a.member_id] || ""} onChange={e=>setChoices({...choices,[a.member_id]:e.target.value})}>
        <option value="">Neįrašytas</option><option value="uz">Už</option><option value="pries">Prieš</option><option value="susilaike">Susilaikė</option>
      </select>
    </label>)}</div>
    <Button size="sm" className="mt-3" disabled={!recorded || !Object.values(choices).some(Boolean)} loading={saving} onClick={save}>Įrašyti vardinius balsus</Button>
  </details>;
}

function QuickVoteForm({
  resolutionId,
  meetingId,
  needsDecisionText,
}: {
  resolutionId: string;
  meetingId: string;
  /** NUTARTA tekstas dar neišsaugotas – uždaryti klausimo negalima */
  needsDecisionText: boolean;
}) {
  const router = useRouter();
  const [uz, setUz] = useState("");
  const [pries, setPries] = useState("0");
  const [susilaike, setSusilaike] = useState("0");
  const [saving, setSaving] = useState(false);
  const [chairVote, setChairVote] = useState("");

  const handleSave = async (status: "patvirtintas" | "atmestas") => {
    setSaving(true);
    const result = await setResolutionResults(resolutionId, meetingId, {
      result_for: parseInt(uz) || 0,
      result_against: parseInt(pries) || 0,
      result_abstain: parseInt(susilaike) || 0,
    }, status, chairVote || undefined);

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
      <label className="w-full text-xs text-gray-600">Tarybos posėdyje, balsams pasiskirsčius po lygiai: posėdžio pirmininko balsas (turi būti įrašytas vardiniame balsavime)
        <select aria-label="Posėdžio pirmininko balsas" value={chairVote} onChange={e => setChairVote(e.target.value)} className="ml-2 rounded border p-1">
          <option value="">Netaikoma / neįrašyta</option><option value="uz">Už</option><option value="pries">Prieš</option><option value="susilaike">Susilaikė</option>
        </select>
      </label>
      {needsDecisionText && (
        <div className="w-full bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-900 flex items-start gap-2">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          <span>
            Užpildykite ir išsaugokite <strong>NUTARTA (protokolui)</strong> tekstą –
            be jo klausimo negalima pažymėti kaip priimto ar atmesto.
          </span>
        </div>
      )}
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
        disabled={!uz || needsDecisionText}
      >
        <CheckCircle className="h-3.5 w-3.5" />
        Priimta
      </Button>
      <Button
        size="sm"
        variant="danger"
        onClick={() => handleSave("atmestas")}
        loading={saving}
        disabled={!uz || needsDecisionText}
      >
        <XCircle className="h-3.5 w-3.5" />
        Atmesta
      </Button>
    </div>
  );
}

/**
 * Susirinkimo pirmininko ir sekretoriaus rinkimų picker'is.
 * Rodomas tik prie procedūrinio #1 nutarimo (procedural_type='pirmininkas_sekretorius').
 *
 * Workflow:
 * 1. Pirmininkas pre-fill'inamas iš bendruomenės Pirmininko (community_management
 *    role='pirmininkas'). Galima keisti į kitą gyvai dalyvavusį narį, jei
 *    bendruomenės Pirmininkas nedalyvauja.
 * 2. Sekretorius pasirenkamas iš gyvai dalyvavusių narių sąrašo.
 * 3. Paspaudus „Atidaryti balsavimą", išsaugomos pavardės į meetings lentelę,
 *    tada atidaroma nutarimui balsavimo eilutė.
 */
function ChairmanSecretaryPicker({
  resolutionId,
  meetingId,
  liveAttendees,
  defaultChairperson,
  defaultSecretary,
}: {
  resolutionId: string;
  meetingId: string;
  liveAttendees: LiveAttendee[];
  defaultChairperson: string | null;
  defaultSecretary: string | null;
}) {
  const router = useRouter();
  const defaultMatches = liveAttendees.filter(a => a.member && `${a.member.first_name} ${a.member.last_name}` === defaultChairperson);
  const [chairpersonId, setChairpersonId] = useState(defaultMatches.length === 1 ? defaultMatches[0].member_id : "");
  const chairMember = liveAttendees.find(a => a.member_id === chairpersonId)?.member;
  const chairperson = chairMember ? `${chairMember.first_name} ${chairMember.last_name}` : "";
  const [secretary, setSecretary] = useState(defaultSecretary || "");
  const [saving, setSaving] = useState(false);

  // Gyvai dalyvavusių narių vardai-pavardės dropdownams
  const attendeeNames = liveAttendees
    .map((a) => {
      const m = a.member;
      return m ? `${m.first_name} ${m.last_name}` : null;
    })
    .filter((n): n is string => !!n)
    .sort((a, b) => a.localeCompare(b, "lt"));

  // Sekretoriaus opcijos – tik dalyvavusieji, NE pirmininkas
  const secretaryOptions = attendeeNames.filter((n) => n !== chairperson);

  async function handleOpen() {
    if (!chairperson.trim()) {
      toast.error("Pasirinkite susirinkimo pirmininką");
      return;
    }
    if (!secretary.trim()) {
      toast.error("Pasirinkite susirinkimo sekretorių");
      return;
    }
    if (chairperson === secretary) {
      toast.error("Pirmininkas ir sekretorius negali būti tas pats asmuo");
      return;
    }
    setSaving(true);

    // 1. Įrašom pavardes į meetings lentelę
    const updateRes = await updateMeetingProtocolInfo(meetingId, {
      chairperson_member_id: chairpersonId,
      chairperson_name: chairperson,
      secretary_name: secretary,
    });
    if (updateRes.error) {
      setSaving(false);
      toast.error(typeof updateRes.error === "string" ? updateRes.error : "Nepavyko išsaugoti");
      return;
    }

    // 2. Atidarom balsavimą
    const voteRes = await updateResolutionStatus(resolutionId, "balsuojamas", meetingId);
    setSaving(false);
    if (voteRes.error) {
      toast.error(typeof voteRes.error === "string" ? voteRes.error : "Nepavyko atidaryti balsavimo");
      return;
    }
    toast.success(`Pasirinkti: pirmininkas ${chairperson}, sekretorius ${secretary}. Balsavimas atidarytas.`);
    router.refresh();
  }

  if (liveAttendees.length === 0) {
    return (
      <div className="w-full bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900 flex items-start gap-2">
        <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Pirmiausia užregistruokite gyvai dalyvaujančius narius</p>
          <p className="text-xs mt-1">
            Sekretorius turi būti pasirinktas iš gyvai dalyvavusių narių. Pažymėkite
            atvykusius &bdquo;Dalyvių registracijos&ldquo; bloke šio puslapio viršuje.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-blue-900">
        <UserCheck className="h-4 w-4" />
        Prieš atidarant balsavimą – pasirinkite susirinkimo pirmininką ir sekretorių
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Susirinkimo pirmininkas {defaultChairperson && <span className="text-gray-400">(default: bendruomenės pirmininkas)</span>}
          </label>
          <select
            value={chairpersonId}
            onChange={(e) => setChairpersonId(e.target.value)}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Pasirinkite...</option>
            {liveAttendees.map(a => a.member && <option key={a.member_id} value={a.member_id}>{a.member.first_name} {a.member.last_name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Susirinkimo sekretorius <span className="text-gray-400">(iš gyvai dalyvaujančių)</span>
          </label>
          <select
            value={secretary}
            onChange={(e) => setSecretary(e.target.value)}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Pasirinkite...</option>
            {secretaryOptions.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
      </div>
      <Button
        size="sm"
        onClick={handleOpen}
        loading={saving}
        disabled={!chairperson || !secretary}
      >
        <Vote className="h-4 w-4" />
        Atidaryti balsavimą
      </Button>
    </div>
  );
}
