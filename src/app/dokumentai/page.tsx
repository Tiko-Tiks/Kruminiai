import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { DOCUMENT_CATEGORY_LABELS } from "@/lib/constants";
import { formatDate, formatDateLong } from "@/lib/utils";
import { DocumentLink } from "@/components/DocumentLink";
import { Calendar, FolderOpen } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dokumentai",
  description:
    "Krūminių kaimo bendruomenės dokumentų archyvas – įstatai, sutartys, susirinkimų papkės su ataskaitomis, protokolais ir dalyvių sąrašais.",
  alternates: { canonical: "/dokumentai" },
  openGraph: {
    title: "Dokumentai",
    description:
      "Bendruomenės dokumentų archyvas, struktūrizuotas pagal susirinkimus ir bendrus dokumentus.",
    url: "/dokumentai",
  },
};

interface DocRow {
  id: string;
  title: string;
  description: string | null;
  file_path: string;
  file_name: string;
  file_size: number | null;
  category: string;
  meeting_id: string | null;
  created_at: string;
}

interface MeetingRow {
  id: string;
  title: string;
  meeting_date: string;
  status: string;
}

export default async function DocumentsPage() {
  const supabase = createServerSupabaseClient();

  const [{ data: documents }, { data: meetings }] = await Promise.all([
    supabase
      .from("documents")
      .select(
        "id, title, description, file_path, file_name, file_size, category, meeting_id, created_at"
      )
      .eq("is_public", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("meetings")
      .select("id, title, meeting_date, status")
      .in("status", ["baigtas", "vyksta", "registracija", "planuojamas"])
      .order("meeting_date", { ascending: false }),
  ]);

  const docs = (documents || []) as DocRow[];
  const meetingsList = (meetings || []) as MeetingRow[];

  // Suskirstom į dvi grupes:
  //   1) Bendri dokumentai – be meeting_id (įstatai, sutartys, kt.)
  //   2) Pagal susirinkimą – su meeting_id
  const generalDocs = docs.filter((d) => !d.meeting_id);
  const docsByMeeting = new Map<string, DocRow[]>();
  for (const d of docs) {
    if (!d.meeting_id) continue;
    const arr = docsByMeeting.get(d.meeting_id) || [];
    arr.push(d);
    docsByMeeting.set(d.meeting_id, arr);
  }

  // Bendrų dokumentų grupavimas pagal kategoriją
  const generalGrouped = generalDocs.reduce((acc: Record<string, DocRow[]>, doc) => {
    if (!acc[doc.category]) acc[doc.category] = [];
    acc[doc.category].push(doc);
    return acc;
  }, {});

  // Tik tie susirinkimai, kurie turi bent vieną dokumentą
  const meetingsWithDocs = meetingsList.filter((m) => docsByMeeting.has(m.id));

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      <main className="flex-1 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Dokumentai</h1>
          <p className="text-gray-500 mb-8">
            Bendruomenės dokumentų archyvas. Susirinkimų papkėse rasite metinę
            ataskaitą, finansinį rinkinį, protokolą, dalyvių sąrašą ir kitus
            susijusius dokumentus.
          </p>

          {docs.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <p className="text-gray-400">Kol kas dokumentų nėra</p>
            </div>
          ) : (
            <div className="space-y-10">
              {/* Bendri dokumentai – ne susirinkimų: įstatai, sutartys, kt. */}
              {Object.keys(generalGrouped).length > 0 && (
                <section>
                  <h2 className="text-xl font-bold text-gray-900 mb-4">
                    Pagrindiniai dokumentai
                  </h2>
                  <div className="space-y-6">
                    {Object.entries(generalGrouped).map(([category, list]) => (
                      <div key={category}>
                        <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wider">
                          {DOCUMENT_CATEGORY_LABELS[category] || category}
                        </h3>
                        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                          {list.map((doc) => (
                            <DocumentLink
                              key={doc.id}
                              filePath={doc.file_path}
                              title={doc.title}
                              description={doc.description}
                              fileSize={doc.file_size}
                              meta={formatDate(doc.created_at)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Susirinkimų papkės – kiekvienas susirinkimas turi savo
                  „aplankalą" su visais susijusiais dokumentais. */}
              {meetingsWithDocs.length > 0 && (
                <section>
                  <h2 className="text-xl font-bold text-gray-900 mb-4">
                    Susirinkimai
                  </h2>
                  <div className="space-y-4">
                    {meetingsWithDocs.map((m) => {
                      const meetingDocs = docsByMeeting.get(m.id) || [];
                      return (
                        <div
                          key={m.id}
                          className="bg-white rounded-xl border border-gray-200 overflow-hidden"
                        >
                          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60">
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                                <FolderOpen className="h-5 w-5 text-green-700" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <h3 className="font-semibold text-gray-900">{m.title}</h3>
                                <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {formatDateLong(m.meeting_date)}
                                  <span className="text-gray-400 mx-1">·</span>
                                  {meetingDocs.length}{" "}
                                  {meetingDocs.length === 1 ? "dokumentas" : "dokumentai"}
                                </p>
                              </div>
                              <a
                                href={`/susirinkimai/${m.id}`}
                                className="text-xs text-green-700 hover:text-green-800 font-medium hover:underline flex-shrink-0"
                              >
                                Susirinkimo info →
                              </a>
                            </div>
                          </div>
                          <div className="divide-y divide-gray-100">
                            {meetingDocs.map((doc) => (
                              <DocumentLink
                                key={doc.id}
                                filePath={doc.file_path}
                                title={doc.title}
                                description={doc.description}
                                fileSize={doc.file_size}
                                meta={DOCUMENT_CATEGORY_LABELS[doc.category] || doc.category}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
