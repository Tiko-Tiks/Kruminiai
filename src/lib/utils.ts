import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";
import { lt } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), "yyyy-MM-dd");
}

export function formatDateLong(date: string | Date): string {
  return format(new Date(date), "yyyy 'm.' MMMM d 'd.'", { locale: lt });
}

/**
 * Formatuoja laiką HH:MM Europe/Vilnius zonoje.
 *
 * BŪTINA naudoti vietoj date.toLocaleTimeString("lt-LT", {...}) – Vercel
 * serveris veikia UTC zonoje, todėl SSR rodytų UTC valandą (pvz. 15:00
 * vietoj 18:00 Vilniaus laiku). Šis helper'is visada konvertuoja į
 * Europe/Vilnius nepriklausomai nuo serverio zonos.
 */
export function formatTime(date: string | Date): string {
  return new Date(date).toLocaleTimeString("lt-LT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Vilnius",
  });
}

/**
 * „YYYY-MM-DDTHH:mm" (Europe/Vilnius sieninis laikas) → ISO instantas (UTC).
 *
 * KODĖL REIKIA: admin formose laikas įvedamas Vilniaus laiku, o DB stulpeliai
 * yra `timestamptz`. Naivų „2026-09-13T18:00:00" Postgres parsina serverio
 * zona (Supabase – UTC), todėl įvestos 18:00 virsdavo 18:00 UTC ir visur
 * (protokole, portale, viešame puslapyje) atsispindėdavo kaip 21:00 Vilniaus
 * laiku. Konvertuojam eksplicitiškai.
 *
 * Offsetas skaičiuojamas per Intl – be papildomų priklausomybių ir su vasaros
 * laiko (EET/EEST) perjungimu. Antras praėjimas patikslina DST ribos atvejį.
 */
export function vilniusLocalToIso(local: string): string {
  const asIfUtc = new Date(`${local}:00Z`).getTime();
  if (Number.isNaN(asIfUtc)) return local;
  let offset = vilniusOffsetMs(asIfUtc);
  let instant = asIfUtc - offset;
  offset = vilniusOffsetMs(instant);
  instant = asIfUtc - offset;
  return new Date(instant).toISOString();
}

/** ISO instantas → „YYYY-MM-DDTHH:mm" Europe/Vilnius laiku (formų reikšmėms). */
export function isoToVilniusLocal(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "";
  const p = vilniusParts(d.getTime());
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

function vilniusParts(timestamp: number) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Vilnius",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(timestamp));
  const get = (type: string) => parts.find((x) => x.type === type)?.value || "00";
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    // en-GB su hour12:false vidurnaktį pateikia kaip „24" – normalizuojam
    hour: get("hour") === "24" ? "00" : get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

function vilniusOffsetMs(timestamp: number): number {
  const p = vilniusParts(timestamp);
  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second)
  );
  return asUtc - timestamp;
}

export function formatCurrency(cents: number): string {
  return `${(cents / 100).toFixed(2)} €`;
}

/**
 * Pinigai su tūkstančių skirtukais – didelėms sumoms (finansų suvestinėms).
 * „1386850" → „13 868,50 €" (lt) arba „€13,868.50" (en).
 *
 * `formatCurrency` lieka trumpoms sumoms lentelėse, kur grupavimas nereikalingas.
 */
