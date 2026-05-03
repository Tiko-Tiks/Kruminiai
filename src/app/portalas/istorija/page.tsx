import { getMemberVotingHistory } from "@/actions/portal";
import { formatDateLong } from "@/lib/utils";
import { VOTE_LABELS } from "@/lib/constants";
import { History, Calendar, FileText } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface VoteEntry {
  resolution_number: number;
  resolution_title: string;
  vote: "uz" | "pries" | "susilaike";
  vote_type: string;
  voted_at: string;
}

interface HistoryEntry {
  meeting_id: string;
  meeting_title: string;
  meeting_date: string;
  meeting_status: string;
  votes: VoteEntry[] | null;
}

const voteColors = {
  uz: "text-green-700 bg-green-50",
  pries: "text-red-700 bg-red-50",
  susilaike: "text-gray-700 bg-gray-100",
};

export default async function PortalHistoryPage() {
  const data = (await getMemberVotingHistory()) as { history?: HistoryEntry[]; error?: string };
  const history = data?.history || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mano balsavimo istorija</h1>
        <p className="text-sm text-gray-500 mt-1">Visi jūsų balsai bendruomenės susirinkimuose</p>
      </div>

      {history.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <History className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Dar nedalyvavote nė viename balsavime</p>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((h) => (
            <div key={h.meeting_id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-5 border-b border-gray-100 bg-gray-50">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-gray-900">{h.meeting_title}</h2>
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDateLong(h.meeting_date)}
                    </p>
                  </div>
                  <Link
                    href={`/susirinkimai/${h.meeting_id}`}
                    className="text-xs text-green-700 hover:text-green-800 font-medium flex items-center gap-1"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Dokumentai
                  </Link>
                </div>
              </div>
              <div className="divide-y divide-gray-100">
                {(h.votes || []).map((v, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold flex items-center justify-center">
                      {v.resolution_number}
                    </span>
                    <p className="flex-1 text-sm text-gray-700">{v.resolution_title}</p>
                    <span
                      className={`flex-shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold ${voteColors[v.vote]}`}
                    >
                      {VOTE_LABELS[v.vote]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
