import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAdminSupabaseClient, isAdminClientAvailable } from "@/lib/supabase-admin";
import { NextResponse, type NextRequest } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { getLocale } from "@/lib/i18n-server";
import { escapeAttr, escapeHtml } from "@/lib/html";
import { resolveDocumentDelivery, type DocumentDelivery } from "@/lib/document-mime";
import { findDocumentForVotingToken } from "@/lib/document-access";
import type { Locale } from "@/lib/i18n";

/**
 * Dokumentų atidavimo route'as – VIENA vieta, kur sprendžiama dokumento prieiga.
 *
 * Aptarnauja du saugyklos tipus, abu adresuojamus per `documents.file_path`
 * (`getDocumentPublicUrl()` `src/lib/utils.ts` paverčia jį nuoroda):
 *
 *   `__api__/dokumentai/<failas>`  → `/api/dokumentai/<failas>`
 *        statinis failas repo `private/documents/` aplanke (įstatai) –
 *        versijuojamas kartu su kodu;
 *   bet koks kitas kelias         → `/api/dokumentai/failai/<kelias>`
 *        objektas Supabase Storage `documents` bucket'e.
 *
 * KODĖL Storage failai eina per route'ą, o ne tiesioginiu bucket'o URL:
 * viešame bucket'e failas atiduodamas be jokios autentifikacijos, todėl
 * `documents.is_public = false` nieko nereiškė – nuorodą žinantis žmogus
 * failą parsisiųsdavo. Bucket'as padarytas privatus (migracija 050), o
 * matomumą sprendžia šis route'as; pats objektas paimamas service-role
 * klientu su trumpalaike pasirašyta nuoroda, kuri į naršyklę nepatenka.
 *
 * PRIEIGA seka `documents.is_public`, o ne vien sesiją:
 *   • `is_public = true`  → mato visi, įskaitant neprisijungusius (įstatai yra
 *     vieši pagal LR Asociacijų įstatymą – jų negalima slėpti už prisijungimo);
 *   • kitu atveju        → tik prisijungęs IR patvirtintas narys arba adminas,
 *     ARBA anon balsuotojas su galiojančiu `?token=` TO PATIES susirinkimo
 *     dokumentui (`src/lib/document-access.ts`) – be šito prie darbotvarkės
 *     prikabintas neviešas failas SMS nuorodos gavėjui liktų neatidaromas.
 *     (/api/* yra už middleware matcher ribų, todėl tikrinam patys.)
 *
 * KLAIDOS grąžinamos kaip suprantamas HTML puslapis (dokumentai atidaromi
 * naujame lange – žalias JSON `{"error": "..."}` naudotojui nieko nesako).
 */

export const dynamic = "force-dynamic";

const DOCS_ROOT = path.join(process.cwd(), "private", "documents");

const STORAGE_BUCKET = "documents";

/** Rezervuotas pirmas segmentas, skiriantis Storage kelius nuo repo failų. */
const STORAGE_PREFIX = "failai";

/** Kiek galioja vidinė pasirašyta nuoroda (sekundėmis). Į naršyklę nepatenka. */
const SIGNED_URL_TTL_SECONDS = 60;

// Repo failams leidžiam tik paprastus failų vardus/aplankus – jokių „..",
// slash'ų ar ne-ASCII simbolių.
const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

interface ErrorCopy {
  heading: string;
  body: string;
  hint: string;
}

type ErrorKind = "missing" | "denied" | "unauthorized" | "unavailable";