export function formatMoney(cents: number, locale: "lt" | "en" = "lt"): string {
  return new Intl.NumberFormat(locale === "en" ? "en-IE" : "lt-LT", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

// Sukonstruoti viešą URL dokumentui pagal file_path.
// Palaiko kelis formatus:
//   - __api__/dokumentai/X → /api/dokumentai/X (statinis failas iš repo
//     `private/documents/`, atiduodamas per route'ą; prieigą lemia
//     `documents.is_public`)
//   - __api__/X/Y    → /api/X/Y (server-rendered HTML, pvz. salinami sąrašas)
//   - __public__/X   → /X (statinis viešas failas)
//   - X.pdf (default) → Supabase Storage public URL
export function getDocumentPublicUrl(filePath: string): string {
  if (filePath.startsWith("__api__/")) {
    return `/api/${filePath.replace("__api__/", "")}`;
  }
  if (filePath.startsWith("__public__/")) {
    return `/${filePath.replace("__public__/", "")}`;
  }
  // Supabase Storage objektai atiduodami per prieigos kontrolės route'ą, o ne
  // tiesioginiu bucket'o URL: viešame bucket'e failas pasiekiamas be jokios
  // autentifikacijos, todėl `documents.is_public = false` nieko nereikštų.
  // `failai/` – rezervuotas pirmas segmentas (žr.
  // `src/app/api/dokumentai/[...path]/route.ts`); kiekvienas kelio segmentas
  // koduojamas atskirai, kad tarpai ir skliaustai failų varduose nesugadintų URL.
  const encoded = filePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `/api/dokumentai/failai/${encoded}`;
}

// Sukonstruoti viešą URL nuotraukai images bucket'e (pvz. projektų eigos foto).
//
// Su `width` grąžinamas Supabase transformacijų (`/render/image/`) URL – failas
// sumažinamas serveryje (naršyklei, kuri siunčia `Accept: image/webp`, atiduodamas
// ir WebP). Be šito į 176 px pločio
// miniatiūrą buvo siunčiamas originalus telefono JPEG: naujienų viršeliai
// realiai svėrė 0,5 MB vienetui, t. y. ~1,3 MB vien už tris paveikslėlius
// sąraše. Tas pats failas su `width=400&quality=70` sveria ~30 KB.
//
// `width` – **CSS pločio** reikšmė; helperis pats padvigubina Retina ekranams.
export function getImagePublicUrl(
  path: string,
  opts?: { width?: number; quality?: number }
): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  if (!opts?.width) {
    return `${base}/storage/v1/object/public/images/${path}`;
  }
  const params = new URLSearchParams({
    width: String(Math.round(opts.width * 2)),
    quality: String(opts.quality ?? 70),
  });
  return `${base}/storage/v1/render/image/public/images/${path}?${params}`;
}

// HTML escape – naudotojo įvesties įterpimui į HTML (pvz. el. laiškus).
// Būtina anon srautuose (registracija), kur vardai/laukai ateina iš formos ir
// gali turėti HTML/script (phishing turinio injekcija į brand'intą laišką).
//
// Įgyvendinimas gyvena `src/lib/html.ts` kartu su kitais konteksto kodavimo
// pagalbininkais (`escapeAttr`, `escapeHtmlLines`, `safeUrl`) – čia paliktas
// re-eksportas, kad esami importai iš `@/lib/utils` nesikeistų ir kad
// neatsirastų antra tos pačios funkcijos kopija.
export { escapeHtml } from "@/lib/html";

// Ar dokumentas yra server-generuojamas HTML (ne PDF failas)?
// Naudojama nuspręsti, ar peržiūrai naudoti iframe ar PdfViewer.
//
// SVARBU: `__api__/` prefiksą naudoja DU skirtingi dalykai – generuojami HTML
// dokumentai (veiklos planas, šalinami, rinkimai) IR statiniai repo failai
// (`__api__/dokumentai/istatai-kkb.pdf`). Skiriam pagal plėtinį: .pdf visada
// rodomas per PdfViewer, ne iframe (žr. „Ko neperdaryti" – iframe PDF Android'e
// atveria OS dialogą).
export function isServerGeneratedDoc(filePath: string): boolean {
  return filePath.startsWith("__api__/") && !/\.pdf$/i.test(filePath);
}

// Lietuviškas šauksmininkas (vocative case) – kreipiniams.
// Mindaugas → Mindaugai, Andrius → Andriau, Eglė → Egle.
export function vocative(name: string): string {
  if (!name) return name;
  const lower = name.toLowerCase();
  // -ius → -iau (turi būti tikrinamas prieš -us)
  if (lower.endsWith("ius")) return name.slice(0, -3) + "iau";
  // -ys → -y
  if (lower.endsWith("ys")) return name.slice(0, -2) + "y";
  // -us → -au
  if (lower.endsWith("us")) return name.slice(0, -2) + "au";
  // -as → -ai
  if (lower.endsWith("as")) return name.slice(0, -2) + "ai";
  // -is → -i
  if (lower.endsWith("is")) return name.slice(0, -2) + "i";
  // -ė → -e
  if (lower.endsWith("ė")) return name.slice(0, -1) + "e";
  // -a → nesikeičia (Aldona, Rasa)
  return name;
}

// Lietuviškų diakritikų nuėmimas (ą→a, š→s, ž→z...) išsaugant kitus simbolius.
// Naudojama tiek slug'ams, tiek narių paieškai (kad „Ausra" rastų „Aušra").
export function transliterateLt(text: string): string {
  const charMap: Record<string, string> = {
    ą: "a", č: "c", ę: "e", ė: "e", į: "i",
    š: "s", ų: "u", ū: "u", ž: "z",
    Ą: "A", Č: "C", Ę: "E", Ė: "E", Į: "I",
    Š: "S", Ų: "U", Ū: "U", Ž: "Z",
  };
  return text
    .split("")
    .map((c) => charMap[c] || c)
    .join("");
}

export function generateSlug(text: string): string {
  return transliterateLt(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
