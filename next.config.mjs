/**
 * Naršyklės saugumo antraštės.
 *
 * `Content-Security-Policy` įjungiama TIK „report-only" režimu: taisyklės
 * pažeidimai matomi naršyklės konsolėje, bet nieko neblokuoja. Taip galima
 * ramiai patikrinti, ar politika nesugadina PDF peržiūros, Supabase užklausų
 * ar admin ekranų, ir tik tada perjungti į įgalinamą `Content-Security-Policy`.
 *
 * KĄ REIKĖS SUGRIEŽTINTI pereinant į įgalinimą:
 *   • `script-src 'unsafe-inline'` – Next.js įterpia inline `<script>` blokus
 *     (hidratacijos duomenys), o keli dokumentai turi `onclick="window.print()"`.
 *     Tvarkinga išeitis – nonce per middleware ir `onclick` iškėlimas į
 *     atskirą skriptą;
 *   • `style-src 'unsafe-inline'` – projekte daug `style="..."` atributų
 *     (ypač spausdinamuose dokumentuose ir el. laiškų peržiūrose);
 *   • `https://unpkg.com` – iš ten imamas `pdf.js` worker'is
 *     (`src/components/PdfViewer.tsx`). Failą atsinešus į `public/` ši išimtis
 *     dingtų ir kartu nereikėtų pasitikėti trečios šalies CDN.
 */

// Supabase kreipiniai (REST, Auth, Storage, realtime) eina į projekto domeną.
// Statinės analizės metu jis žinomas per build env; jei ne – leidžiam bendrą
// Supabase domeno šabloną, kad politika nebūtų tyliai per griežta.
const supabaseOrigin = (() => {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
})();

const supabaseHttp = supabaseOrigin || "https://*.supabase.co";
const supabaseWs = supabaseOrigin
  ? supabaseOrigin.replace(/^https:/, "wss:")
  : "wss://*.supabase.co";

// `pdf.js` worker'is (žr. `src/components/PdfViewer.tsx`): naršyklė jį
// parsisiunčia iš CDN ir paleidžia kaip `blob:` worker'į, todėl reikia ir
// `script-src`, ir `worker-src blob:`.
const PDF_WORKER_CDN = "https://unpkg.com";

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${PDF_WORKER_CDN}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseHttp}`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseHttp} ${supabaseWs} ${PDF_WORKER_CDN}`,
  "worker-src 'self' blob:",
  "frame-src 'self'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // Report-only režime naršyklė šios direktyvos nevykdo (taip numato CSP
  // specifikacija) – palikta tam, kad perjungiant į įgalinamą antraštę
  // nereikėtų jos prisiminti.
  "upgrade-insecure-requests",
].join("; ");

/** Antraštės visiems atsakymams. */
const baseHeaders = [
  // Neleisti naršyklei spėlioti turinio tipo (dokumentų route'ai `Content-Type`
  // nustato patys).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Į kitą domeną išeinam be kelio ir be užklausos parametrų.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Dokumentų peržiūros iframe'ai yra to paties domeno, todėl SAMEORIGIN
  // pakanka (senesnėms naršyklėms – `frame-ancestors` atitikmuo).
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy },
];

/**
 * Puslapiai, kurių adrese yra vienkartinis tokenas (SMS magic link) arba
 * slaptažodžio atstatymo kodas. Jų nei talpyklauti, nei indeksuoti negalima, o
 * `Referer` neturi išnešti tokeno į svetimą domeną.
 *
 * Next.js šiuos maršrutus ir taip atiduoda dinamiškai (šakninis `layout.tsx`
 * skaito cookie), todėl `Cache-Control` čia yra papildomas sluoksnis tarpinėms
 * talpykloms, ne vienintelė apsauga.
 */
const TOKEN_ROUTES = [
  "/balsuoti/:path*",
  "/deklaracija/:path*",
  "/duomenys/:path*",
  "/nustatyti-slaptazodi",
  "/auth/:path*",
];

const tokenHeaders = [
  { key: "Cache-Control", value: "no-store, max-age=0" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  { key: "Referrer-Policy", value: "no-referrer" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // Numatyta 1 MB – per mažai eigos nuotraukų įkėlimui (kelios JPEG po ~0,5 MB)
      bodySizeLimit: "15mb",
    },
    // Vercel'io serverless bundle'as sudaromas statine analize, o
    // `/api/dokumentai/[...path]` failo kelią sudeda dinamiškai (readFile su
    // kintamu segmentu). Be šio įrašo `private/documents/` failai (įstatai)
    // į lambda'ą nepatektų ir produkcijoje virstų 404.
    outputFileTracingIncludes: {
      "/api/dokumentai/**": ["./private/documents/**"],
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: baseHeaders },
      ...TOKEN_ROUTES.map((source) => ({ source, headers: tokenHeaders })),
    ];
  },
};

export default nextConfig;
