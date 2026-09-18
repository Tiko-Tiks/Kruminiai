"use client";

import { useMemo, useState, useTransition, useEffect } from "react";
import { getMembers } from "@/actions/members";
import { useRouter } from "next/navigation";
import {
  setAttendance,
  removeAttendance,
  updateMeetingQuorum,
  captureMeetingElectorate,
  type EligibleAttendee,
} from "@/actions/meetings";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { toast } from "sonner";
import {
  Users,
  CheckCircle,
  AlertTriangle,
  Search,
  Settings2,
  UserMinus,
} from "lucide-react";
import { ATTENDANCE_TYPE_LABELS } from "@/lib/constants";
import { transliterateLt } from "@/lib/utils";
import { hasQuorum as computeHasQuorum, isCouncilMeeting, quorumBasisLabel } from "@/lib/quorum";

interface AttendanceRecord {
  id: string;
  meeting_id: string;
  member_id: string;
  attendance_type: string;
  member: { id: string; first_name: string; last_name: string } | null;
}

interface Props {
  meetingId: string;
  meetingType: string;
  meetingStatus: string;
  attendance: AttendanceRecord[];
  /** Kas gali dalyvauti – sąrašas priklauso nuo posėdžio tipo (žr. meetings.ts) */
  eligible: EligibleAttendee[];
  totalMembersAtTime: number;
  quorumRequired: number;
  electorateRecorded?: boolean;
  /** Siūlymas „dabar": kiek tinkamų dalyvauti ir koks kvorumas iš to išeina */
  suggestion: { eligibleCount: number; suggestedQuorum: number };
}

const TYPE_OPTIONS: { value: string; short: string }[] = [
  { value: "fizinis", short: "Gyvai" },
  { value: "nuotolinis", short: "Nuotoliu" },
  { value: "rastu", short: "Raštu" },
];

const COUNCIL_ROLE_LABELS: Record<string, string> = {
  pirmininkas: "Pirmininkas",
  tarybos_narys: "Tarybos narys",
  revizorius: "Revizorius",
};

