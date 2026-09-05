import { getMemberActiveMeetings, getMemberProfile } from "@/actions/portal";
import { formatDateLong } from "@/lib/utils";
import { getDict } from "@/lib/i18n-server";
import { isVotingWindowOpen } from "@/lib/voting-window";
import { Calendar, MapPin, CheckCircle2, Vote, ArrowRight } from "lucide-react";
import Link from "next/link";
import { ACTIVE_MEMBER_STATUSES } from "@/lib/constants";

export const dynamic = "force-dynamic";

interface MeetingItem {
  id: string;
  title: string;
  meeting_date: string;
  location: string;
  status: string;
  has_voted: boolean;
  early_voting_start?: string | null;
  early_voting_end?: string | null;
}

export default async function PortalVotingsPage() {
  const data = (await getMemberActiveMeetings()) as { meetings?: MeetingItem[]; error?: string };
  const meetings = data?.meetings || [];
  // „Laukia balso" – tik kai balsavimo langas atviras (RPC tą patį tikrina).
  const pending = meetings.filter((m) => !m.has_voted && isVotingWindowOpen(m));
  const closed = meetings.filter((m) => !m.has_voted && !isVotingWindowOpen(m));
  const voted = meetings.filter((m) => m.has_voted);
  const t = getDict().portalVoting;
  // Balso teisę turi visi esami nariai – įsk. garbės narius. Neturi tik
  // išstojęs (RPC cast_votes_as_member tikrina tą patį per is_voting_status).
  const profile = (await getMemberProfile()) as { member?: { status?: string } | null };
  const memberStatus = profile?.member?.status ?? "";
  const isEligible = ACTIVE_MEMBER_STATUSES.includes(memberStatus);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t.pageTitle}</h1>
        <p className="text-sm text-gray-500 mt-1">{t.pageSubtitle}</p>
      </div>

      {!isEligible && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <h2 className="font-semibold text-amber-900 mb-1">{t.notEligibleNoticeTitle}</h2>
          <p className="text-sm text-amber-800 leading-relaxed">{t.notEligibleNoticeBody}</p>
        </div>
      )}

      {/* Be balso teisės – tik informacinės nuorodos į susirinkimo puslapį (be „Balsuoti") */}
      {!isEligible && meetings.length > 0 && (
        <section className="space-y-3">
          {meetings.map((m) => (
            <Link
              key={m.id}
              href={`/portalas/susirinkimai/${m.id}`}
              className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-green-300 hover:shadow-sm transition-all"
            >
              <h3 className="font-semibold text-gray-900 mb-1">{m.title}</h3>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-600 mb-2">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {formatDateLong(m.meeting_date)}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {m.location}
                </span>
              </div>
              <span className="text-sm font-medium text-green-700">{t.viewMeetingLink}</span>
            </Link>
          ))}
        </section>
      )}

      {meetings.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Vote className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">{t.emptyState}</p>
        </div>
      )}

      {isEligible && pending.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            {t.pendingSectionTitle.replace("{count}", String(pending.length))}
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
                        {new Date(m.meeting_date).toLocaleTimeString("lt-LT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Vilnius" })}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {m.location}
                      </span>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white text-sm font-semibold rounded-lg flex-shrink-0">
                    {t.voteButton} <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {isEligible && closed.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            {t.closedSectionTitle.replace("{count}", String(closed.length))}
          </h2>
          <div className="space-y-3">
            {closed.map((m) => (
              <Link
                key={m.id}
                href={`/portalas/susirinkimai/${m.id}`}
                className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-green-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 mb-1">{m.title}</h3>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDateLong(m.meeting_date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {m.location}
                      </span>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded font-medium flex-shrink-0">
                    {t.closedBadge}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {isEligible && voted.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            {t.votedSectionTitle.replace("{count}", String(voted.length))}
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
                    <CheckCircle2 className="h-3 w-3" /> {t.votedBadge}
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
