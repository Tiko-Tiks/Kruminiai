import {
  getMeeting,
  getMeetingAttendance,
  getEligibleAttendees,
  getQuorumSuggestion,
} from "@/actions/meetings";
import { getResolutions } from "@/actions/voting";
import { getDocuments } from "@/actions/documents";
import { getVotingTokensStats } from "@/actions/tokens";
import { getMeetingAnnouncements } from "@/actions/announcements";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { MEETING_STATUS_LABELS, MEETING_TYPE_LABELS } from "@/lib/constants";
import { formatDateLong, formatTime } from "@/lib/utils";
import { Calendar, MapPin, Users, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { MeetingControls } from "./MeetingControls";
import { ResolutionsList } from "./ResolutionsList";
import { AttendanceManager } from "./AttendanceManager";
import { AddResolutionForm } from "./AddResolutionForm";
import { RemoteVotingPanel } from "./RemoteVotingPanel";
import { MeetingDocumentsPanel } from "./MeetingDocumentsPanel";
import { AnnouncementsPanel } from "./AnnouncementsPanel";
import { MeetingEndTimeEditor } from "./MeetingEndTimeEditor";
import { isCouncilMeeting } from "@/lib/quorum";

async function getCommunityChairpersonName(): Promise<string | null> {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from("community_management")
    .select("member:members(first_name, last_name)")
    .eq("role", "pirmininkas")
    .eq("is_current", true)
    .maybeSingle();
  const m = data?.member as { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
  if (!m) return null;
  const mm = Array.isArray(m) ? m[0] : m;
  return mm ? `${mm.first_name} ${mm.last_name}` : null;
}

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
  // Kas gali būti registruojamas – PRIKLAUSO NUO POSĖDŽIO TIPO:
  // Tarybos posėdyje tik dabartiniai Tarybos nariai, kituose – visi balso
  // teisę turintys nariai (įsk. garbės narius, migr. 042).
  const eligibleAttendees = await getEligibleAttendees(meeting.meeting_type, meeting.id);
  const quorumSuggestion = await getQuorumSuggestion(meeting.meeting_type);
  const allDocuments = await getDocuments();
  const tokenStats = await getVotingTokensStats(params.id);
  const communityChairpersonName = await getCommunityChairpersonName();
  const announcements = await getMeetingAnnouncements(params.id);

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
              {formatDateLong(meeting.meeting_date)} {formatTime(meeting.meeting_date)}
              {meeting.ended_at ? `–${formatTime(meeting.ended_at)}` : ""}
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

      {/* Skelbimų panelis – fiksuojam, kur ir kada paskelbta apie susirinkimą.
          Reikalinga įstatų atitikimui (min. 14 d. prieš susirinkimą). */}
      <div className="mb-6">
        <AnnouncementsPanel
          meetingId={meeting.id}
          meetingDate={meeting.meeting_date}
          meetingType={meeting.meeting_type}
          repeatPolicy={meeting}
          announcements={announcements}
        />
      </div>

      {/* Posėdžio pabaigos laikas – iki šiol buvo tik automatinis (statusas
          → „baigtas"), todėl klaidą tekdavo taisyti per SQL. */}
      <div className="mb-6">
        <MeetingEndTimeEditor
          meetingId={meeting.id}
          meetingDate={meeting.meeting_date}
          endedAt={meeting.ended_at}
        />
      </div>

      {/* Dalyvių registracija – pilno pločio blokas, nes tai pirmas
          susirinkimo veiksmas (be dalyvių nėra nei kvorumo, nei protokolo) */}
      <div className="mb-6">
        <AttendanceManager
          meetingId={meeting.id}
          meetingType={meeting.meeting_type}
          meetingStatus={meeting.status}
          attendance={attendance}
          eligible={eligibleAttendees}
          electorateRecorded={!!meeting.electorate_snapshot}
          totalMembersAtTime={meeting.total_members_at_time}
          quorumRequired={meeting.quorum_required}
          suggestion={quorumSuggestion}
        />
      </div>

      {/* Greitas dokumentų panelis – susirinkimo metu pirmininkui patogu */}
      <MeetingDocumentsPanel resolutions={resolutions} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Resolutions - main content */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Nutarimai ({resolutions.length})
            </h2>
          </div>

          {meeting.status !== "atšauktas" && meeting.status !== "baigtas" && (
            <AddResolutionForm meetingId={meeting.id} allDocuments={allDocuments} />
          )}

          <ResolutionsList
            resolutions={resolutions}
            meetingId={meeting.id}
            meetingStatus={meeting.status}
            allDocuments={allDocuments}
            liveAttendees={attendance.filter((a) => a.attendance_type === "fizinis")}
            communityChairpersonName={communityChairpersonName}
            currentChairpersonName={meeting.chairperson_name}
            currentSecretaryName={meeting.secretary_name}
          />
        </div>

        {/* Nuotolinio balsavimo sidebar.
            Tarybos posėdyje nerodom: SMS balsavimo tokenai generuojami VISIEMS
            balso teisę turintiems nariams, o Tarybos posėdyje sprendžia tik
            Tarybos nariai (įstatų 5.5 p.) – išsiuntimas būtų ir klaidingas,
            ir apmokamas 79 SMS. */}
        <div className="space-y-6">
          {!isCouncilMeeting(meeting.meeting_type) && (
            <RemoteVotingPanel meetingId={meeting.id} stats={tokenStats} />
          )}
        </div>
      </div>
    </div>
  );
}
