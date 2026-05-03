import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { getMeeting, getMeetingAttendance } from "@/actions/meetings";
import { getResolutions } from "@/actions/voting";
import { MEETING_TYPE_LABELS, MEETING_STATUS_LABELS } from "@/lib/constants";
import { formatDateLong, formatFileSize, getDocumentPublicUrl } from "@/lib/utils";
import {
  Calendar,
  MapPin,
  Users,
  ArrowLeft,
  FileText,
  ExternalLink,
  CheckCircle2,
  XCircle,
  CircleDashed,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

interface ResolutionDocLink {
  id: string;
  sort_order: number;
  document: {
    id: string;
    title: string;
    file_path: string;
    file_size: number | null;
  } | null;
}

interface ResolutionRow {
  id: string;
  resolution_number: number;
  title: string;
  description: string | null;
  status: string;
  is_procedural: boolean;
  procedural_type: string | null;
  requires_qualified_majority: boolean;
  discussion_text: string | null;
  decision_text: string | null;
  result_for: number;
  result_against: number;
  result_abstain: number;
  resolution_documents?: ResolutionDocLink[];
}

function statusColor(status: string) {
  switch (status) {
    case "planuojamas":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "vyksta":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "baigtas":
      return "bg-green-50 text-green-700 border-green-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

export default async function MeetingArchivePage({ params }: { params: { id: string } }) {
  let meeting;
  try {
    meeting = await getMeeting(params.id);
  } catch {
    notFound();
  }
  if (!meeting) notFound();

  const resolutions = (await getResolutions(params.id)) as ResolutionRow[];
  const attendance = await getMeetingAttendance(params.id);

  const isFinished = meeting.status === "baigtas";
  const totalAttended = attendance.length;
  const liveCount = attendance.filter((a) => a.attendance_type === "fizinis").length;
  const remoteCount = attendance.filter((a) => a.attendance_type === "nuotolinis").length;

  const procedural = resolutions.filter((r) => r.is_procedural);
  const standard = resolutions.filter((r) => !r.is_procedural);

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      <main className="flex-1 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <Link
            href="/susirinkimai"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Visi susirinkimai
          </Link>

          {/* Header */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <h1 className="text-2xl font-bold text-gray-900">{meeting.title}</h1>
              <span
                className={`text-xs px-2.5 py-1 rounded border ${statusColor(meeting.status)}`}
              >
                {MEETING_STATUS_LABELS[meeting.status]}
              </span>
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {formatDateLong(meeting.meeting_date)}{" "}
                {new Date(meeting.meeting_date).toLocaleTimeString("lt-LT", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {meeting.location}
              </span>
              <span className="text-gray-400">{MEETING_TYPE_LABELS[meeting.meeting_type]}</span>
            </div>

            {meeting.description && (
              <p className="mt-4 text-sm text-gray-700 whitespace-pre-wrap border-t border-gray-100 pt-4">
                {meeting.description}
              </p>
            )}
          </div>

          {/* Procedūriniai klausimai (jei užbaigta) */}
          {isFinished && procedural.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Procedūriniai klausimai
              </h2>
              <ul className="space-y-2 text-sm">
                {procedural.map((r) => (
                  <li key={r.id} className="text-gray-700">
                    <span className="font-medium">{r.resolution_number}.</span> {r.title}
                    {r.decision_text && (
                      <span className="text-gray-500"> – {r.decision_text}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Darbotvarkė */}
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Darbotvarkė</h2>
          <div className="space-y-3 mb-6">
            {standard.map((r) => (
              <ResolutionCard key={r.id} resolution={r} showResults={isFinished} />
            ))}
          </div>

          {/* Dalyviai */}
          {totalAttended > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                Dalyviai ({totalAttended})
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                Iš jų: {liveCount} gyvai, {remoteCount} nuotoliu
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                {attendance.map((a) => {
                  type AnyMember = { first_name?: string; last_name?: string } | null;
                  const m = (Array.isArray(a.member) ? a.member[0] : a.member) as AnyMember;
                  return (
                    <li key={a.id} className="flex items-center gap-2 text-gray-700">
                      <Users className="h-3.5 w-3.5 text-gray-400" />
                      {m?.first_name} {m?.last_name}
                      <span className="text-xs text-gray-400 ml-auto">
                        {a.attendance_type === "fizinis"
                          ? "gyvai"
                          : a.attendance_type === "nuotolinis"
                            ? "nuotoliu"
                            : "raštu"}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-100">
                Kvorumui reikalinga: {meeting.quorum_required} narių · Iš viso narių susirinkimo metu:{" "}
                {meeting.total_members_at_time}
              </p>
            </div>
          )}

          {/* Pastabos kai dar nėra rezultatų */}
          {!isFinished && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 text-sm text-blue-900">
              <p className="font-medium mb-1">Susirinkimas dar neužbaigtas</p>
              <p className="text-blue-800">
                Balsavimo rezultatai, dalyvių sąrašas ir protokolas bus pateikti čia po susirinkimo
                pabaigos.
              </p>
            </div>
          )}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

function ResolutionCard({
  resolution,
  showResults,
}: {
  resolution: ResolutionRow;
  showResults: boolean;
}) {
  const docs =
    resolution.resolution_documents
      ?.map((rd) => rd.document)
      .filter((d): d is NonNullable<typeof d> => d !== null) || [];

  const totalVotes =
    resolution.result_for + resolution.result_against + resolution.result_abstain;
  const isPassed = resolution.requires_qualified_majority
    ? resolution.result_for >= Math.ceil((totalVotes * 2) / 3)
    : resolution.result_for > resolution.result_against;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-5">
        <div className="flex items-start gap-3">
          <span className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 text-green-700 text-sm font-semibold flex items-center justify-center">
            {resolution.resolution_number}
          </span>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">{resolution.title}</h3>
            {resolution.description && (
              <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">
                {resolution.description}
              </p>
            )}
            {resolution.requires_qualified_majority && (
              <p className="text-xs text-amber-700 mt-2">Reikalinga 2/3 balsų dauguma</p>
            )}
          </div>
        </div>

        {docs.length > 0 && (
          <div className="mt-4 ml-11 space-y-1.5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Susiję dokumentai
            </p>
            {docs.map((doc) => (
              <a
                key={doc.id}
                href={getDocumentPublicUrl(doc.file_path)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-green-700 hover:text-green-800 hover:underline"
              >
                <FileText className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1">{doc.title}</span>
                {doc.file_size && (
                  <span className="text-xs text-gray-500">{formatFileSize(doc.file_size)}</span>
                )}
                <ExternalLink className="h-3.5 w-3.5 text-gray-400" />
              </a>
            ))}
          </div>
        )}

        {showResults && totalVotes > 0 && (
          <div className="mt-4 ml-11 bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                Balsavimo rezultatas
              </span>
              {resolution.status === "patvirtintas" && (
                <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Priimta
                </span>
              )}
              {resolution.status === "atmestas" && (
                <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-100 px-2 py-0.5 rounded font-medium">
                  <XCircle className="h-3.5 w-3.5" /> Nepriimta
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-xl font-bold text-green-700">{resolution.result_for}</div>
                <div className="text-xs text-gray-500">Už</div>
              </div>
              <div>
                <div className="text-xl font-bold text-red-700">{resolution.result_against}</div>
                <div className="text-xs text-gray-500">Prieš</div>
              </div>
              <div>
                <div className="text-xl font-bold text-gray-500">{resolution.result_abstain}</div>
                <div className="text-xs text-gray-500">Susilaikė</div>
              </div>
            </div>
            {!isPassed && totalVotes > 0 && resolution.status !== "patvirtintas" && (
              <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                <CircleDashed className="h-3 w-3" />
                Dauguma nepasiekta
              </p>
            )}
          </div>
        )}

        {showResults && resolution.decision_text && (
          <div className="mt-3 ml-11 text-sm text-gray-700 italic border-l-2 border-green-200 pl-3">
            {resolution.decision_text}
          </div>
        )}
      </div>
    </div>
  );
}
