# YUKIKAKI.KARANO.KAIHOU（仮題）

Built with Claude: Japan 2026（Anthropic × Cerebral Valley 主催）提出作品。
**11月2日〜11月8日の期間中に、このリポジトリ上でゼロから制作しています。**

> テーマは 11/3 に確定します。候補は `docs/plan-a-yukiban.md`（雪かき）と `docs/plan-b-nuisho.md`（縫製）。

## 一言で
（確定後に記入）

## デモ動画
（3分・日本語。提出時に URL を記入）

## 誰の、どんな課題を、どう解決するか
（確定後に記入）

## 使い方
（確定後に記入）

## 技術
- Next.js（App Router）/ TypeScript / Tailwind CSS
- Vercel（ホスティング）/ Neon（Postgres）
- Claude API（判定・生成は JSON で受け取る）
- 音声入力: AmiVoice / Twilio / Web Speech API のいずれか（確定後に記入）

## Claude Code をどう使ったか
（Skills・フック・サブエージェントの使い方を、確定後に記入）

## 開発の記録
- 日々の記録: `docs/devlog.md`
- 検討した2案と比較: `docs/plan-a-yukiban.md` / `docs/plan-b-nuisho.md`

## ローカルで動かす
```bash
npm install
npm run dev
```
`.env.local` に `ANTHROPIC_API_KEY` などを置きます（リポジトリには含めません）。

## ハッカソンのルール遵守
- 期間中の新規制作のみ。既存コードの流用はありません。
- デモ用データはすべて架空の人物・場所です。
