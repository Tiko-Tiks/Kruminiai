/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // Numatyta 1 MB – per mažai eigos nuotraukų įkėlimui (kelios JPEG po ~0,5 MB)
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;
