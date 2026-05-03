import { getDocuments } from "@/actions/documents";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DOCUMENT_CATEGORY_LABELS } from "@/lib/constants";
import { formatDate, formatFileSize } from "@/lib/utils";
import { Plus, FileText } from "lucide-react";
import Link from "next/link";
import { DeleteDocumentButton } from "./DeleteDocumentButton";
import { VisibilityToggle } from "./VisibilityToggle";
import { DocumentFilters } from "./DocumentFilters";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: {
    q?: string;
    category?: string;
    visibility?: "all" | "visible" | "hidden";
    sort?: "newest" | "oldest" | "name";
  };
}

export default async function AdminDocumentsPage({ searchParams }: PageProps) {
  const [allDocuments, filtered] = await Promise.all([
    getDocuments(),
    getDocuments({
      category: searchParams.category,
      visibility: searchParams.visibility,
      search: searchParams.q,
      sort: searchParams.sort,
    }),
  ]);

  // Grupuoti pagal metus (lengvesnis naršymas kai daug dokumentų)
  const grouped = filtered.reduce((acc: Record<string, typeof filtered>, doc) => {
    const year = new Date(doc.created_at).getFullYear().toString();
    if (!acc[year]) acc[year] = [];
    acc[year].push(doc);
    return acc;
  }, {});
  const years = Object.keys(grouped).sort((a, b) => Number(b) - Number(a));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dokumentai</h1>
          <p className="text-sm text-gray-500 mt-1">{allDocuments.length} dokumentų</p>
        </div>
        <Link href="/admin/dokumentai/naujas">
          <Button>
            <Plus className="h-4 w-4" /> Įkelti dokumentą
          </Button>
        </Link>
      </div>

      <DocumentFilters totalCount={allDocuments.length} filteredCount={filtered.length} />

      {filtered.length === 0 ? (
        <Card>
          <div className="px-6 py-16 text-center text-gray-400">
            <FileText className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p className="font-medium text-gray-500">Dokumentų nerasta</p>
            <p className="text-xs mt-1">Pabandykite pakeisti paieškos kriterijus</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {years.map((year) => (
            <div key={year}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <h2 className="text-sm font-semibold text-gray-700">{year} m.</h2>
                <span className="text-xs text-gray-400">({grouped[year].length})</span>
              </div>
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-left text-gray-500">
                        <th className="px-6 py-3 font-medium">Pavadinimas</th>
                        <th className="px-6 py-3 font-medium">Kategorija</th>
                        <th className="px-6 py-3 font-medium">Data</th>
                        <th className="px-6 py-3 font-medium">Matomumas</th>
                        <th className="px-6 py-3 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {grouped[year].map((doc) => (
                        <tr key={doc.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="font-medium text-gray-900">{doc.title}</p>
                                <p className="text-xs text-gray-400">
                                  {doc.file_name}
                                  {doc.file_size && ` · ${formatFileSize(doc.file_size)}`}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-3">
                            <Badge>{DOCUMENT_CATEGORY_LABELS[doc.category] || doc.category}</Badge>
                          </td>
                          <td className="px-6 py-3 text-gray-600 whitespace-nowrap">
                            {formatDate(doc.created_at)}
                          </td>
                          <td className="px-6 py-3">
                            <VisibilityToggle id={doc.id} isPublic={doc.is_public} />
                          </td>
                          <td className="px-6 py-3 text-right">
                            <DeleteDocumentButton id={doc.id} name={doc.title} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
