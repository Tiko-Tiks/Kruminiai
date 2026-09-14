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
};

export default nextConfig;
