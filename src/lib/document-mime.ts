/**
 * Dokumentų failų tipų sąrašas – VIENAS ŠALTINIS įkėlimui ir atidavimui.
 *
 * KODĖL: `documents` failai atiduodami per `/api/dokumentai/...`, t. y. iš
 * PROGRAMOS kilmės. Jei iš tos kilmės su `Content-Type: text/html` ir
 * `Content-Disposition: inline` būtų atiduotas įkeltas HTML (ar SVG – jis irgi
 * gali turėti skriptą), naršyklė jį vykdytų kaip mūsų puslapio dalį: su prieiga
 * prie sesijos slapukų ir `localStorage`. CSP report-only režime to nestabdo.
 *
 * Todėl sprendžia PLĖTINYS, o ne įkėlėjo paskelbtas MIME tipas:
 *   • `INLINE_TYPES`   – saugu rodyti naršyklėje (`inline`);
 *   • `DOWNLOAD_TYPES` – leidžiam įkelti, bet atiduodam tik parsisiuntimui
 *     (`attachment`) – naršyklė jų vis tiek nerodo;
 *   • visa kita        – `application/octet-stream` + `attachment`.
 *
 * Kartu su globalia `X-Content-Type-Options: nosniff` antrašte tai reiškia, kad
 * net HTML turinys `.pdf` faile bus traktuojamas kaip PDF, o ne kaip puslapis.
 *
 * Modulis sąmoningai be priklausomybių – jį naudoja ir serverio route'as, ir
 * server action'ai, ir `node --test` testai.
 */

/** Ką ir kaip atiduodam naršyklei. */
export interface DocumentDelivery {
  /** `Content-Type` antraštės reikšmė. */
  contentType: string;
  /** `inline` – rodom naršyklėje; `attachment` – tik parsisiuntimas. */
  disposition: "inline" | "attachment";
}

/** Plėtiniai, kurių turinį saugu rodyti naršyklėje. */
const INLINE_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".txt": "text/plain; charset=utf-8",
};

/** Plėtiniai, kuriuos leidžiam įkelti, bet atiduodam tik parsisiuntimui. */
const DOWNLOAD_TYPES: Record<string, string> = {
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".odt": "application/vnd.oasis.opendocument.text",
  ".ods": "application/vnd.oasis.opendocument.spreadsheet",
  ".odp": "application/vnd.oasis.opendocument.presentation",
  ".csv": "text/csv; charset=utf-8",
};

const FALLBACK_TYPE = "application/octet-stream";

/** Plėtiniai, kuriuos leidžiama įkelti – admin formos klaidos tekstui. */
export const ALLOWED_DOCUMENT_EXTENSIONS: readonly string[] = Object.keys({
  ...INLINE_TYPES,
  ...DOWNLOAD_TYPES,
}).sort();

/**
 * MIME tipas be parametrų ir mažosiomis raidėmis.
 * `"Application/PDF; charset=utf-8"` → `"application/pdf"`.
 */
export function normalizeMimeType(value: string | null | undefined): string {
  if (!value) return "";
  return value.split(";")[0].trim().toLowerCase();
}

function extensionOf(fileName: string): string {
  const base = (fileName || "").split("/").pop() || "";
  const dot = base.lastIndexOf(".");
  // Taškas pačioje pradžioje (`.gitignore`) nėra plėtinys.
  if (dot <= 0) return "";
  return base.slice(dot).toLowerCase();
}

/** Ar šį MIME tipą saugu atiduoti `inline` iš programos kilmės? */
export function isInlineSafeMimeType(value: string | null | undefined): boolean {
  const normalized = normalizeMimeType(value);
  if (!normalized) return false;
  return Object.values(INLINE_TYPES).some((t) => normalizeMimeType(t) === normalized);
}

/** Ar šį MIME tipą apskritai priimam į dokumentų saugyklą? */
export function isAllowedDocumentMimeType(value: string | null | undefined): boolean {
  const normalized = normalizeMimeType(value);
  if (!normalized) return false;
  return (
    isInlineSafeMimeType(normalized) ||
    Object.values(DOWNLOAD_TYPES).some((t) => normalizeMimeType(t) === normalized)
  );
}

/**
 * MIME tipas, kurį įrašom įkeldami failą, arba `null`, jei plėtinys neleistinas.
 *
 * Naršyklės paskelbtu `File.type` nesiremiam – jį lengva suklastoti, o mes
 * failą vėliau atiduosim pagal plėtinį.
 */
export function documentUploadType(fileName: string): string | null {
  const ext = extensionOf(fileName);
  return INLINE_TYPES[ext] || DOWNLOAD_TYPES[ext] || null;
}

/**
 * Kaip atiduoti jau saugomą failą.
 *
 * `upstreamType` (Storage saugomas MIME) naudojamas TIK kaip atsarginis
 * variantas, kai plėtinio neatpažįstam – ir net tada neleistinas tipas virsta
 * `application/octet-stream` + `attachment`.
 */
export function resolveDocumentDelivery(
  fileName: string,
  upstreamType?: string | null
): DocumentDelivery {
  const byExtension = documentUploadType(fileName);
  const contentType = byExtension || normalizeMimeType(upstreamType);

  if (isInlineSafeMimeType(contentType)) {
    return { contentType, disposition: "inline" };
  }
  if (isAllowedDocumentMimeType(contentType)) {
    return { contentType, disposition: "attachment" };
  }
  return { contentType: FALLBACK_TYPE, disposition: "attachment" };
}