const ERROR_COPY: Record<Locale, Record<ErrorKind, ErrorCopy>> = {
  lt: {
    missing: {
      heading: "Dokumento failas nerastas",
      body: "Dokumentas registruotas sistemoje, bet jo failo nepavyko rasti serveryje.",
      hint: "Praneškite administratoriui – failą reikia įkelti iš naujo.",
    },
    denied: {
      heading: "Dokumentas prieinamas tik nariams",
      body: "Šis dokumentas nėra viešas – jį gali atidaryti tik patvirtinti bendruomenės nariai.",
      hint: "Prisijunkite su savo nario paskyra ir bandykite dar kartą.",
    },
    unauthorized: {
      heading: "Reikia prisijungti",
      body: "Šis dokumentas nėra viešas – norint jį atidaryti, reikia prisijungti.",
      hint: "Prisijunkite su savo nario paskyra ir bandykite dar kartą.",
    },
    unavailable: {
      heading: "Dokumentų saugykla nepasiekiama",
      body: "Failo nepavyko paimti iš saugyklos.",
      hint: "Pabandykite vėliau arba praneškite administratoriui.",
    },
  },
  en: {
    missing: {
      heading: "Document file not found",
      body: "The document is registered in the system, but its file could not be found on the server.",
      hint: "Please let the administrator know – the file needs to be uploaded again.",
    },
    denied: {
      heading: "Members only",
      body: "This document is not public – only approved community members can open it.",
      hint: "Sign in with your member account and try again.",
    },
    unauthorized: {
      heading: "Sign-in required",
      body: "This document is not public – please sign in to open it.",
      hint: "Sign in with your member account and try again.",
    },
    unavailable: {
      heading: "Document storage unavailable",
      body: "The file could not be fetched from storage.",
      hint: "Please try again later or let the administrator know.",
    },
  },
};

function errorPage(
  kind: ErrorKind,
  status: number,
  locale: Locale,
  detail?: string
): NextResponse {
  const copy = ERROR_COPY[locale][kind];
  const backLabel = locale === "en" ? "Back to documents" : "Grįžti į dokumentus";
  const loginLabel = locale === "en" ? "Sign in" : "Prisijungti";
  const showLogin = kind === "denied" || kind === "unauthorized";

  const html = `<!DOCTYPE html>
<html lang="${escapeAttr(locale)}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex">
  <title>${escapeHtml(copy.heading)}</title>
  <style>
    *{ box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: #f9fafb; color: #111827; padding: 24px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .box { max-width: 520px; width: 100%; background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 32px; }
    h1 { margin: 0 0 12px; font-size: 20px; line-height: 1.3; }
    p { margin: 0 0 8px; font-size: 14px; line-height: 1.6; color: #4b5563; }
    .hint { color: #6b7280; font-size: 13px; }
    .detail { margin-top: 12px; font-size: 12px; color: #9ca3af; word-break: break-all; }
    .actions { margin-top: 24px; display: flex; gap: 10px; flex-wrap: wrap; }
    a.btn { display: inline-block; padding: 10px 16px; border-radius: 10px; font-size: 14px; font-weight: 600; text-decoration: none; }
    a.primary { background: #15803d; color: #fff; }
    a.secondary { background: #f3f4f6; color: #374151; }
  </style>
</head>
<body>
  <div class="box">
    <h1>${escapeHtml(copy.heading)}</h1>
    <p>${escapeHtml(copy.body)}</p>
    <p class="hint">${escapeHtml(copy.hint)}</p>
    ${detail ? `<p class="detail">${escapeHtml(detail)}</p>` : ""}
    <div class="actions">
      <a class="btn primary" href="/dokumentai">${escapeHtml(backLabel)}</a>
      ${showLogin ? `<a class="btn secondary" href="/prisijungimas">${escapeHtml(loginLabel)}</a>` : ""}
    </div>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/**
 * ASCII atsarginis failo vardas `Content-Disposition` antraštei. HTTP antraštėje
 * lietuviški simboliai neleistini, o kabutės ir backslash'as nutrauktų quoted-string
 * (tikrąjį vardą perduodam `filename*=UTF-8''...`).
 */
function asciiFileName(name: string): string {
  const cleaned = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return cleaned.trim() || "dokumentas";
}

function contentDisposition(
  downloadName: string,
  asciiFallback: string,
  disposition: DocumentDelivery["disposition"]
): string {
  return `${disposition}; filename="${asciiFileName(asciiFallback)}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`;
}

/**
 * Viešo dokumento atsakymą leidžiam talpyklauti, bet trumpai: matomumą admin'as
 * gali išjungti bet kada (`toggleDocumentVisibility`), o ilga CDN talpykla
 * dokumentą dar valandą dalintų jau po paslėpimo. Neviešas dokumentas
 * netalpyklaujamas išvis – jis priklauso nuo sesijos.
 */
const PUBLIC_DOC_MAX_AGE_SECONDS = 300;

