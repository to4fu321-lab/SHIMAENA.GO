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
  // 地図: act2-demo.js の mapPts と同じ（完了した瞬間を、等しい間隔に並べる）
  const dones = Object.keys(REC.map.marks).filter((n) => /^done/.test(n)).map((n) => mk("map", n)).sort((a, b) => a - b);
  const t1 = T("map") + 1.1, step = (T("finish") - 1.5 - t1) / dones.length;
  return {
    TL, T, E, L, LE,
    land: T("hello") + 1.55,
    askTaps: ["omakase", "genkan"].map((n) => inv(ask, mk("ask", n))),
    arrive: [c17 + 0.3, c17 + 0.58, c17 + 0.86],
    goTap: T("go") + 0.85,
    done: dones.map((_, i) => t1 + i * step + step * 0.25 + (step * 0.75) * (0.5 / 1.4)),
    finTap: c22 + 1.0, shutter: c22 + 1.45, checks: [c22 + 3.6, c22 + 4.1], clear: c23 - 0.3,
    cardTap: T("card") + 0.9,
  };
};
