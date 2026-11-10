// 紹介動画（3分・v3）の台本。ここが正本。秒は書かない: 声の長さ（.video/v3/voice/voice.json）から layout.cjs が時間割を作る。
//
// 審査基準との対応（章）:
//   1 課題（インパクト 30%）: 自分の暮らしから出発／誰が・どんな場面で・どれくらい困っているか／足りないもの＝「見えない」
//   2 デモ（デモ 25%）: 冒頭で「誰の・何を・どう」／実際の操作の流れ／声のありがとうで山場
//   3 Claude（Claude の活用 25%）: アプリの中の役割とモデルの使い分け／Claude Code が開発の中心／サブエージェント・Skill・定期タスク・MCP
//   4 深さとこれから（深さと実行力 20%）: 1週間の量と磨き込み／安心して使える設計／ハッカソンのあとに誰が使うか
//
// lines: id・who（narr=本人の文／captain=隊長／grand=孫の声）・text（字幕。「／」で改行）・say（読み上げ用。読み間違えやすい語はかなで）
//   gap = 前の行との間（秒。既定 0.25）。scene の lead = 場面の頭から最初の声まで、tail = 最後の声から場面の終わりまで、min = 最低の長さ
module.exports = {
  fps: 30,
  maxSeconds: 180,
  scenes: [
    // ───────── 1 課題 ─────────
    { id: "open", chapter: 1, lead: 1.1, tail: 0.35, lines: [
      { id: "n01", who: "narr", text: "札幌に来て、15年。", say: "札幌に来て、十五年。" },
      { id: "n02", who: "narr", text: "雪かきで、毎年、腰を痛めます。", say: "雪かきで毎年、腰を痛めます。", gap: 0.25 },
    ] },
    { id: "car", chapter: 1, lead: 0.3, tail: 1.7, lines: [
      { id: "n03", who: "narr", text: "北海道の人は、雪にはまった車を、100%助けます。", say: "北海道の人は、雪にはまった車を、ひゃくパーセント助けます。" },
    ] },
    { id: "invisible", chapter: 1, lead: 0.3, tail: 0.8, lines: [
      { id: "n05", who: "narr", text: "でも、知らない家の雪かきは、しない。", say: "でも、知らない家の雪かきはしない。" },
      { id: "n06", who: "narr", text: "冷たいからじゃない。", say: "冷たいからじゃない。", gap: 0.4 },
      { id: "n07", who: "narr", text: "誰が困っているか、見えないからです。", say: "誰が困っているか、見えないからです。", gap: 0.25 },
    ] },
    { id: "numbers", chapter: 1, lead: 0.3, tail: 1.3, lines: [
      { id: "n08", who: "narr", text: "雪かきの手伝いが必要な人は、ほとんどが70歳以上。", say: "雪かきの手伝いが必要な人は、ほとんどがななじゅっさい以上。" },
      { id: "n09", who: "narr", text: "手伝う近所の人も、7割が70歳以上。", say: "手伝う近所の人も、ななわりがななじゅっさい以上。", gap: 0.3 },
    ] },
    { id: "key", chapter: 1, lead: 0.6, tail: 1.0, lines: [
      { id: "n10", who: "narr", text: "足りないのは、人じゃない。", say: "足りないのは、ひとじゃない。" },
      { id: "n11", who: "narr", text: "見えないことです。", say: "見えないことです。", gap: 0.45 },
    ] },
    { id: "title", chapter: 1, lead: 1.3, tail: 0.7, lines: [
      { id: "n12", who: "narr", text: "シマエナGOは、それを見えるようにします。", say: "シマエナゴーは、それを見えるようにします。" },
      { id: "n13", who: "narr", text: "雪の朝、近所の3チームが、10分だけ、助けに行く。", say: "雪の朝、近所のさんチームが、じゅっぷんだけ助けに行く。", gap: 0.3 },
    ] },

    // ───────── 2 デモ ─────────
    { id: "ask", chapter: 2, lead: 0.3, tail: 0.5, lines: [
      { id: "n14", who: "narr", text: "頼む家は、冬の初めに一度、登録するだけ。", say: "頼む家は、冬の初めに一度登録するだけ。" },
      { id: "n15", who: "narr", text: "雪の朝に、頼まなくていい。", say: "雪の朝に、頼まなくていい。", gap: 0.25 },
    ] },
    { id: "ring", chapter: 2, lead: 0.3, tail: 1.3, lines: [
      { id: "n16", who: "narr", text: "10センチ積もった朝6時半、近所のスマホに届きます。", say: "じゅっセンチ積もった朝ろくじはん、近所のスマホに届きます。" },
    ] },
    { id: "commander", chapter: 2, lead: 0.3, tail: 1.8, lines: [
      { id: "n18", who: "narr", text: "誰がどの家へ行くかは、AIの隊長、Claudeが決めます。", say: "誰がどの家へ行くかは、エーアイの隊長、クロードが決めます。" },
    ] },
    { id: "go", chapter: 2, lead: 0.3, tail: 2.1, lines: [
      { id: "n20", who: "narr", text: "「行く」を押して、家へ。", say: "行く、を押して家へ。" },
      { id: "n21", who: "narr", text: "チームは毎週シャッフル。／知らない家でも、チームなら行けます。", say: "チームは毎週シャッフル。知らない家でも、チームなら行けます。", gap: 0.45 },
    ] },
    { id: "finish", chapter: 2, lead: 0.3, tail: 1.0, lines: [
      { id: "n22", who: "narr", text: "終わったら、写真を1枚。", say: "終わったら、写真を一枚。" },
      { id: "n23", who: "narr", text: "Claudeが、通れるか、凍っていないかを確かめます。", say: "クロードが、通れるか凍っていないかを確かめます。", gap: 0.45 },
    ] },
    { id: "card", chapter: 2, lead: 0.35, tail: 1.6, lines: [
      { id: "n24", who: "narr", text: "届くのは、Claudeが毎回ゼロから描く、／その朝だけのカード。", say: "届くのは、クロードが毎回ゼロから描く、その朝だけのカード。" },
    ] },
    { id: "thanks", chapter: 2, lead: 0.5, tail: 0.6, lines: [
      { id: "n26", who: "narr", text: "そして、ありがとう。", say: "そして、ありがとう。" },
      { id: "n27", who: "narr", text: "ここだけは、AIに書かせません。", say: "ここだけは、エーアイに書かせません。", gap: 0.4 },
    ] },
    // 山場: 音楽を止めて、声だけ（孫が、おばあちゃんの家を手伝ってくれた人へ）
    { id: "voice", chapter: 2, lead: 0.6, tail: 3.0, lines: [
      { id: "d01", who: "grand", text: "おばあちゃんの家の雪かき、ありがとうございます。／東京にいて、何もできなかったので、本当に助かりました。", say: "おばあちゃんの家の雪かき、ありがとうございます。東京にいて何もできなかったので、本当に助かりました。" },
    ] },
    { id: "principle", chapter: 2, lead: 0.45, tail: 1.2, lines: [
      { id: "n28", who: "narr", text: "AIは段取りを。", say: "エーアイは段取りを。" },
      { id: "n29", who: "narr", text: "人は、会いに行く。", say: "人は、会いに行く。", gap: 0.35 },
    ] },
    { id: "more", chapter: 2, lead: 0.3, tail: 0.8, lines: [
      { id: "n30", who: "narr", text: "雪かきができなくても、危ない道を写真で知らせられる。", say: "雪かきができなくても、危ない道を写真で知らせられる。" },
      { id: "n31", who: "narr", text: "お年寄りは、雪の知恵を教える側に。", say: "お年寄りは、雪の知恵を教える側に。", gap: 0.3 },
    ] },

    // ───────── 3 Claude ─────────
    { id: "maker", chapter: 3, lead: 0.4, tail: 0.6, lines: [
      { id: "n32", who: "narr", text: "作った私は、学生服の営業。／プログラミングは初心者です。", say: "作った私は、学生服の営業。プログラミングは初心者です。" },
      { id: "n33", who: "narr", text: "コードは1行も書かず、スマホからClaude Codeに、／日本語で頼みました。", say: "コードは、1行も書かず、スマホからクロードコードに日本語で頼みました。", gap: 0.3 },
    ] },
    { id: "loop", chapter: 3, lead: 0.3, tail: 0.8, lines: [
      { id: "n34", who: "narr", text: "最初に仕様書を決めて、あとはループで自走。", say: "最初に仕様書を決めて、あとはループで自走。" },
      { id: "n35", who: "narr", text: "企画役のサブエージェントが、事例と数字を調べ、", say: "企画役のサブエージェントが事例と数字を調べ、", gap: 0.35 },
      { id: "n36", who: "narr", text: "点検のループが、4時間おきに全画面を直します。", say: "点検のループが、よじかんおきに全画面を直します。", gap: 0.15 },
    ] },
    { id: "feedback", chapter: 3, lead: 0.3, tail: 0.8, lines: [
      { id: "n37", who: "narr", text: "使う人の「分かりにくい」は、アプリからGitHubへ。", say: "使う人の、分かりにくい、は、アプリからギットハブへ。" },
      { id: "n38", who: "narr", text: "Claude Codeが直して、本人に返事が届きます。", say: "クロードコードが直して、本人に返事が届きます。", gap: 0.25 },
    ] },
    { id: "models", chapter: 3, lead: 0.3, tail: 1.0, lines: [
      { id: "n39", who: "narr", text: "重い判断はOpus、短い文はHaiku。", say: "重い判断はオーパス、短い文はハイク。" },
      { id: "n40", who: "narr", text: "数字と安全は、AIに決めさせません。", say: "数字と安全は、エーアイに決めさせません。", gap: 0.3 },
    ] },

    // ───────── 4 深さとこれから ─────────
    { id: "depth", chapter: 4, lead: 0.3, tail: 1.7, lines: [
      { id: "n41", who: "narr", text: "1週間で、350を超えるコミット、／500本を超えるテスト。", say: "一週間で、さんびゃくごじゅうを超えるコミット、ごひゃっぽんを超えるテスト。" },
    ] },
    { id: "next", chapter: 4, lead: 0.3, tail: 1.0, lines: [
      { id: "n42", who: "narr", text: "この冬、まず一つの町内で、本物の雪で動かします。", say: "この冬、まず一つの町内で、本物の雪で動かします。" },
      { id: "n43", who: "narr", text: "測るのは、雪の朝に外へ出た人の数です。", say: "測るのは、雪の朝に外へ出た人の数です。", gap: 0.3 },
    ] },
    { id: "future", chapter: 4, lead: 0.5, tail: 1.0, lines: [
      { id: "n44", who: "narr", text: "子どもたちが大人になる頃、／近所の人との雪かきが、当たり前の町に。", say: "子どもたちが大人になる頃、近所の人との雪かきが、当たり前の町に。" },
    ] },
    { id: "firstsnow", chapter: 4, lead: 0.6, tail: 0.9, lines: [
      { id: "n45", who: "narr", text: "11月8日、札幌に初雪。", say: "じゅういちがつようか、札幌に初雪。" },
      { id: "n46", who: "narr", text: "雪かきは、ここからです。", say: "雪かきは、ここからです。", gap: 0.4 },
    ] },
    { id: "end", chapter: 4, lead: 0.7, tail: 3.1, lines: [
      { id: "n47", who: "narr", text: "寒い冬は、くっついて乗り切る。", say: "寒い冬は、くっついて乗り切る。" },
      { id: "n48", who: "narr", text: "シマエナGO。", say: "シマエナゴー。", gap: 0.35 },
    ] },
  ],
};