function cacheControl(isPublicDoc: boolean): string {
  return isPublicDoc
    ? `public, max-age=${PUBLIC_DOC_MAX_AGE_SECONDS}`
    : "private, no-store";
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const locale = getLocale();
  const segments = params.path || [];
  if (segments.length === 0) return errorPage("missing", 404, locale);

  const isStorageRequest = segments[0] === STORAGE_PREFIX;

  // `documents.file_path` reikšmė, pagal kurią randam registro įrašą.
  let filePath: string;
  let relativePath = "";

  if (isStorageRequest) {
    // Storage failų vardai istoriškai turi tarpų, skliaustų ir lietuviškų
    // raidžių (dalis įkelta be sanitarizavimo), todėl simbolių aibės neribojam –
    // užtenka atmesti kelio manipuliacijas. Tikroji prieigos kontrolė yra
    // `documents` įrašas: be jo failas neatiduodamas.
    //
    // Skaidom PO sujungimo: Next.js `%2F` iškoduoja segmento viduje, todėl
    // „..%2F.." atkeliauja kaip vienas segmentas su brūkšniais.
    const candidate = segments.slice(1).join("/");
    const parts = candidate.split("/");
    const invalid =
      candidate === "" ||
      candidate.includes("\\") ||
      parts.some((s) => s === "" || s === "." || s === "..");
    if (invalid) return errorPage("missing", 404, locale);
    filePath = candidate;
  } else {
    if (!segments.every((s) => SAFE_SEGMENT.test(s))) {
      return errorPage("missing", 404, locale);
    }
    relativePath = segments.join("/");
    const fullPath = path.resolve(DOCS_ROOT, relativePath);
    if (fullPath !== DOCS_ROOT && !fullPath.startsWith(DOCS_ROOT + path.sep)) {
      return errorPage("missing", 404, locale);
    }
    filePath = `__api__/dokumentai/${relativePath}`;
  }

  const supabase = createServerSupabaseClient();

  // RLS jau riboja matomumą (anon mato tik `is_public = true`, patvirtintas
  // narys – ir neviešus), bet mums reikia žinoti ir patį `is_public`, kad
  // nuspręstume dėl anon prieigos.
  const { data: doc } = await supabase
    .from("documents")
    .select("id, title, file_name, is_public")
    .eq("file_path", filePath)
    .maybeSingle();

  const isPublicDoc = doc?.is_public === true;

  if (!isPublicDoc) {
    // (a) Anon balsuotojas su galiojančiu tokenu – prie jo susirinkimo
    // prikabintus failus jis mato ir be sesijos (žr. `src/lib/document-access.ts`).
    // Repo statiniams failams šis kelias nereikalingas: darbotvarkėje jų nėra.
    const token = request.nextUrl.searchParams.get("token");
    if (isStorageRequest && token && isAdminClientAvailable()) {
      const tokenDoc = await findDocumentForVotingToken(
        { anon: supabase, admin: createAdminSupabaseClient() },
        filePath,
        token
      );
      if (tokenDoc) {
        return serveStorageObject(filePath, tokenDoc.file_name, false, locale);
      }
    }

    // (b) Įprastas kelias – prisijungęs patvirtintas narys arba adminas.
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return errorPage("unauthorized", 401, locale);

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_approved")
      .eq("id", user.id)
      .maybeSingle();

    // Vienintelis vartas – `is_approved`, be rolės išimties. `revokeUser()`
    // atima prieigą būtent šia vėliavėle, o middleware tokį vartotoją iš
    // apsaugotų puslapių atjungia; šis route'as yra už middleware matcher ribų
    // ir failą skaito apeidamas RLS (repo failas arba service-role nuoroda),
    // todėl tą pačią taisyklę turi taikyti pats. Rolės išimtis praleisdavo
    // atšauktą administratorių su dar gyva sesija, o naudos neduodavo:
    // administratorius visada turi `is_approved = true` (žr. `approveUser`).
    // Tas pats kontraktas derinamas ir `requireAdmin()` / `public.is_admin()`
    // pusėje – prieiga visur remiasi patvirtinta paskyra.
    const allowed = !!profile && profile.is_approved === true;
    if (!allowed) return errorPage("denied", 403, locale);

    // Storage objektą atiduodam TIK tada, kai jis užregistruotas `documents`
    // lentelėje – kitaip patvirtintas narys galėtų pasiimti bet kurį bucket'o
    // failą (pvz. seną, sąmoningai nepaskelbtą versiją). Repo failams įrašo
    // nereikalaujam: jie patenka į saugyklą tik per repozitoriją.
    if (isStorageRequest && !doc) return errorPage("missing", 404, locale, filePath);
  }

  if (isStorageRequest) {
    return serveStorageObject(filePath, doc?.file_name ?? null, isPublicDoc, locale);
  }

  let file: Buffer;
  try {
    file = await readFile(path.resolve(DOCS_ROOT, relativePath));
  } catch {
    // Failas dingęs / niekada neįkeltas – aiški būsena, ne tylus nieko
    // neveikimas ir ne neinformatyvus JSON.
    return errorPage("missing", 404, locale, relativePath);
  }

  // Ta pati tipų taisyklė kaip Storage failams – repo aplanke šiandien yra tik
  // PDF, bet HTML ten patekęs taip pat neturi būti rodomas iš mūsų kilmės.
  const baseName = path.basename(relativePath);
  const delivery = resolveDocumentDelivery(baseName);

  return new NextResponse(file as unknown as BodyInit, {
    headers: {
      "Content-Type": delivery.contentType,
      "Content-Disposition": contentDisposition(
        doc?.file_name || baseName,
        baseName,
        delivery.disposition
      ),
      "Cache-Control": cacheControl(isPublicDoc),
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/**
 * Atiduoda objektą iš privataus `documents` bucket'o.
 *
 * Pasirašyta nuoroda generuojama service-role klientu ir naudojama TIK
 * serveryje – turinys persiunčiamas srautu, todėl naršyklė mato tik mūsų
 * domeno adresą (svarbu ir `react-pdf` peržiūrėtuvui: same-origin, be CORS).
 */
async function serveStorageObject(
  filePath: string,
  fileName: string | null,
  isPublicDoc: boolean,
  locale: Locale
): Promise<NextResponse> {
  if (!isAdminClientAvailable()) {
    return errorPage("unavailable", 503, locale);
  }

  const admin = createAdminSupabaseClient();
  const { data: signed, error: signError } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(filePath, SIGNED_URL_TTL_SECONDS);

  if (signError || !signed?.signedUrl) {
    // Dažniausia priežastis – objekto nebėra (`documents` eilutė ir failas yra
    // du atskiri dalykai, žr. `src/lib/document-status.ts`).
    return errorPage("missing", 404, locale, filePath);
  }

  let upstream: Response;
  try {
    upstream = await fetch(signed.signedUrl, { cache: "no-store" });
  } catch {
    return errorPage("unavailable", 502, locale);
  }

  if (!upstream.ok || !upstream.body) {
    const gone = upstream.status === 400 || upstream.status === 404;
    return gone
      ? errorPage("missing", 404, locale, filePath)
      : errorPage("unavailable", 502, locale);
  }

  // Tipą sprendžia plėtinys, ne Storage saugomas MIME: įkeltas `text/html`
  // iš mūsų kilmės su `inline` būtų vykdomas kaip puslapio dalis
  // (žr. `src/lib/document-mime.ts`).
  const baseName = filePath.split("/").pop() || "dokumentas";
  const delivery = resolveDocumentDelivery(baseName, upstream.headers.get("content-type"));
  const contentLength = upstream.headers.get("content-length");

  const headers = new Headers({
    "Content-Type": delivery.contentType,
    "Content-Disposition": contentDisposition(
      fileName || baseName,
      baseName,
      delivery.disposition
    ),
    "Cache-Control": cacheControl(isPublicDoc),
    "X-Content-Type-Options": "nosniff",
    // Range užklausų nepersiunčiam, todėl ir `Accept-Ranges` neskelbiam –
    // kitaip pdf.js bandytų dalinius parsiuntimus, kurių route'as nepalaiko.
    "Accept-Ranges": "none",
  });
  if (contentLength) headers.set("Content-Length", contentLength);

  return new NextResponse(upstream.body, { headers });
}
