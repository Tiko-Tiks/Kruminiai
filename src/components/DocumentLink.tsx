import { FileText, ExternalLink } from "lucide-react";
import { formatFileSize, getDocumentPublicUrl } from "@/lib/utils";

/**
 * Unifikuotas dokumento nuorodos komponentas.
 *
 * Naudojimas visose vietose, kur rodome dokumentus narystės puslapiuose:
 *   /skaidrumas, /dokumentai, /portalas/dokumentai, balsavimo srautai,
 *   admin susirinkimo panelės.
 *
 * Elgsena:
 *   • Atvėrimas NAUJAME LANGE (target="_blank") – PDF naršyklės peržiūrėtuvas
 *     parodys turinį inline, su mygtuku atsisiųsti viduje (browser native).
 *   • Visa eilutė yra clickable – ne tik mažas „Atsisiųsti" link'as.
 *   • External link ikona aiškiai parodo, kad atsidarys naujas langas.
 *   • Automatiškai apdoroja Supabase Storage URL, /api/* server-generated
 *     dokumentus, ir __public__/* statinius failus.
 *
 * Variantai:
 *   variant="row" (default) – pilna eilutė kortelėje (skaidrumas, dokumentai)
 *   variant="inline"        – kompaktiška inline forma (balsavimo srautai)
 *   variant="card"          – ryškesnis bloko stilius (susirinkimų panelis)
 */

export interface DocumentLinkProps {
  filePath: string;
  title: string;
  description?: string | null;
  fileSize?: number | null;
  meta?: string;
  variant?: "row" | "inline" | "card";
  className?: string;
}

export function DocumentLink({
  filePath,
  title,
  description,
  fileSize,
  meta,
  variant = "row",
  className = "",
}: DocumentLinkProps) {
  const url = getDocumentPublicUrl(filePath);

  if (variant === "inline") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-2 text-sm text-green-700 hover:text-green-800 hover:underline font-medium ${className}`}
      >
        <FileText className="h-4 w-4 flex-shrink-0" />
        <span className="flex-1">{title}</span>
        {fileSize ? (
          <span className="text-xs text-gray-500 font-normal">({formatFileSize(fileSize)})</span>
        ) : null}
        <ExternalLink className="h-3 w-3 text-gray-400 flex-shrink-0" />
      </a>
    );
  }

  if (variant === "card") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title="Atidaryti dokumento peržiūrą naujame lange"
        className={`flex items-center gap-2 bg-white border border-blue-100 hover:border-blue-300 hover:shadow-sm rounded-lg px-3 py-2 text-sm text-blue-700 hover:text-blue-900 font-medium transition-colors ${className}`}
      >
        <FileText className="h-4 w-4 flex-shrink-0" />
        <span className="flex-1">{title}</span>
        {fileSize ? (
          <span className="text-xs text-gray-500 font-normal">
            {formatFileSize(fileSize)}
          </span>
        ) : null}
        <ExternalLink className="h-3 w-3 text-gray-400 flex-shrink-0" />
      </a>
    );
  }

  // row – default, pilna eilutė kortelėje, visa clickable
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title="Atidaryti dokumento peržiūrą naujame lange"
      className={`flex items-center gap-3 px-5 py-4 hover:bg-green-50/40 transition-colors ${className}`}
    >
      <FileText className="h-5 w-5 text-gray-400 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-gray-900 truncate">{title}</p>
          {meta ? (
            <span className="text-xs text-gray-400 flex-shrink-0">{meta}</span>
          ) : null}
        </div>
        {description ? (
          <p className="text-xs text-gray-500 truncate mt-0.5">{description}</p>
        ) : null}
        {fileSize ? (
          <p className="text-xs text-gray-400 mt-0.5">{formatFileSize(fileSize)}</p>
        ) : null}
      </div>
      <ExternalLink className="h-4 w-4 text-gray-400 flex-shrink-0" />
    </a>
  );
}
