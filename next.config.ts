import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // /admin の「DB を準備する」が db/schema.sql を読むので、Vercel のサーバー側に同梱する
  outputFileTracingIncludes: { "/admin": ["./db/schema.sql"] },
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
