// 時計をずらす（撮影用）。サーバー（next start）を `NODE_OPTIONS=--require …/timeshift.cjs` で起動すると、
// Date が TIMESHIFT_FILE に書いたミリ秒だけ進む。雪の朝（12/14 6:30）の画面を、いつ撮っても同じに録るため。
// ファイルを書きかえると 0.25 秒以内に追いつくので、場面のあいだに時計を進められる。
const fs = require("fs");
const RealDate = Date;
const file = process.env.TIMESHIFT_FILE;
let off = 0, last = 0;
function offset() {
  const now = RealDate.now();
  if (file && now - last > 250) { last = now; try { off = Number(fs.readFileSync(file, "utf8")) || 0; } catch { /* まだない */ } }
  return off;
}
globalThis.Date = new Proxy(RealDate, {
  construct(target, args) { return args.length ? new target(...args) : new target(target.now() + offset()); },
  apply() { return new RealDate(RealDate.now() + offset()).toString(); },
  get(target, prop) { return prop === "now" ? () => target.now() + offset() : Reflect.get(target, prop); },
});
