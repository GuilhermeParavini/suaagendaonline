import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  async headers() {
    return [
      {
        // Bundles do Next sao versionados pelo build-id no path; podem ser
        // cacheados imutavelmente por 1 ano.
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Icones gerais do PWA — cache de 1 dia (poucas alteracoes mas nao
        // versionados via filename).
        source: "/icons/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400" },
        ],
      },
      {
        // Service worker: nao deve ser cacheado por longa duracao senao
        // atualizacoes de cache name/versao demoram a propagar.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
      {
        // manifest.json muda raramente, mas atualizacoes (ex: novos icones)
        // devem chegar no maximo em 1 dia.
        source: "/manifest.json",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400" },
        ],
      },
      {
        // Fontes individuais (woff/woff2) podem ser cacheadas longamente.
        source: "/:path*.woff2",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/:path*.woff",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
