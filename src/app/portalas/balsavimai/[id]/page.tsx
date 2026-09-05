import { getMeetingForVoting, getMemberProfile } from "@/actions/portal";
import { PortalVotingFlow } from "./PortalVotingFlow";
import { AlreadyVotedView } from "./AlreadyVotedView";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getDict } from "@/lib/i18n-server";
import { formatDateLong } from "@/lib/utils";

export const dynamic = "force-dynamic";

type DocItem = {
  id: string;
  title: string;
  file_path: string;
  file_name: string;
  file_size: number | null;
  category: string;
};

type RawResolutionDocLink = {
  id: string;
  sort_order: number;
  document: DocItem | DocItem[] | null;
};

type RawResolution = {
  id: string;
  resolution_number: number;
  title: string;
  description: string | null;
  requires_qualified_majority: boolean;
  is_procedural: boolean;
  resolution_documents?: RawResolutionDocLink[];
};

export default async function PortalVotingPage({ params }: { params: { id: string } }) {
  const data = await getMeetingForVoting(params.id);
  if ("error" in data) notFound();

  // Garbės narys – patariamasis balsas, balsavimo forma nerodoma
  // (RPC cast_votes_as_member tokį bandymą vis tiek atmestų su 'not_eligible').
  const profile = (await getMemberProfile()) as { member?: { status?: string } | null };
  if (profile?.member?.status === "garbes_narys") {
    const t = getDict().portalVoting;
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{data.meeting.title}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {formatDateLong(data.meeting.meeting_date)} · {data.meeting.location}
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <h2 className="font-semibold text-amber-900 mb-2">{t.honoraryNoticeTitle}</h2>
          <p className="text-sm text-amber-800 leading-relaxed">{t.honoraryNoticeBody}</p>
          <Link
            href={`/susirinkimai/${data.meeting.id}`}
            className="inline-block mt-4 text-sm font-medium text-green-700 hover:underline"
          >
            {t.honoraryViewMeetingLink}
          </Link>
        </div>
      </div>
    );
  }

  const resolutions = (data.resolutions as unknown as RawResolution[]).map((r) => {
    const docs: DocItem[] = (r.resolution_documents || [])
      .map((rd) => (Array.isArray(rd.document) ? rd.document[0] : rd.document))
      .filter((d): d is DocItem => d !== null && d !== undefined);
    return {
      id: r.id,
      resolution_number: r.resolution_number,
      title: r.title,
      description: r.description,
      requires_qualified_majority: r.requires_qualified_majority,
      is_procedural: r.is_procedural,
      documents: docs,
    };
  });

  // Jei narys jau balsavo - rodyti balsų santrauką, ne formą
  if (data.hasVoted) {
    const votesMap = new Map(data.memberVotes.map((v) => [v.resolution_id, v]));
    return (
      <AlreadyVotedView
        meetingId={data.meeting.id}
        meeting={{
          title: data.meeting.title,
          meeting_date: data.meeting.meeting_date,
          location: data.meeting.location,
        }}
        resolutions={resolutions.map((r) => ({
          ...r,
          memberVote: votesMap.get(r.id)?.vote as "uz" | "pries" | "susilaike" | undefined,
          votedAt: votesMap.get(r.id)?.voted_at,
        }))}
      />
    );
  }

  return (
    <PortalVotingFlow
      meetingId={data.meeting.id}
      meeting={{
        title: data.meeting.title,
        meeting_date: data.meeting.meeting_date,
        location: data.meeting.location,
        description: data.meeting.description,
      }}
      resolutions={resolutions}
    />
  );
}
