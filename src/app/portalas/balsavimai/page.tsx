import { getMemberActiveMeetings } from "@/actions/portal";
import { formatDateLong } from "@/lib/utils";
import { Calendar, MapPin, CheckCircle2, Vote, ArrowRight } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface MeetingItem {
  id: string;
  title: string;
  meeting_date: string;
  location: string;
  status: string;
  has_voted: boolean;
}

export default async function PortalVotingsPage() {
  const data = (await getMemberActiveMeetings()) as { meetings?: MeetingItem[]; error?: string };
  const meetings = data?.meetings || [];
  const pending = meetings.filter((m) => !m.has_voted);
  const voted = meetings.filter((m) => m.has_voted);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Balsavimai</h1>
        <p className="text-sm text-gray-500 mt-1">
          Aktyvūs ir artėjantys susirinkimai, kuriuose galite balsuoti
        </p>
      </div>

      {meetings.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Vote className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Aktyvių balsavimų nėra</p>
        </div>
      )}

      {pending.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Laukia jūsų balso ({pending.length})
          </h2>
          <div className="space-y-3">
            {pending.map((m) => (
              <Link
                key={m.id}
                href={`/portalas/balsavimai/${m.id}`}
                className="block bg-white rounded-xl border-2 border-amber-300 p-5 hover:border-amber-400 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 mb-1">{m.title}</h3>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {formatDateLong(m.meeting_date)}{" "}
                        {new Date(m.meeting_date).toLocaleTimeString("lt-LT", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {m.location}
                      </span>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white text-sm font-semibold rounded-lg flex-shrink-0">
                    Balsuoti <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {voted.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Jau balsavote ({voted.length})
          </h2>
          <div className="space-y-3">
            {voted.map((m) => (
              <div
                key={m.id}
                className="bg-white rounded-xl border border-gray-200 p-5 opacity-75"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 mb-1">{m.title}</h3>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDateLong(m.meeting_date)}
                      </span>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-1 rounded font-medium flex-shrink-0">
                    <CheckCircle2 className="h-3 w-3" /> Balsavote
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
