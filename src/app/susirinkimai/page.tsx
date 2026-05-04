import { SiteHeader } from "@/components/layout/SiteHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { getMeetings } from "@/actions/meetings";
import { MEETING_TYPE_LABELS, MEETING_STATUS_LABELS } from "@/lib/constants";
import { formatDateLong } from "@/lib/utils";
import { Calendar, MapPin, ChevronRight } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Susirinkimai",
  description:
    "Krūminių kaimo bendruomenės visuotinių susirinkimų sąrašas, darbotvarkės ir nutarimai.",
  alternates: { canonical: "/susirinkimai" },
  openGraph: {
    title: "Susirinkimai",
    description:
      "Visuotinių susirinkimų darbotvarkės, nutarimai ir dokumentai.",
    url: "/susirinkimai",
  },
};

export const dynamic = "force-dynamic";

function statusColor(status: string) {
  switch (status) {
    case "planuojamas":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "vyksta":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "baigtas":
      return "bg-green-50 text-green-700 border-green-200";
    case "atšauktas":
      return "bg-gray-100 text-gray-500 border-gray-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

export default async function MeetingsPage() {
  const meetings = await getMeetings();
  const visible = meetings.filter((m) => m.status !== "atšauktas");

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Susirinkimai</h1>
          <p className="text-gray-500 mb-8">
            Bendruomenės narių susirinkimai – darbotvarkės, dokumentai, sprendimai
          </p>

          {visible.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <p className="text-gray-400">Susirinkimų kol kas nėra</p>
            </div>
          ) : (
            <div className="space-y-3">
              {visible.map((m) => (
                <Link
                  key={m.id}
                  href={`/susirinkimai/${m.id}`}
                  className="block bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all p-5"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h2 className="font-semibold text-gray-900">{m.title}</h2>
                        <span
                          className={`text-xs px-2 py-0.5 rounded border ${statusColor(m.status)}`}
                        >
                          {MEETING_STATUS_LABELS[m.status]}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-4 w-4" />
                          {formatDateLong(m.meeting_date)}{" "}
                          {new Date(m.meeting_date).toLocaleTimeString("lt-LT", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <MapPin className="h-4 w-4" />
                          {m.location}
                        </span>
                        <span className="text-gray-400">{MEETING_TYPE_LABELS[m.meeting_type]}</span>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-300 flex-shrink-0 mt-1" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
