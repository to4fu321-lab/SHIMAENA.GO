import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // resvg はネイティブの .node を持つので、束ねずにそのまま読み込む
  serverExternalPackages: ["@resvg/resvg-js"],
  // /admin の「DB を準備する」が db/schema.sql を読むので、Vercel のサーバー側に同梱する
  // /admin の「DB を準備する」が db/schema.sql を、カードの PNG 化が日本語フォントを読むので、Vercel のサーバー側に同梱する
  outputFileTracingIncludes: { "/admin": ["./db/schema.sql"], "/api/cards/**": ["./assets/fonts/*.ttf"], "/api/share/**": ["./assets/fonts/*.ttf"], "/api/line/hero/**": ["./assets/fonts/*.ttf"] },
  partialPrefetching: true,
  // 前の「広める」（/share）は「つなぐ」（/connect）に統合（11/6、spec v1.22）。古いリンクのために転送（?as= はそのまま付く）
  async redirects() {
    return [{ source: "/share", destination: "/connect", permanent: false }];
  },
  // 写真つきの報告（ソロの After・道の危険の写真＋ぼかし済みの小さい写真）は 1MB を超えることがあり、
  // 本番で「Body exceeded 1 MB limit」（413）になっていた（11/6）。縮めた写真2枚ぶんに余裕をもたせる
  experimental: { serverActions: { bodySizeLimit: "8mb" } },
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
