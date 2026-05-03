import { getMeeting, getMeetingAttendance } from "@/actions/meetings";
import { getResolutions } from "@/actions/voting";
import { getMembers } from "@/actions/members";
import { getDocuments } from "@/actions/documents";
import { getVotingTokensStats } from "@/actions/tokens";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { MEETING_STATUS_LABELS, MEETING_TYPE_LABELS } from "@/lib/constants";
import { formatDateLong } from "@/lib/utils";
import { Calendar, MapPin, Users, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { MeetingControls } from "./MeetingControls";
import { ResolutionsList } from "./ResolutionsList";
import { AttendanceManager } from "./AttendanceManager";
import { AddResolutionForm } from "./AddResolutionForm";
import { RemoteVotingPanel } from "./RemoteVotingPanel";

function statusVariant(status: string) {
  switch (status) {
    case "planuojamas": return "info" as const;
    case "vyksta": return "warning" as const;
    case "baigtas": return "success" as const;
    case "atšauktas": return "danger" as const;
    default: return "default" as const;
  }
}

export const metadata = {
  title: "Susirinkimas | Administravimas",
};

export default async function MeetingDetailPage({ params }: { params: { id: string } }) {
  const meeting = await getMeeting(params.id);
  const resolutions = await getResolutions(params.id);
  const attendance = await getMeetingAttendance(params.id);
  const allMembers = await getMembers(undefined, "aktyvus");
  const allDocuments = await getDocuments();
  const tokenStats = await getVotingTokensStats(params.id);

  return (
    <div>
      <Link
        href="/admin/susirinkimai"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Visi susirinkimai
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-gray-900">{meeting.title}</h1>
            <Badge variant={statusVariant(meeting.status)}>
              {MEETING_STATUS_LABELS[meeting.status]}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {formatDateLong(meeting.meeting_date)}
              {" "}
              {new Date(meeting.meeting_date).toLocaleTimeString("lt-LT", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            {meeting.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {meeting.location}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              {MEETING_TYPE_LABELS[meeting.meeting_type]}
            </span>
          </div>
        </div>
        <MeetingControls meeting={meeting} />
      </div>

      {meeting.description && (
        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-sm font-medium text-gray-500">Darbotvarkė / aprašymas</h2>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 whitespace-pre-wrap">{meeting.description}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Resolutions - main content */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Nutarimai ({resolutions.length})
            </h2>
          </div>

          {meeting.status !== "atšauktas" && meeting.status !== "baigtas" && (
            <AddResolutionForm meetingId={meeting.id} />
          )}

          <ResolutionsList
            resolutions={resolutions}
            meetingId={meeting.id}
            meetingStatus={meeting.status}
            allDocuments={allDocuments}
          />
        </div>

        {/* Attendance sidebar */}
        <div className="space-y-6">
          <RemoteVotingPanel meetingId={meeting.id} stats={tokenStats} />
          <AttendanceManager
            meetingId={meeting.id}
            attendance={attendance}
            allMembers={allMembers}
            quorumRequired={meeting.quorum_required}
            meetingStatus={meeting.status}
          />
        </div>
      </div>
    </div>
  );
}
