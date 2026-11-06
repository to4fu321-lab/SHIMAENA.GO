// テストモードの結果を、スマホで読める1枚の HTML にする（npm run sim で書き出す）。
// <html>・<body> は付けない（Artifact で公開するときに外側が付く。ブラウザで直接開いても表示できる）。
import type { SimReport } from "./run";
import { getTeam } from "../teams";
import type { TeamId } from "../types";

const esc = (s: string | number) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const dataUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

const AREA: Record<string, string> = { entrance: "玄関まで", garage: "車庫まで", road: "道路まで" };
const STATUS: Record<string, string> = { done: "クリア", short: "人手不足", assigned: "そろった", in_progress: "作業中", open: "待ち", no_answer: "返事なし" };

const CSS = `
/* 雪の朝の作業日誌: 上に結果、下へ時間の順。紺の夜明けと雪の白、チーム色は札にだけ */
:root {
  --bg: #f3f6fa; --paper: #ffffff; --ink: #172235; --muted: #5b6b82; --line: #d8e0ea;
  --accent: #1f4f8f; --ok: #1d7a4a; --ng: #b3261e; --okbg: #e3f3ea; --ngbg: #fbe7e5;
  --display: "Zen Maru Gothic", "Hiragino Maru Gothic ProN", "BIZ UDPGothic", sans-serif;
  --body: "BIZ UDPGothic", "Hiragino Sans", "Noto Sans JP", sans-serif;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #0e1522; --paper: #162133; --ink: #e6edf7; --muted: #9aaac0; --line: #2a3a52;
  --accent: #8fb8ee; --ok: #6fd39c; --ng: #ff8c82; --okbg: #15362a; --ngbg: #3d1d1b; color-scheme: dark } }
:root[data-theme="dark"] {
  --bg: #0e1522; --paper: #162133; --ink: #e6edf7; --muted: #9aaac0; --line: #2a3a52;
  --accent: #8fb8ee; --ok: #6fd39c; --ng: #ff8c82; --okbg: #15362a; --ngbg: #3d1d1b; color-scheme: dark }
body { background: var(--bg); color: var(--ink); font-family: var(--body); font-size: 16px; line-height: 1.6; }
.wrap { max-width: 760px; margin: 0 auto; padding-block: 24px 48px;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px));
  display: grid; gap: 28px; }
h1, h2 { font-family: var(--display); text-wrap: balance; margin: 0; }
h1 { font-size: 1.7rem; line-height: 1.3; }
h2 { font-size: 1.2rem; }
section { display: grid; gap: 12px; min-width: 0; }
.eyebrow { font-size: .8rem; letter-spacing: .08em; color: var(--muted); }
.lead { color: var(--muted); margin: 0; }
.verdict { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 12px; font-weight: 700; font-size: 1.05rem; }
.verdict.ok { background: var(--okbg); color: var(--ok); }
.verdict.ng { background: var(--ngbg); color: var(--ng); }
.nums { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.num { background: var(--paper); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; }
.num b { display: block; font-family: var(--display); font-size: 1.6rem; font-variant-numeric: tabular-nums; }
.num span { font-size: .8rem; color: var(--muted); }
@media (max-width: 520px) { .nums { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
ul.checks { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
ul.checks li { display: grid; grid-template-columns: 2.2em 1fr; gap: 8px; align-items: start; background: var(--paper); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; }
.mark { font-weight: 700; text-align: center; border-radius: 6px; font-size: .85rem; padding: 2px 0; }
.mark.ok { background: var(--okbg); color: var(--ok); } .mark.ng { background: var(--ngbg); color: var(--ng); }
.sub { display: block; font-size: .85rem; color: var(--muted); }
.scroll { overflow-x: auto; border: 1px solid var(--line); border-radius: 10px; background: var(--paper); }
table { border-collapse: collapse; width: 100%; font-size: .9rem; }
th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
th { font-size: .78rem; color: var(--muted); font-weight: 700; letter-spacing: .04em; white-space: nowrap; }
tr:last-child td { border-bottom: 0; }
td.t { font-variant-numeric: tabular-nums; white-space: nowrap; color: var(--muted); }
.chip { display: inline-block; font-size: .78rem; padding: 0 8px; border-radius: 999px; color: #fff; font-weight: 700; white-space: nowrap; }
.pill { display: inline-block; font-size: .78rem; padding: 0 8px; border-radius: 999px; background: var(--okbg); color: var(--ok); font-weight: 700; white-space: nowrap; }
details { background: var(--paper); border: 1px solid var(--line); border-radius: 10px; }
summary { cursor: pointer; padding: 10px 12px; font-weight: 700; }
summary:focus-visible, a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
details > .inner { padding: 0 12px 12px; }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
figure { margin: 0; display: grid; gap: 4px; min-width: 0; }
figure img { width: 100%; height: auto; border-radius: 8px; border: 1px solid var(--line); background: var(--paper); }
figcaption { font-size: .8rem; color: var(--muted); }
figcaption b { color: var(--ink); }
.back { display: none; } .flip:checked ~ .cards .front { display: none; } .flip:checked ~ .cards .back { display: block; }
label.toggle { display: inline-flex; gap: 8px; align-items: center; font-size: .9rem; cursor: pointer; }
.log { font-size: .85rem; color: var(--muted); margin: 0; padding-left: 1.2em; }
`;

