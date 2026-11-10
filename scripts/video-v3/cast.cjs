// 画面のコマ撮り（CDP の screencast）。スマホ幅 390×844 を 2倍（780×1688）の JPEG で受け取り、時刻つきで保存する。
// Playwright の recordVideo は 1Mbps の VP8 で文字がにじむので使わない。あとで 30fps の連番に並べ直す（toCfr）。
const fs = require("fs");
const path = require("path");

/** page の画面をコマ撮りする。stop() で終わり、{ frames:[{t,file}], seconds } を返す。t は start からの秒 */
async function startCast(page, dir, t0 = Date.now() / 1000) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  let n = 0;
  cdp.on("Page.screencastFrame", (ev) => {
    const t = (ev.metadata.timestamp ?? Date.now() / 1000) - t0;
    const file = `c${String(++n).padStart(5, "0")}.jpg`;
    fs.writeFileSync(path.join(dir, file), Buffer.from(ev.data, "base64"));
    frames.push({ t: +t.toFixed(4), file });
    cdp.send("Page.screencastFrameAck", { sessionId: ev.sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 93, everyNthFrame: 1 });
  return {
    t0,
    now: () => Date.now() / 1000 - t0,
    async stop() {
      const seconds = Date.now() / 1000 - t0;
      await cdp.send("Page.stopScreencast").catch(() => {});
      await cdp.detach().catch(() => {});
      return { frames, seconds: +seconds.toFixed(3) };
    },
  };
}

/** 時刻つきのコマを fps の連番（00001.jpg…）に並べ直す。同じ絵が続く所はハードリンクで増やす */
function toCfr(dir, frames, seconds, fps = 30) {
  const N = Math.max(1, Math.round(seconds * fps));
  let k = 0;
  for (let i = 0; i < N; i++) {
    const t = i / fps;
    while (k + 1 < frames.length && frames[k + 1].t <= t) k++;
    const dst = path.join(dir, String(i + 1).padStart(5, "0") + ".jpg");
    fs.rmSync(dst, { force: true });
    fs.linkSync(path.join(dir, frames[k].file), dst);
  }
  for (const f of frames) fs.rmSync(path.join(dir, f.file), { force: true });
  return N;
}

module.exports = { startCast, toCfr };
