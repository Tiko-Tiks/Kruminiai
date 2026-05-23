import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { FileText, ExternalLink } from "lucide-react";
import { formatFileSize, getDocumentPublicUrl } from "@/lib/utils";
import { Document } from "@/lib/types";

interface ResolutionWithDocs {
  id: string;
  resolution_number: number;
  title: string;
  is_procedural: boolean;
  resolution_documents?: { id: string; sort_order: number; document: Document | null }[];
}

interface Props {
  resolutions: ResolutionWithDocs[];
}

/**
 * Susirinkimo metu admin'ui (pirmininkui / sekretoriui) reikia greitai
 * pasiekti visus susirinkimo dokumentus (finansinės ataskaitos, veiklos
 * planas, kandidatų sąrašas ir t.t.) be būtinybės plėsti kiekvieną
 * nutarimą atskirai. Šis panelis rodo VISUS dokumentus grupuotus pagal
 * nutarimą, kiekvienas atidaromas naujame lange vienu paspaudimu.
 */
export function MeetingDocumentsPanel({ resolutions }: Props) {
  const resolutionsWithDocs = resolutions.filter(
    (r) => (r.resolution_documents || []).some((d) => d.document)
  );

  if (resolutionsWithDocs.length === 0) return null;

  const totalDocs = resolutionsWithDocs.reduce(
    (s, r) => s + (r.resolution_documents || []).filter((d) => d.document).length,
    0
  );

  return (
    <Card className="mb-6 border-blue-200 bg-blue-50/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Susirinkimo dokumentai ({totalDocs})
          </h2>
          <span className="text-xs text-gray-500">Spustelėk → atidarys naujame lange</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {resolutionsWithDocs.map((res) => {
            const docs = (res.resolution_documents || []).filter((d) => d.document);
            return (
              <div key={res.id} className="border-l-2 border-blue-300 pl-4">
                <p className="text-sm font-semibold text-gray-800 mb-2">
                  {res.resolution_number}. {res.title}
                </p>
                <ul className="space-y-1.5">
                  {docs.map((d) => (
                    <li key={d.id}>
                      <a
                        href={getDocumentPublicUrl(d.document!.file_path)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-blue-700 hover:text-blue-900 hover:underline font-medium bg-white border border-blue-100 hover:border-blue-300 rounded-lg px-3 py-2 transition-colors"
                      >
                        <FileText className="h-4 w-4 flex-shrink-0" />
                        <span>{d.document!.title}</span>
                        {d.document!.file_size && (
                          <span className="text-xs text-gray-500 font-normal">
                            ({formatFileSize(d.document!.file_size)})
                          </span>
                        )}
                        <ExternalLink className="h-3 w-3 text-gray-400" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
