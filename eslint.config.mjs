import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // ループの自己確認用スクリプト（Node の CommonJS）
    "scripts/**/*.cjs",
    // 紹介動画 v3 の合成ページ用（ブラウザで <script> として読む。Node の検査の対象外）
    "scripts/video-v3/*.js",
    ".shots/**",
    // 並行作業用の作業コピー（Claude Code）
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;
