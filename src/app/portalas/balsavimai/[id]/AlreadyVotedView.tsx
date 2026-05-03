import Link from "next/link";
import { ArrowLeft, Calendar, MapPin, CheckCircle2, FileText } from "lucide-react";
import { formatDateLong, formatFileSize, getDocumentPublicUrl } from "@/lib/utils";
import { VOTE_LABELS } from "@/lib/constants";

interface DocItem {
  id: string;
  title: string;
  file_path: string;
  file_size: number | null;
}

interface ResolutionWithVote {
  id: string;
  resolution_number: number;
  title: string;
  description: string | null;
  documents: DocItem[];
  memberVote?: "uz" | "pries" | "susilaike";
  votedAt?: string;
}

const voteColors = {
  uz: "text-green-700 bg-green-50 border-green-200",
  pries: "text-red-700 bg-red-50 border-red-200",
  susilaike: "text-gray-700 bg-gray-100 border-gray-200",
};

export function AlreadyVotedView({
  meetingId,
  meeting,
  resolutions,
}: {
  meetingId: string;
  meeting: { title: string; meeting_date: string; location: string };
  resolutions: ResolutionWithVote[];
}) {
  const firstVotedAt = resolutions.find((r) => r.votedAt)?.votedAt;

  return (
    <div className="space-y-5">
      <Link
        href="/portalas/balsavimai"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Visi balsavimai
      </Link>

      {/* Susirinkimo info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h1 className="text-xl font-semibold text-gray-900 mb-3">{meeting.title}</h1>
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
        </div>
      </div>

      {/* Balso patvirtinimo blokas */}
      <div className="bg-green-50 border-l-4 border-green-500 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="font-semibold text-green-900 mb-1">Jūs jau balsavote</h2>
            <p className="text-sm text-green-800">
              {firstVotedAt
                ? `Jūsų balsai užregistruoti ${new Date(firstVotedAt).toLocaleString("lt-LT", {
                    timeZone: "Europe/Vilnius",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}.`
                : "Jūsų balsai užregistruoti."}{" "}
              Pakartotinai balsuoti negalima.
            </p>
          </div>
        </div>
      </div>

      {/* Balsų suvestinė */}
      <h2 className="text-lg font-semibold text-gray-900">Jūsų balsai</h2>
      <div className="space-y-3">
        {resolutions.map((r) => (
          <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-100 text-gray-700 text-sm font-semibold flex items-center justify-center">
                {r.resolution_number}
              </span>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900">{r.title}</h3>
                {r.description && (
                  <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{r.description}</p>
                )}
                {r.documents.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {r.documents.map((d) => (
                      <a
                        key={d.id}
                        href={getDocumentPublicUrl(d.file_path)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-green-700 hover:text-green-800 hover:underline"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        {d.title}
                        {d.file_size && (
                          <span className="text-gray-500">({formatFileSize(d.file_size)})</span>
                        )}
                      </a>
                    ))}
                  </div>
                )}
              </div>
              {r.memberVote && (
                <span
                  className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold border ${voteColors[r.memberVote]}`}
                >
                  {VOTE_LABELS[r.memberVote]}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/portalas/susirinkimai/${meetingId}`}
          className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
        >
          <FileText className="h-4 w-4" />
          Visas susirinkimo archyvas
        </Link>
        <Link
          href="/portalas/istorija"
          className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
        >
          Mano istorija
        </Link>
      </div>
    </div>
  );
}
