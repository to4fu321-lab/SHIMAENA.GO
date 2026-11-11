// 絵（act*.js）と音（score.cjs）で同じ瞬間を使うための、時間の計算。時間割（timeline.json）と録画の印（rec/scenes.json）から出す。
const fs = require("fs");
const path = require("path");
module.exports = function cues(V) {
  const TL = JSON.parse(fs.readFileSync(path.join(V, "timeline.json"), "utf8"));
  const REC = JSON.parse(fs.readFileSync(path.join(V, "rec/scenes.json"), "utf8"));
  const SC = Object.fromEntries(TL.scenes.map((s) => [s.id, s])), LN = {};
  for (const s of TL.scenes) for (const l of s.lines) LN[l.id] = l;
  const T = (id) => SC[id].start, E = (id) => SC[id].end, L = (id) => LN[id].at, LE = (id) => LN[id].end;
  const mk = (r, n) => REC[r].marks[n].t;
  /** 録画の秒 → 動画の秒（act2-demo.js と同じ折れ線の逆） */
  const inv = (pts, r) => { for (let i = 1; i < pts.length; i++) if (r <= pts[i][1]) { const [a, ra] = pts[i - 1], [b, rb] = pts[i]; return a + ((r - ra) / (rb - ra)) * (b - a); } return pts[pts.length - 1][0]; };
  const c17 = L("c17"), c22 = L("c22"), c23 = L("c23");
  const ask = [[T("ask"), 0.6], [T("ring"), 7.0]];
  const ring = [[T("ring"), 0.2], [c17 + 0.15, 3.9], [c17 + 0.6, 4.4], [c17 + 1.4, 7.9], [T("reason"), 11.9]];
  const map = [[T("map"), 2.2], [L("c20") + 1.4, 5.7], [T("finish"), 28.6]];
  return {
    TL, T, E, L, LE,
    land: T("hello") + 1.55,
    askTaps: ["omakase", "genkan"].map((n) => inv(ask, mk("ask", n))),
    arrive: [inv(ring, mk("ring", "arrive-b")), inv(ring, mk("ring", "arrive-a"))],
    goTap: T("go") + 0.85,
    done: [1, 2, 3, 4, 5, 6].map((i) => inv(map, mk("map", "done" + i))),
    finTap: c22 + 1.0, shutter: c22 + 1.45, checks: [c22 + 3.6, c22 + 4.1], clear: c23 - 0.3,
    cardTap: T("card") + 0.9,
    // ドンッ、と置く瞬間（数字2つ・決まり3つ）と、ほかの入口3つの切りかわり
    slams: [L("c09") + 0.9, L("c10") + 0.1],
    rules: [0, 0.38, 0.68].map((k) => L("c36") + (LE("c36") - L("c36")) * k - 0.05),
    more: [T("more"), L("c52") - 0.15, L("c53") - 0.15],
    sparkHalf: L("c11") + (LE("c11") - L("c11")) * 0.5,
  };
};
