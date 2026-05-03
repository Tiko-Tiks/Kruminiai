import { getDocuments } from "@/actions/documents";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DOCUMENT_CATEGORY_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { Plus, FileText } from "lucide-react";
import Link from "next/link";
import { DeleteDocumentButton } from "./DeleteDocumentButton";
import { VisibilityToggle } from "./VisibilityToggle";

export default async function AdminDocumentsPage() {
  const documents = await getDocuments();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dokumentai</h1>
          <p className="text-sm text-gray-500 mt-1">{documents.length} dokumentų</p>
        </div>
        <Link href="/admin/dokumentai/naujas">
          <Button>
            <Plus className="h-4 w-4" /> Įkelti dokumentą
          </Button>
        </Link>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500">
                <th className="px-6 py-3 font-medium">Pavadinimas</th>
                <th className="px-6 py-3 font-medium">Kategorija</th>
                <th className="px-6 py-3 font-medium">Data</th>
                <th className="px-6 py-3 font-medium">Matomas nariams</th>
                <th className="px-6 py-3 font-medium">Veiksmai</th>
              </tr>
            </thead>
            <tbody>
              {documents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    Dar nėra dokumentų
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr key={doc.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-gray-900">{doc.title}</p>
                          <p className="text-xs text-gray-400">{doc.file_name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <Badge>{DOCUMENT_CATEGORY_LABELS[doc.category] || doc.category}</Badge>
                    </td>
                    <td className="px-6 py-3 text-gray-600">{formatDate(doc.created_at)}</td>
                    <td className="px-6 py-3">
                      <VisibilityToggle id={doc.id} isPublic={doc.is_public} />
                    </td>
                    <td className="px-6 py-3">
                      <DeleteDocumentButton id={doc.id} name={doc.title} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
