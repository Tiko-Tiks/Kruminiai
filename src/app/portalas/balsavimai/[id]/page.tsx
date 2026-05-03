import { getMeetingForVoting } from "@/actions/portal";
import { PortalVotingFlow } from "./PortalVotingFlow";
import { AlreadyVotedView } from "./AlreadyVotedView";
import { notFound } from "next/navigation";

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
