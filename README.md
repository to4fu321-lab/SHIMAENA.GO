# シマエナGO

**寒い冬は、くっついて乗り切る。**

雪の朝に LINE で点呼が届き、町内のランダム3チームが、ひとり暮らしの家の雪をどける。
参加するほど、その朝だけのカードが増えていく雪かきゲームです。

Built with Claude: Japan 2026（Anthropic × Cerebral Valley 主催）提出作品。
**11月2日〜11月8日の期間中に、このリポジトリ上でゼロから制作しています。**

![ありがとうカードの試作](docs/design/cards/01-kawaii-citypop.png)

## 公開中のアプリ
- https://yukikaki-karano-kaihou.vercel.app/ （あそびかた `/rules`・地図 `/map`・デモ操作 `/admin`）

## デモ動画
（3分・日本語。提出時に URL を記入）

## 誰の、どんな課題を、どう解決するか
- **誰の**: 札幌の一軒家にひとりで暮らす高齢者。雪の朝、玄関から道路まで出られない。
- **どんな課題**: 近所に頼みたくても頼みにくい。手伝える人がいても、誰がどこで困っているか分からない。雪かきは早朝の重労働で、「ありがとう」だけでは人が集まらない。
- **どう解決するか**: 雪の朝に LINE で1問だけの点呼。「いいえ」の1タップで、Claude が近所のチームに5分単位の小さな仕事として割り振る。地図が塗られていき、動いた人にはその朝だけのカードが届く。

## 仕組み
詳しくは [`docs/spec.md`](docs/spec.md)。

## 技術
- Next.js（App Router）/ TypeScript / Tailwind CSS / Vercel / Neon（Postgres）
- Claude API（レベル判定・司令官・写真確認・カード生成・週末の実況）
- LINE Messaging API ＋ LIFF
- Leaflet ＋ OpenStreetMap、Open-Meteo

## Claude Code をどう使ったか
（制作後に記入。スマホから Claude Code に指示するだけで開発しています）

## 開発の記録
- 日々の記録: [`docs/devlog.md`](docs/devlog.md)
- 作業の順番: [`docs/tasks.md`](docs/tasks.md)
- 検討して見送った案: [`docs/plan-b-nuisho.md`](docs/plan-b-nuisho.md) ほか

## ローカルで動かす
```bash
npm install
npm run dev
```
`.env.local` に `ANTHROPIC_API_KEY` などを置きます（リポジトリには含めません）。

## データの出典
- 地図と建物の形: © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors（ODbL）
- 天気: [Open-Meteo](https://open-meteo.com/)
- デモの町内「しらかば町内」と登場人物は架空です。建物の形だけを OpenStreetMap から借りています（`scripts/build-town.cjs`）。

## ルールの遵守
- 期間中の新規制作のみ。既存コードの流用はありません。
- デモ用データはすべて架空の人物・場所です。
