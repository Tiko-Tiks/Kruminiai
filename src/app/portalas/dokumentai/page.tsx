import { getDocuments } from "@/actions/documents";
import { DOCUMENT_CATEGORY_LABELS } from "@/lib/constants";
import { formatDate, formatFileSize, getDocumentPublicUrl } from "@/lib/utils";
import { FileText, Download } from "lucide-react";
import { PortalDocFilters } from "./PortalDocFilters";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: {
    q?: string;
    category?: string;
  };
}

export default async function PortalDocumentsPage({ searchParams }: PageProps) {
  const [allDocuments, filtered] = await Promise.all([
    getDocuments({ visibility: "visible" }),
    getDocuments({
      visibility: "visible",
      category: searchParams.category,
      search: searchParams.q,
    }),
  ]);

  // Grupuoti pagal metus
  const grouped = filtered.reduce((acc: Record<string, typeof filtered>, doc) => {
    const year = new Date(doc.created_at).getFullYear().toString();
    if (!acc[year]) acc[year] = [];
    acc[year].push(doc);
    return acc;
  }, {});
  const years = Object.keys(grouped).sort((a, b) => Number(b) - Number(a));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dokumentai</h1>
        <p className="text-sm text-gray-500 mt-1">Bendruomenės dokumentų archyvas</p>
      </div>

      <PortalDocFilters totalCount={allDocuments.length} filteredCount={filtered.length} />

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Dokumentų nerasta</p>
          <p className="text-xs text-gray-400 mt-1">Pabandykite pakeisti paieškos kriterijus</p>
        </div>
      ) : (
        <div className="space-y-6">
          {years.map((year) => (
            <div key={year}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <h2 className="text-sm font-semibold text-gray-700">{year} m.</h2>
                <span className="text-xs text-gray-400">({grouped[year].length})</span>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                {grouped[year].map((doc) => {
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
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900 truncate">{doc.title}</p>
                            <span className="text-xs text-gray-400 flex-shrink-0">
                              {DOCUMENT_CATEGORY_LABELS[doc.category] || doc.category}
                            </span>
                          </div>
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
