import { getDocuments } from "@/actions/documents";
import { formatDate } from "@/lib/utils";
import { getDict } from "@/lib/i18n-server";
import { FileText } from "lucide-react";
import { DocumentLink } from "@/components/DocumentLink";
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
  const t = getDict().portalDocuments;
  const cat = getDict().docCategories as Record<string, string>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t.pageTitle}</h1>
        <p className="text-sm text-gray-500 mt-1">{t.pageSubtitle}</p>
      </div>

      <PortalDocFilters totalCount={allDocuments.length} filteredCount={filtered.length} />

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">{t.emptyTitle}</p>
          <p className="text-xs text-gray-400 mt-1">{t.emptyHint}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {years.map((year) => (
            <div key={year}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <h2 className="text-sm font-semibold text-gray-700">{year}{t.yearSuffix}</h2>
                <span className="text-xs text-gray-400">({grouped[year].length})</span>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                {grouped[year].map((doc) => (
                  <DocumentLink
                    key={doc.id}
                    filePath={doc.file_path}
                    title={doc.title}
                    description={doc.description}
                    fileSize={doc.file_size}
                    meta={`${cat[doc.category] || doc.category} · ${formatDate(doc.created_at)}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
