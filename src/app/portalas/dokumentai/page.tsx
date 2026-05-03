import { getDocuments } from "@/actions/documents";
import { DOCUMENT_CATEGORY_LABELS } from "@/lib/constants";
import { formatDate, formatFileSize, getDocumentPublicUrl } from "@/lib/utils";
import { FileText, Download } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PortalDocumentsPage() {
  const documents = await getDocuments();

  const grouped = documents.reduce((acc: Record<string, typeof documents>, doc) => {
    const cat = doc.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(doc);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dokumentai</h1>
        <p className="text-sm text-gray-500 mt-1">Bendruomenės dokumentų archyvas</p>
      </div>

      {documents.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400">Kol kas dokumentų nėra</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, docs]) => (
            <div key={category}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                {DOCUMENT_CATEGORY_LABELS[category] || category}
              </h2>
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                {docs.map((doc) => {
                  const url = doc.file_path.startsWith("__api__/")
                    ? `/api/dokumentai/${doc.file_path.replace("__api__/", "")}`
                    : doc.file_path.startsWith("__public__/")
                      ? `/${doc.file_path.replace("__public__/", "")}`
                      : getDocumentPublicUrl(doc.file_path);
                  return (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between gap-3 px-5 py-4"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <FileText className="h-5 w-5 text-gray-400 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-900 truncate">{doc.title}</p>
                          {doc.description && (
                            <p className="text-xs text-gray-500 truncate">{doc.description}</p>
                          )}
                          <p className="text-xs text-gray-400">
                            {formatDate(doc.created_at)}
                            {doc.file_size && ` · ${formatFileSize(doc.file_size)}`}
                          </p>
                        </div>
                      </div>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-green-700 hover:text-green-800 font-medium flex-shrink-0 px-3 py-1.5 hover:bg-green-50 rounded-lg"
                      >
                        <Download className="h-4 w-4" />
                        <span className="hidden sm:inline">Atidaryti</span>
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
