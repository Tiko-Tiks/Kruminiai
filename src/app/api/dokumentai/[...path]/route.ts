import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextResponse, type NextRequest } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { getLocale } from "@/lib/i18n-server";
import type { Locale } from "@/lib/i18n";

/**
 * Statinių dokumentų (repo `private/documents/`) atidavimo route'as.
 *
 * KELIO FORMATAS: `documents.file_path = "__api__/dokumentai/<failas>"`
 * → `getDocumentPublicUrl()` paverčia į `/api/dokumentai/<failas>`.
 *
 * Kodėl toks mechanizmas apskritai reikalingas (žr. CLAUDE.md „Įkelti failai"):
 * dauguma PDF'ų gyvena Supabase Storage `documents` bucket'e ir atiduodami
 * tiesiogiai per public URL. Tačiau keli dokumentai (įstatai) yra versijuojami
 * kartu su kodu repozitorijoje – jiems reikia serverio route'o.
 *
 * PRIEIGA seka `documents.is_public`, o ne vien sesiją:
 *   • `is_public = true`  → mato visi, įskaitant neprisijungusius (įstatai yra
 *     vieši pagal LR Asociacijų įstatymą – jų negalima slėpti už prisijungimo);
 *   • kitu atveju        → tik prisijungęs IR patvirtintas narys arba adminas.
 *     (/api/* yra už middleware matcher ribų, todėl tikrinam patys.)
 *
 * KLAIDOS grąžinamos kaip suprantamas HTML puslapis (dokumentai atidaromi
 * naujame lange – žalias JSON `{"error": "..."}` naudotojui nieko nesako).
 */

export const dynamic = "force-dynamic";

const DOCS_ROOT = path.join(process.cwd(), "private", "documents");

// Leidžiam tik paprastus failų vardus/aplankus – jokių „..", slash'ų ar
// ne-ASCII simbolių (Storage'e failų vardai irgi sanitarizuojami).
const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".txt": "text/plain; charset=utf-8",
};

interface ErrorCopy {
  heading: string;
  body: string;
  hint: string;
}

const ERROR_COPY: Record<Locale, Record<"missing" | "denied" | "unauthorized", ErrorCopy>> = {
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
  },
};

function errorPage(
  kind: "missing" | "denied" | "unauthorized",
  status: number,
  locale: Locale,
  detail?: string
): NextResponse {
  const copy = ERROR_COPY[locale][kind];
  const backLabel = locale === "en" ? "Back to documents" : "Grįžti į dokumentus";
  const loginLabel = locale === "en" ? "Sign in" : "Prisijungti";
  const showLogin = kind !== "missing";

  const html = `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex">
  <title>${copy.heading}</title>
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
    <h1>${copy.heading}</h1>
    <p>${copy.body}</p>
    <p class="hint">${copy.hint}</p>
    ${detail ? `<p class="detail">${detail}</p>` : ""}
    <div class="actions">
      <a class="btn primary" href="/dokumentai">${backLabel}</a>
      ${showLogin ? `<a class="btn secondary" href="/prisijungimas">${loginLabel}</a>` : ""}
    </div>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const locale = getLocale();
  const segments = params.path || [];

  if (segments.length === 0 || !segments.every((s) => SAFE_SEGMENT.test(s))) {
    return errorPage("missing", 404, locale);
  }

  const relativePath = segments.join("/");
  const fullPath = path.resolve(DOCS_ROOT, relativePath);
  if (fullPath !== DOCS_ROOT && !fullPath.startsWith(DOCS_ROOT + path.sep)) {
    return errorPage("missing", 404, locale);
  }

  const supabase = createServerSupabaseClient();

  // RLS jau riboja matomumą (anon mato tik `is_public = true`), bet mums
  // reikia žinoti ir patį `is_public`, kad nuspręstume dėl anon prieigos.
  const { data: doc } = await supabase
    .from("documents")
    .select("id, title, file_name, is_public")
    .eq("file_path", `__api__/dokumentai/${relativePath}`)
    .maybeSingle();

  const isPublicDoc = doc?.is_public === true;

  if (!isPublicDoc) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return errorPage("unauthorized", 401, locale);

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_approved")
      .eq("id", user.id)
      .maybeSingle();

    // Vienintelis kriterijus – PATVIRTINTAS profilis. Rolės išimties čia nėra:
    // nuo migr. 048 administratorius pagal apibrėžimą yra patvirtintas
    // (`public.is_admin()` / `requireAdmin()`), o failas skaitomas tiesiai iš
    // repo `private/documents/`, todėl RLS šio kelio neapsaugo – atšaukta
    // prieiga (`is_approved = false`) su dar gyva sesija turi baigtis 403.
    const allowed = !!profile && profile.is_approved === true;
    if (!allowed) return errorPage("denied", 403, locale);
  }

  let file: Buffer;
  try {
    file = await readFile(fullPath);
  } catch {
    // Failas dingęs / niekada neįkeltas – aiški būsena, ne tylus nieko
    // neveikimas ir ne neinformatyvus JSON.
    return errorPage("missing", 404, locale, relativePath);
  }

  const ext = path.extname(relativePath).toLowerCase();
  const contentType = CONTENT_TYPES[ext] || "application/octet-stream";
  const fileName = doc?.file_name || path.basename(relativePath);

  return new NextResponse(file as unknown as BodyInit, {
    headers: {
      "Content-Type": contentType,
      // ASCII-only filename – lietuviški simboliai HTTP antraštėje neleistini
      "Content-Disposition": `inline; filename="${path.basename(relativePath)}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": isPublicDoc
        ? "public, max-age=3600, stale-while-revalidate=86400"
        : "private, no-store",
    },
  });
}
