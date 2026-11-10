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
    // 紹介動画 v4 の合成ページ用（同じ理由）
    "scripts/video-v4/*.js",
    // 動画づくりの中間ファイルと、手元の合成音声の道具（どちらも .gitignore 済み。あると検査に引っかかる）
    ".video/**",
    "scripts/video-v3/tts/venv/**",
    ".shots/**",
    // 並行作業用の作業コピー（Claude Code）
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;
