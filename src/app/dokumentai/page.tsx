import { SiteHeader } from "@/components/layout/SiteHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { getDocuments } from "@/actions/documents";
import { DOCUMENT_CATEGORY_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { FileText } from "lucide-react";

export const metadata = {
  title: "Dokumentai",
  description:
    "Krūminių kaimo bendruomenės dokumentų archyvas – įstatai, protokolai, ataskaitos ir kiti svarbūs dokumentai.",
  alternates: { canonical: "/dokumentai" },
  openGraph: {
    title: "Dokumentai",
    description:
      "Bendruomenės dokumentų archyvas – įstatai, protokolai, ataskaitos.",
    url: "/dokumentai",
  },
};

export default async function DocumentsPage() {
  const documents = await getDocuments(undefined, true);

  const grouped = documents.reduce((acc: Record<string, typeof documents>, doc) => {
    const cat = doc.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(doc);
    return acc;
  }, {});

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <main className="flex-1 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Dokumentai</h1>
          <p className="text-gray-500 mb-8">Bendruomenės dokumentų archyvas</p>

          {documents.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <p className="text-gray-400">Kol kas dokumentų nėra</p>
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(grouped).map(([category, docs]) => (
                <div key={category}>
                  <h2 className="text-lg font-semibold text-gray-900 mb-3">
                    {DOCUMENT_CATEGORY_LABELS[category] || category}
                  </h2>
                  <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                    {docs.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between px-5 py-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText className="h-5 w-5 text-gray-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">{doc.title}</p>
                            {doc.description && (
                              <p className="text-xs text-gray-500 truncate">{doc.description}</p>
                            )}
                            <p className="text-xs text-gray-400">{formatDate(doc.created_at)}</p>
                          </div>
                        </div>
                        <a
                          href={doc.file_path.startsWith('__api__/') ? `/api/dokumentai/${doc.file_path.replace('__api__/', '')}` : doc.file_path.startsWith('__public__/') ? `/${doc.file_path.replace('__public__/', '')}` : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/documents/${doc.file_path}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-700 hover:text-green-800 font-medium text-xs flex-shrink-0"
                        >
                          Atsisiųsti
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
