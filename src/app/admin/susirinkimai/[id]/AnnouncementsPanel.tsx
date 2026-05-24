"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  createMeetingAnnouncement,
  deleteMeetingAnnouncement,
  MeetingAnnouncement,
} from "@/actions/announcements";
import {
  Megaphone,
  Globe,
  Share2,
  Mail,
  MessageSquare,
  FileText,
  Plus,
  Trash2,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  meetingId: string;
  meetingDate: string;
  announcements: MeetingAnnouncement[];
}

const CHANNEL_OPTIONS: Array<{
  value: MeetingAnnouncement["channel"];
  label: string;
  icon: typeof Globe;
}> = [
  { value: "web", label: "Svetainė (kruminiai.lt)", icon: Globe },
  { value: "facebook", label: "Facebook", icon: Share2 },
  { value: "email", label: "El. paštas nariams", icon: Mail },
  { value: "sms", label: "SMS nariams", icon: MessageSquare },
  { value: "paper", label: "Skelbimų lenta / paštas", icon: FileText },
  { value: "other", label: "Kitas kanalas", icon: Megaphone },
];

const CHANNEL_BY_VALUE = Object.fromEntries(
  CHANNEL_OPTIONS.map((c) => [c.value, c])
);

/**
 * Skelbimų panelis – admin'as fiksuoja, kur ir kada susirinkimas buvo
 * paskelbtas. Skaičiuoja, ar bent vienas skelbimas paskelbtas min. 14 d.
 * prieš susirinkimą (LT tipinis reikalavimas).
 */
export function AnnouncementsPanel({
  meetingId,
  meetingDate,
  announcements,
}: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(announcements.length === 0);
  const [loading, setLoading] = useState(false);

  // Apskaičiuojam, ar bent vienas skelbimas yra >=14 d. prieš susirinkimą
  const meetingTime = new Date(meetingDate).getTime();
  const earliest = announcements
    .map((a) => new Date(a.published_at).getTime())
    .sort((a, b) => a - b)[0];
  const daysAdvance = earliest
    ? Math.floor((meetingTime - earliest) / (1000 * 60 * 60 * 24))
    : null;
  const compliant = daysAdvance !== null && daysAdvance >= 14;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    formData.set("meeting_id", meetingId);
    const result = await createMeetingAnnouncement(formData);
    setLoading(false);

    if (result.error) {
      const errMsg =
        typeof result.error === "string"
          ? result.error
          : "Patikrinkite duomenis";
      toast.error(errMsg);
      return;
    }
    toast.success("Skelbimas užregistruotas");
    setShowForm(false);
    (e.target as HTMLFormElement).reset();
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Ar tikrai ištrinti skelbimo įrašą?")) return;
    const result = await deleteMeetingAnnouncement(id);
    if (result.error) {
      toast.error(typeof result.error === "string" ? result.error : "Klaida");
      return;
    }
    toast.success("Ištrinta");
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-blue-700" />
            <h2 className="text-base font-semibold text-gray-900">
              Susirinkimo skelbimai
            </h2>
          </div>
          {!showForm && (
            <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" />
              Pridėti skelbimą
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Compliance status */}
        {announcements.length > 0 && (
          <div
            className={`mb-4 p-3 rounded-lg border flex items-start gap-2 ${
              compliant
                ? "bg-green-50 border-green-200"
                : "bg-amber-50 border-amber-200"
            }`}
          >
            {compliant ? (
              <CheckCircle2 className="h-5 w-5 text-green-700 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-amber-700 flex-shrink-0 mt-0.5" />
            )}
            <div className="text-sm">
              {compliant ? (
                <p className="text-green-900">
                  <strong>Atitinka reikalavimus</strong> – pirmasis skelbimas
                  paskelbtas <strong>{daysAdvance} d.</strong> prieš susirinkimą
                  (min. 14 d. reikalavimas).
                </p>
              ) : (
                <p className="text-amber-900">
                  <strong>Per vėlai paskelbta</strong> – pirmasis skelbimas tik{" "}
                  <strong>{daysAdvance} d.</strong> prieš susirinkimą.
                  Įstatuose reikalaujama min. 14 d. iš anksto.
                </p>
              )}
            </div>
          </div>
        )}

        {announcements.length === 0 && !showForm && (
          <p className="text-sm text-gray-500 py-2">
            Skelbimų dar neužregistruota. Pridėkite kuriame kanale ir kada
            paskelbta apie susirinkimą.
          </p>
        )}

        {/* Esamų skelbimų sąrašas */}
        {announcements.length > 0 && (
          <ul className="space-y-2 mb-4">
            {announcements.map((a) => {
              const channelInfo = CHANNEL_BY_VALUE[a.channel];
              const Icon = channelInfo?.icon || Megaphone;
              const publishedDate = new Date(a.published_at).toLocaleString(
                "lt-LT",
                {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "Europe/Vilnius",
                }
              );
              return (
                <li
                  key={a.id}
                  className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                >
                  <Icon className="h-4 w-4 text-gray-500 flex-shrink-0 mt-1" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">
                        {channelInfo?.label || a.channel}
                      </span>
                      <span className="text-xs text-gray-500">·</span>
                      <span className="text-xs text-gray-600">
                        {publishedDate}
                      </span>
                    </div>
                    {a.url && (
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 hover:underline mt-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {a.url.length > 60 ? a.url.slice(0, 60) + "..." : a.url}
                      </a>
                    )}
                    {a.notes && (
                      <p className="text-xs text-gray-500 mt-1 italic">{a.notes}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(a.id)}
                    className="text-gray-400 hover:text-red-600 transition-colors flex-shrink-0"
                    title="Ištrinti"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* Pridėjimo forma */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="space-y-3 p-4 bg-blue-50/40 border border-blue-100 rounded-lg"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wider">
                  Kanalas *
                </label>
                <select
                  name="channel"
                  required
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                >
                  {CHANNEL_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wider">
                  Paskelbimo data ir laikas *
                </label>
                <input
                  type="datetime-local"
                  name="published_at"
                  required
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wider">
                URL į originalą (neprivaloma)
              </label>
              <input
                type="url"
                name="url"
                placeholder="https://www.facebook.com/post/... arba https://kruminiai.lt/naujienos/..."
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wider">
                Pastabos (neprivaloma)
              </label>
              <input
                type="text"
                name="notes"
                placeholder="Pvz., screenshot išsaugotas DOK aplanke"
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button type="submit" size="sm" loading={loading}>
                Užregistruoti
              </Button>
              {announcements.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowForm(false)}
                >
                  Atšaukti
                </Button>
              )}
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
