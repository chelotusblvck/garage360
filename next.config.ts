import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Rutas previas de la tienda.
  async redirects() {
    return [
      { source: "/catalog", destination: "/shop", permanent: true },
      { source: "/checkout", destination: "/shop/checkout", permanent: true },
    ];
  },
  experimental: {
    serverActions: {
      // Imágenes de producto de hasta 5 MB + overhead de multipart.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
