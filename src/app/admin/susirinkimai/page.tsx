import { getMeetings } from "@/actions/meetings";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MEETING_STATUS_LABELS, MEETING_TYPE_LABELS } from "@/lib/constants";
import { formatDateLong } from "@/lib/utils";
import { Plus, MapPin, Users, Calendar } from "lucide-react";
import Link from "next/link";

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
  title: "Susirinkimai | Administravimas",
};

export default async function MeetingsPage() {
  const meetings = await getMeetings();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Susirinkimai</h1>
          <p className="text-sm text-gray-500 mt-1">{meetings.length} susirinkimų</p>
        </div>
        <Link href="/admin/susirinkimai/naujas">
          <Button>
            <Plus className="h-4 w-4" /> Naujas susirinkimas
          </Button>
        </Link>
      </div>

      {meetings.length === 0 ? (
        <Card>
          <div className="p-12 text-center text-gray-400">
            Dar nėra susirinkimų. Sukurkite pirmąjį!
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {meetings.map((meeting) => (
            <Link key={meeting.id} href={`/admin/susirinkimai/${meeting.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-lg font-semibold text-gray-900 truncate">
                          {meeting.title}
                        </h2>
                        <Badge variant={statusVariant(meeting.status)}>
                          {MEETING_STATUS_LABELS[meeting.status]}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-4 w-4" />
                          {formatDateLong(meeting.meeting_date)}
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
                        {meeting.quorum_required > 0 && (
                          <span className="text-xs text-gray-400">
                            Kvorumas: {meeting.quorum_required}
                          </span>
                        )}
                      </div>
                      {meeting.description && (
                        <p className="mt-2 text-sm text-gray-600 line-clamp-2">{meeting.description}</p>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
