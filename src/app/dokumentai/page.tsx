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

  // Trys užklausos lygiagrečiai:
  // 1) visi public dokumentai
  // 2) susirinkimai (kandidatai į papkes)
  // 3) resolution_documents junction'ai – kad žinotume, kuris dokumentas
  //    yra prikabintas prie kurio nutarimo (ir per nutarimą – prie susirinkimo)
  const [{ data: documents }, { data: meetings }, { data: resDocLinks }] =
    await Promise.all([
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
      supabase
        .from("resolution_documents")
        .select("document_id, resolution:resolutions(meeting_id)"),
    ]);

  const docs = (documents || []) as DocRow[];
  const meetingsList = (meetings || []) as MeetingRow[];

  // Sudaroma mapping'a: document_id → set of meeting_id's (jei dokumentas
  // yra prikabintas prie nutarimo, jis automatiškai priklauso ir susirinkimui)
  const meetingsFromResolutions = new Map<string, Set<string>>();
  for (const link of resDocLinks || []) {
    const docId = link.document_id as string;
    const res = link.resolution as { meeting_id: string } | { meeting_id: string }[] | null;
    const meetingId = Array.isArray(res) ? res[0]?.meeting_id : res?.meeting_id;
    if (!docId || !meetingId) continue;
    const set = meetingsFromResolutions.get(docId) || new Set<string>();
    set.add(meetingId);
    meetingsFromResolutions.set(docId, set);
  }

  // Suskirstom į dvi grupes su AUTO-AGREGAVIMU:
  //   1) Bendri dokumentai – be meeting_id IR be resolution_document link'o
  //      (įstatai, sutartys, kt. – tikrai bendri)
  //   2) Pagal susirinkimą – DocRow gali patekti į kelis susirinkimus, jei
  //      prikabintas prie kelių nutarimų skirtinguose susirinkimuose
  const docsByMeeting = new Map<string, DocRow[]>();
  const generalDocs: DocRow[] = [];

  docs.forEach((d) => {
    const meetingIds = new Set<string>();
    if (d.meeting_id) meetingIds.add(d.meeting_id);
    const fromRes = meetingsFromResolutions.get(d.id);
    if (fromRes) fromRes.forEach((m) => meetingIds.add(m));

    if (meetingIds.size === 0) {
      generalDocs.push(d);
    } else {
      meetingIds.forEach((mId) => {
        const arr = docsByMeeting.get(mId) || [];
        arr.push(d);
        docsByMeeting.set(mId, arr);
      });
    }
  });

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

              {/* Susirinkimų kortelės – tik nuorodos į /susirinkimai/[id],
                  kur narys ras visus susijusius dokumentus, skelbimus,
                  nutarimus ir balsavimo rezultatus vienoje vietoje.
                  Vengiame dubliavimo – meeting dokumentai gyvena tik viename
                  šaltinyje. */}
              {meetingsWithDocs.length > 0 && (
                <section>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">Susirinkimai</h2>
                  <p className="text-sm text-gray-500 mb-4">
                    Kiekvienas susirinkimo puslapis turi visus susijusius dokumentus
                    (ataskaitas, protokolą, dalyvių sąrašą), skelbimus ir balsavimo
                    rezultatus.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {meetingsWithDocs.map((m) => {
                      const meetingDocs = docsByMeeting.get(m.id) || [];
                      return (
                        <a
                          key={m.id}
                          href={`/susirinkimai/${m.id}`}
                          className="group bg-white rounded-xl border border-gray-200 hover:border-green-300 hover:shadow-sm p-5 transition-all flex items-start gap-3"
                        >
                          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center group-hover:bg-green-200 transition-colors">
                            <FolderOpen className="h-5 w-5 text-green-700" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-gray-900 group-hover:text-green-700 transition-colors">
                              {m.title}
                            </h3>
                            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDateLong(m.meeting_date)}
                            </p>
                            <p className="text-xs text-green-700 mt-2 font-medium">
                              {meetingDocs.length}{" "}
                              {meetingDocs.length === 1 ? "dokumentas" : "dokumentai"} →
                            </p>
                          </div>
                        </a>
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
