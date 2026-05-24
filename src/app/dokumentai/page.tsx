import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { getDocuments } from "@/actions/documents";
import { DOCUMENT_CATEGORY_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { DocumentLink } from "@/components/DocumentLink";

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
      <PublicHeader />

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
                  <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                    {docs.map((doc) => (
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
          )}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
