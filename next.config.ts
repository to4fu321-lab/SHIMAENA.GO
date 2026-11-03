import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // resvg はネイティブの .node を持つので、束ねずにそのまま読み込む
  serverExternalPackages: ["@resvg/resvg-js"],
  // /admin の「DB を準備する」が db/schema.sql を読むので、Vercel のサーバー側に同梱する
  // /admin の「DB を準備する」が db/schema.sql を、カードの PNG 化が日本語フォントを読むので、Vercel のサーバー側に同梱する
  outputFileTracingIncludes: { "/admin": ["./db/schema.sql"], "/api/cards/**": ["./assets/fonts/*.ttf"] },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