function matches(member: { first_name: string; last_name: string }, term: string) {
  if (!term) return true;
  const haystack = transliterateLt(`${member.first_name} ${member.last_name}`).toLowerCase();
  return transliterateLt(term)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

/**
 * Posėdžio dalyvių registracija.
 *
 * SĄRAŠAS PRIKLAUSO NUO POSĖDŽIO TIPO – Tarybos posėdyje rodomi tik dabartiniai
 * Tarybos nariai, visuotiniame/neeiliniame/pakartotiniame – visi balso teisę
 * turintys nariai. Paruošimas daromas serveryje (`getEligibleAttendees`).
 *
 * Žymėjimas rašo tiesiai į `meeting_attendance` (UNIQUE meeting_id+member_id →
 * upsert), nuėmus žymėjimą – įrašas trinamas.
 */
export function AttendanceManager({
  meetingId,
  meetingType,
  meetingStatus,
  attendance,
  eligible,
  totalMembersAtTime,
  quorumRequired,
  electorateRecorded = false,
  suggestion,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [showQuorumEditor, setShowQuorumEditor] = useState(false);
  const [, startTransition] = useTransition();

  // Redaguoti leidžiam ir po susirinkimo („baigtas") – dalyviai dažnai
  // suvedami rašant protokolą, o anksčiau tokiu atveju likdavo tik SQL.
  const canEdit = meetingStatus !== "atšauktas";
  const isFinished = meetingStatus === "baigtas";

  const byMemberId = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    attendance.forEach((a) => map.set(a.member_id, a));
    return map;
  }, [attendance]);

  const eligibleIds = useMemo(() => new Set(eligible.map((m) => m.id)), [eligible]);

  // Užregistruoti, bet į dabartinį tinkamų sąrašą nebepatenkantys asmenys
  // (pvz. Tarybos narys, kurio kadencija tarp posėdžio ir šiandien pasibaigė).
  // Jų NESLEPIAM – įrašas realus ir turi likti matomas bei pašalinamas.
  const extraAttendees = attendance.filter((a) => !eligibleIds.has(a.member_id));

  const attendingCount = attendance.length;
  const quorumOk = computeHasQuorum(attendingCount, quorumRequired);

  const filtered = eligible.filter((m) => matches(m, search));

  const counts = {
    fizinis: attendance.filter((a) => a.attendance_type === "fizinis").length,
    nuotolinis: attendance.filter((a) => a.attendance_type === "nuotolinis").length,
    rastu: attendance.filter((a) => a.attendance_type === "rastu").length,
  };

  async function mark(memberId: string, type: string) {
    setPendingId(memberId);
    const result = await setAttendance(meetingId, memberId, type);
    setPendingId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    startTransition(() => router.refresh());
  }

  async function unmark(memberId: string) {
    setPendingId(memberId);
    const result = await removeAttendance(meetingId, memberId);
    setPendingId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Dalyvių registracija
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Sąrašas:{" "}
              {isCouncilMeeting(meetingType)
                ? `dabartiniai Tarybos nariai (${eligible.length})`
                : `visi balso teisę turintys nariai (${eligible.length})`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900">
                Dalyvauja {attendingCount} iš {totalMembersAtTime || eligible.length}
              </p>
              <p className="text-xs text-gray-500">
                {counts.fizinis > 0 && `${ATTENDANCE_TYPE_LABELS.fizinis}: ${counts.fizinis}`}
                {counts.nuotolinis > 0 && ` · ${ATTENDANCE_TYPE_LABELS.nuotolinis}: ${counts.nuotolinis}`}
                {counts.rastu > 0 && ` · ${ATTENDANCE_TYPE_LABELS.rastu}: ${counts.rastu}`}
              </p>
            </div>
            <Button disabled={electorateRecorded} size="sm" variant="ghost" onClick={() => setShowQuorumEditor((v) => !v)}>
              <Settings2 className="h-4 w-4" />
              Kvorumas
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Kvorumo būsena */}
        <div
          className={`rounded-lg p-3 text-sm ${
            quorumOk ? "bg-green-50 text-green-900" : "bg-amber-50 text-amber-900"
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            {quorumOk ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            )}
            {quorumOk ? "Kvorumas yra" : "Kvorumo nėra"}
          </div>
          <p className="text-xs mt-1 opacity-80">
            {quorumRequired > 0
              ? `Užregistruota ${attendingCount} iš ${quorumRequired} reikalingų (bendras narių skaičius: ${totalMembersAtTime}).`
              : `Kvorumas neribojamas (pakartotinis susirinkimas, įstatų 4.6 p.). Užregistruota: ${attendingCount}.`}
          </p>
          <p className="text-xs mt-0.5 opacity-70">Bazė: {quorumBasisLabel(meetingType)}.</p>
        </div>

        {electorateRecorded ? <p className="mb-3 text-sm text-green-800">Susirinkimo laiko narių bazė užfiksuota ir vėlesnių narystės pokyčių nebekeičiama.</p> : <div className="mb-3 space-y-2 text-sm text-amber-900">
          <p>Susirinkimo pradžioje užfiksuokite narių bazę, net jei nesusirinko kvorumas. Istoriniam susirinkimui skiltyje „Kvorumas“ įrašykite dokumentuotą to laiko skaičių ir šaltinį.</p>
          {!isFinished && <Button size="sm" variant="outline" onClick={async()=>{const result=await captureMeetingElectorate(meetingId);if(result.error)toast.error(result.error);else router.refresh();}}>Fiksuoti dabartinę narių bazę</Button>}
        </div>}
        {showQuorumEditor && (
          <QuorumEditor
            meetingType={meetingType}
            meetingId={meetingId}
            totalMembersAtTime={totalMembersAtTime}
            quorumRequired={quorumRequired}
            suggestion={suggestion}
            onSaved={() => {
              setShowQuorumEditor(false);
              startTransition(() => router.refresh());
            }}
          />
        )}

        {isFinished && canEdit && (
          <p className="text-xs text-gray-500">
            Susirinkimas jau baigtas – dalyvius vis tiek galima suvesti ar
            pataisyti (protokolas ir dalyvių sąrašas persiskaičiuoja iš karto).
          </p>
        )}

        {/* Paieška – visuotiniame susirinkime sąrašas ilgas */}
        {eligible.length > 12 && (
          <div className="relative">
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ieškoti nario..."
              className="w-full text-sm rounded-lg border border-gray-300 pl-9 pr-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}

        {eligible.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
            <p className="font-semibold">Registruoti nėra ko</p>
            <p className="text-xs mt-1">
              {isCouncilMeeting(meetingType)
                ? "Nerasta nė vieno dabartinio Tarybos nario. Patikrinkite valdymo organų sąrašą (community_management, is_current = true)."
                : "Nerasta nė vieno balso teisę turinčio nario."}
            </p>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-[32rem] overflow-y-auto">
            {filtered.map((m) => {
              const record = byMemberId.get(m.id);
              const isAttending = !!record;
              const busy = pendingId === m.id;
              return (
                <div
                  key={m.id}
                  className={`flex flex-wrap items-center gap-3 px-3 py-2 ${
                    isAttending ? "bg-green-50/50" : ""
                  } ${busy ? "opacity-50" : ""}`}
                >
                  <label className="flex items-center gap-2 flex-1 min-w-[12rem] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isAttending}
                      disabled={!canEdit || busy}
                      onChange={(e) =>
                        e.target.checked ? mark(m.id, "fizinis") : unmark(m.id)
                      }
                      className="rounded border-gray-300 h-4 w-4"
                    />
                    <span className="text-sm text-gray-900">
                      {m.first_name} {m.last_name}
                    </span>
                    {m.role && (
                      <span className="text-xs text-gray-400">
                        {COUNCIL_ROLE_LABELS[m.role] || m.role}
                      </span>
                    )}
                  </label>

                  <div className="flex items-center gap-1">
                    {TYPE_OPTIONS.map((opt) => {
                      const active = record?.attendance_type === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={!canEdit || busy}
                          onClick={() => mark(m.id, opt.value)}
                          title={ATTENDANCE_TYPE_LABELS[opt.value]}
                          className={`text-xs px-2 py-1 rounded border transition-colors ${
                            active
                              ? "bg-green-600 border-green-600 text-white"
                              : "bg-white border-gray-200 text-gray-500 hover:border-green-300 hover:text-green-700"
                          } disabled:cursor-not-allowed`}
                        >
                          {opt.short}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-xs text-gray-400 px-3 py-4 text-center">
                Pagal paiešką narių nerasta
              </p>
            )}
          </div>
        )}

        {extraAttendees.length > 0 && (
          <div className="border border-gray-200 rounded-lg p-3">
            <p className="text-xs font-medium text-gray-600 flex items-center gap-1.5 mb-2">
              <UserMinus className="h-3.5 w-3.5" />
              Užregistruoti, bet šiandien į sąrašą nebepatenkantys ({extraAttendees.length})
            </p>
            <p className="text-xs text-gray-400 mb-2">
              Pvz. asmuo, kurio kadencija ar narystė pasibaigė po posėdžio. Įrašas
              lieka – protokolas turi atspindėti posėdžio momentą.
            </p>
            <div className="space-y-1">
              {extraAttendees.map((a) => (
                <div key={a.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">
                    {a.member?.first_name} {a.member?.last_name}{" "}
                    <span className="text-xs text-gray-400">
                      ({ATTENDANCE_TYPE_LABELS[a.attendance_type] || a.attendance_type})
                    </span>
                  </span>
                  {canEdit && (
                    <button
                      onClick={() => unmark(a.member_id)}
                      className="text-xs text-gray-400 hover:text-red-600"
                    >
                      Pašalinti
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QuorumEditor({
  meetingType,
  meetingId,
  totalMembersAtTime,
  quorumRequired,
  suggestion,
  onSaved,
}: {
  meetingId: string;
  totalMembersAtTime: number;
  quorumRequired: number;
  suggestion: { eligibleCount: number; suggestedQuorum: number };
  meetingType: string;
  onSaved: () => void;
}) {
  const [historicalMembers,setHistoricalMembers]=useState<Array<{id:string;first_name:string;last_name:string}>>([]);
  const [selectedIds,setSelectedIds]=useState<string[]>([]);
  useEffect(()=>{getMembers("","visi").then(setHistoricalMembers).catch(()=>toast.error("Nepavyko gauti narių sąrašo"));},[]);
  const [total, setTotal] = useState(String(totalMembersAtTime));
  const [quorum, setQuorum] = useState(String(quorumRequired));
  const [reference, setReference] = useState("");
  const [councilReference,setCouncilReference]=useState("");
  const [saving, setSaving] = useState(false);

  const differsFromSuggestion =
    Number(total) !== suggestion.eligibleCount || Number(quorum) !== suggestion.suggestedQuorum;

  async function handleSave() {
    setSaving(true);
    const result = await updateMeetingQuorum(meetingId, {
      total_members_at_time: Number(total) || 0,
      quorum_required: Number(quorum) || 0,
      electorate_reference: reference,
      council_reference: councilReference,
      electorate_member_ids: selectedIds,
    });
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Kvorumo duomenys atnaujinti");
    onSaved();
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
      <p className="text-sm font-semibold text-blue-900">Kvorumo duomenys</p>
      <p className="text-xs text-blue-800">
        Tik ankstesnės dienos ar senesniam susirinkimui nurodykite to susirinkimo narių registro išrašą ar kitą dokumentinį pagrindą. Išsaugojus su pagrindu bazė užfiksuojama. Šios dienos susirinkimui naudokite registro fiksavimo mygtuką, kai ateina jo pradžios laikas.
      </p>
      <label className="block text-sm">Susirinkimo laiko narių skaičių pagrindžiančio dokumento nuoroda
        <input value={reference} onChange={e=>setReference(e.target.value)} className="mt-1 w-full rounded border p-2" />
      </label>
      {meetingType==='valdybos' && <label className="block text-sm">To posėdžio Tarybos sudėties ir pareigų pagrindas
        <input value={councilReference} onChange={e=>setCouncilReference(e.target.value)} className="mt-1 w-full rounded border p-2" />
        <span className="block text-xs">Pažymėkite šešis Tarybos narius pagal šį dokumentą. Pareigų registre turi būti jų Tarybos arba Pirmininko pareigos su pradžios data. Kadencijos pabaiga savaime nepanaikina 5.7 p. tęstinumo.</span>
      </label>}
      <p className="text-sm">Pagal to laiko registro išrašą pažymėkite visus balso teisę turėjusius narius (ne vien dalyvius). Pažymėta: {selectedIds.length}.</p>
      <div className="max-h-48 overflow-auto">{historicalMembers.map(member=><label key={member.id} className="flex gap-2 text-sm"><input type="checkbox" checked={selectedIds.includes(member.id)} onChange={e=>setSelectedIds(ids=>e.target.checked?[...ids,member.id]:ids.filter(id=>id!==member.id))} />{member.first_name} {member.last_name}</label>)}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Bendras narių skaičius posėdžio metu
          </label>
          <input
            type="number"
            min={0}
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            className="w-full text-sm rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Kvorumui reikia
          </label>
          <input
            type="number"
            min={0}
            value={quorum}
            onChange={(e) => setQuorum(e.target.value)}
            className="w-full text-sm rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={handleSave} loading={saving}>
          Išsaugoti
        </Button>
        {differsFromSuggestion && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setTotal(String(suggestion.eligibleCount));
              setQuorum(String(suggestion.suggestedQuorum));
            }}
          >
            Siūlyti pagal šiandienos sąrašą ({suggestion.eligibleCount} →{" "}
            {suggestion.suggestedQuorum})
          </Button>
        )}
      </div>
    </div>
  );
}
