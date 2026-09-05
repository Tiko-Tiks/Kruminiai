import { getMeetingForVoting, getMemberProfile } from "@/actions/portal";
import { PortalVotingFlow } from "./PortalVotingFlow";
import { AlreadyVotedView } from "./AlreadyVotedView";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getDict } from "@/lib/i18n-server";
import { formatDateLong } from "@/lib/utils";
import { isVotingWindowOpen, type VotingWindowMeeting } from "@/lib/voting-window";

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

  // Balso teisę turi tik aktyvus/pasyvus narys – kitiems (garbės narys,
  // išstojęs) balsavimo forma nerodoma. RPC cast_votes_as_member tokį bandymą
  // vis tiek atmestų su 'not_eligible'.
  const profile = (await getMemberProfile()) as { member?: { status?: string } | null };
  const memberStatus = profile?.member?.status ?? "";
  const isEligible = memberStatus === "aktyvus" || memberStatus === "pasyvus";
  const isHonorary = memberStatus === "garbes_narys";
  if (!isEligible) {
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
          <h2 className="font-semibold text-amber-900 mb-2">
            {isHonorary ? t.honoraryNoticeTitle : t.notEligibleNoticeTitle}
          </h2>
          <p className="text-sm text-amber-800 leading-relaxed">
            {isHonorary ? t.honoraryNoticeBody : t.notEligibleNoticeBody}
          </p>
          <Link
            href={`/portalas/susirinkimai/${data.meeting.id}`}
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

  // Balsavimo langas uždarytas (susirinkimas prasidėjo / baigtas / už
  // išankstinio balsavimo laikotarpio) – rodom pranešimą, ne formą.
  // RPC cast_votes_as_member tą patį tikrina serveryje ('voting_closed').
  const votingClosed = !isVotingWindowOpen(data.meeting as unknown as VotingWindowMeeting);
  if (votingClosed) {
    const t = getDict().portalVoting;
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{data.meeting.title}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {formatDateLong(data.meeting.meeting_date)} · {data.meeting.location}
          </p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
          <h2 className="font-semibold text-gray-900 mb-2">{t.votingClosedTitle}</h2>
          <p className="text-sm text-gray-600 leading-relaxed">{t.votingClosedBody}</p>
          <Link
            href={`/portalas/susirinkimai/${data.meeting.id}`}
            className="inline-block mt-4 text-sm font-medium text-green-700 hover:underline"
          >
            {t.honoraryViewMeetingLink}
          </Link>
        </div>
      </div>
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