export function renderReport(r: SimReport): string {
  const allOk = r.checks.every((c) => c.ok);
  const passed = r.checks.filter((c) => c.ok).length;
  const teamChip = (name: string) => {
    const t = (["salvia", "marigold", "lupinus"] as TeamId[]).map(getTeam).find((x) => x.name === name);
    return `<span class="chip" style="background:${t?.color ?? "#667"}">${esc(name)}</span>`;
  };
  const cleared = r.missions.filter((m) => m.status === "done").length;
  const totalPts = Object.values(r.teamTotals).reduce((a, b) => a + b, 0);

  return `<title>シマエナGO テスト走行</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=BIZ+UDPGothic:wght@400;700&family=Zen+Maru+Gothic:wght@700&display=swap">
<style>${CSS}</style>
<main class="wrap">
  <header style="display:grid;gap:8px">
    <span class="eyebrow">テストモード ・ ${esc(r.date)} の朝（予報 14cm）</span>
    <h1>AI参加者 20 人で、依頼 10 件の雪かきを走らせた記録</h1>
    <p class="lead">本物のアプリの処理（点呼・作戦・「行く」・完了写真・カード発行）を、人の代わりに AI 参加者が性格どおりに押しました。保存はテスト用のメモリだけで、本番のデータには触れていません。</p>
  </header>

  <div class="verdict ${allOk ? "ok" : "ng"}">${allOk ? "✓ 合格" : "✕ 不合格あり"} ・ ${passed} / ${r.checks.length} 項目</div>

  <div class="nums">
    <div class="num"><b>${r.helpers.length}</b><span>AI参加者</span></div>
    <div class="num"><b>${cleared}/${r.missions.length}</b><span>クリアした家</span></div>
    <div class="num"><b>${r.cards.length}</b><span>発行したカード</span></div>
    <div class="num"><b>${totalPts}</b><span>チームの点（合計）</span></div>
  </div>

  <section>
    <h2>確かめたこと</h2>
    <ul class="checks">${r.checks
      .map((c) => `<li><span class="mark ${c.ok ? "ok" : "ng"}">${c.ok ? "OK" : "NG"}</span><span>${esc(c.name)}<span class="sub">${esc(c.detail)}</span></span></li>`)
      .join("")}</ul>
  </section>

  <section>
    <h2>発行されたイラストカード（${r.cards.length} 枚）</h2>
    <p class="lead">家ごとに、来た人の数だけ同じ絵のカードが出ます。番号は朝の通し番号です。</p>
    <input type="checkbox" id="flip" class="flip" hidden>
    <label class="toggle" for="flip">▶ 裏面に切りかえる（タップ）</label>
    <div class="cards">${r.cards
      .map(
        (c) => `<figure><img class="front" src="${dataUri(c.svg)}" alt="${esc(c.card.designName)} の表" loading="lazy"><img class="back" src="${dataUri(c.backSvg)}" alt="${esc(c.card.designName)} の裏" loading="lazy">
      <figcaption><b>No.${c.card.serial}</b> ${esc(c.recipient)} ・ ${"★".repeat(c.card.stars)}<br>${esc(c.card.designName)}<br>${c.delivered ? "隊長トークに届いた" : "届いていない"}</figcaption></figure>`,
      )
      .join("")}</div>
  </section>

  <section>
    <h2>10 軒の結果</h2>
    <div class="scroll"><table>
      <thead><tr><th>拠点</th><th>頼んだ人</th><th>結果</th><th>来た人</th><th>司令官の理由</th></tr></thead>
      <tbody>${r.missions
        .map(
          (m) =>
            `<tr><td class="t">${m.number}</td><td>${esc(m.requester)}</td><td><span class="pill">${esc(STATUS[m.status] ?? m.status)}</span></td><td>${m.members.map(esc).join("・")}<span class="sub">${m.members.length}/${m.required} 人</span></td><td>${esc(m.reason)}</td></tr>`,
        )
        .join("")}</tbody>
    </table></div>
  </section>

  <section>
    <h2>朝の流れ（${r.steps.length} 手）</h2>
    <p class="lead">AI 参加者が押したボタンと、アプリの返事です。</p>
    <div class="scroll"><table>
      <thead><tr><th>時刻</th><th>だれが</th><th>したこと</th><th>アプリの返事</th></tr></thead>
      <tbody>${r.steps
        .map((s) => `<tr><td class="t">${esc(s.at)}</td><td>${esc(s.who)}</td><td>${esc(s.what)}</td><td>${esc(s.result)}</td></tr>`)
        .join("")}</tbody>
    </table></div>
  </section>

  <section>
    <h2>テストの町</h2>
    <details><summary>AI参加者 20 人（チームと性格）</summary><div class="inner scroll" style="border:0"><table>
      <thead><tr><th>呼び名</th><th>チーム</th><th>性格（動き方）</th></tr></thead>
      <tbody>${r.helpers.map((h) => `<tr><td>${esc(h.nickname)}</td><td>${teamChip(h.team)}</td><td>${esc(h.persona)}</td></tr>`).join("")}</tbody>
    </table></div></details>
    <details><summary>頼む家 10 軒（事前登録）</summary><div class="inner scroll" style="border:0"><table>
      <thead><tr><th>呼び名</th><th>レベル</th><th>どこまで</th><th>頼み方</th></tr></thead>
      <tbody>${r.requesters.map((p) => `<tr><td>${esc(p.nickname)}</td><td class="t">${p.level}</td><td>${esc(AREA[p.area] ?? p.area)}</td><td>${esc(p.style)}</td></tr>`).join("")}</tbody>
    </table></div></details>
    <details><summary>アプリの記録（/admin に出るログ）</summary><div class="inner"><ol class="log">${r.log.map((l) => `<li>${esc(l)}</li>`).join("")}</ol></div></details>
  </section>
</main>`;
}
