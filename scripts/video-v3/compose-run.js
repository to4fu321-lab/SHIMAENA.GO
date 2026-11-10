// 場面を組み立てて、seek(t) で t 秒の絵を出す。render.cjs はこれを1コマずつ呼んでスクショする。
const stage = document.getElementById("stage");
const subEl = document.getElementById("sub"), subSpan = subEl.querySelector("span");
const chapEl = document.getElementById("chap"), chapName = chapEl.querySelector(".name"), chapDots = [...chapEl.querySelectorAll(".dots i")];
const CHAPTERS = ["", "課題", "デモ", "Claude の活用", "深さと、これから"];

// noSub = 画面の大きな文字がナレーションと同じ場面は、字幕を重ねない
// 場面ごとの見せ方: sub = 字幕の中心と幅（スマホの右に置く場面は右寄せ）、chap = 章のしるしの色（none で出さない）、fade = 入るときのクロスフェード（秒）
const CFG = {
  open: { fade: 0, chap: "none", noSub: true },
  car: { fade: 0.5, noSub: true },
  invisible: { fade: 0.5, noSub: true },
  numbers: { fade: 0.5 },
  key: { fade: 0.6, chap: "none", noSub: true },
  title: { fade: 0.25, chap: "none", sub: { light: true } },
  ask: { fade: 0.45, sub: { cx: 1290, w: 1120 } },
  ring: { fade: 0.4 },
  commander: { fade: 0.4, sub: { cx: 1290, w: 1120 } },
  go: { fade: 0.4, sub: { cx: 1290, w: 1120 } },
  finish: { fade: 0.4, sub: { cx: 1290, w: 1120 } },
  card: { fade: 0.4, sub: { cx: 1290, w: 1120 } },
  thanks: { fade: 0.5, noSub: true },
  voice: { fade: 0.6, noSub: true },
  principle: { fade: 0.6, noSub: true },
  more: { fade: 0.45 },
  maker: { fade: 0.5, sub: { cx: 1290, w: 1140 } },
  loop: { fade: 0.45 },
  feedback: { fade: 0.45 },
  models: { fade: 0.45 },
  depth: { fade: 0.45 },
  next: { fade: 0.45 },
  future: { fade: 0.7, sub: { light: true } },
  firstsnow: { fade: 0.7, chap: "none", noSub: true },
  end: { fade: 0.7, chap: "none", noSub: true },
};

const built = TL.scenes.map((s) => {
  const root = document.createElement("div");
  root.className = "scene";
  root.dataset.id = s.id;
  stage.insertBefore(root, chapEl);
  const make = SC[s.id];
  const update = make ? make(root, s, helpers(s)) : () => {};
  return { s, root, update, cfg: CFG[s.id] || {} };
});

async function seek(t) {
  t = clamp(t, 0, TL.seconds - 0.001);
  let active = null;
  built.forEach((b, i) => {
    const { s, root, cfg } = b;
    const next = built[i + 1];
    const nextFade = next ? next.cfg.fade ?? 0.35 : 0;
    // 自分の時間のあいだ、または次の場面がクロスフェードで入ってくるあいだは残る
    const on = t >= s.start && t < s.end + (next ? nextFade : 0);
    root.style.display = on ? "block" : "none";
    if (!on) return;
    const fade = cfg.fade ?? 0.35;
    root.style.opacity = i > 0 && fade > 0 ? clamp((t - s.start) / fade) : 1;
    root.style.zIndex = i + 1;
    b.update(t - s.start, t);
    if (t >= s.start && t < s.end) active = b;
  });
  // 字幕
  let line = null;
  for (const b of built) for (const l of b.s.lines) if (t >= l.at - 0.06 && t < l.at + l.dur + 0.22) line = l;
  if (line && active && !active.cfg.noSub) {
    const sub = active.cfg.sub || {};
    const cx = sub.cx ?? 960, w = sub.w ?? 1640;
    subEl.style.display = "block";
    subEl.style.left = cx - w / 2 + "px"; subEl.style.width = w + "px";
    const html = line.text.split("／").join("<br>");
    if (subSpan.dataset.h !== html) { subSpan.innerHTML = html; subSpan.dataset.h = html; }
    subEl.className = (sub.light ? "light " : "") + (line.who === "grand" ? "grand " : "") + (line.text.includes("／") ? "two" : "");
    subEl.style.opacity = clamp((t - (line.at - 0.06)) / 0.12) * clamp((line.at + line.dur + 0.22 - t) / 0.15);
  } else subEl.style.display = "none";
  // 章のしるし
  if (active && active.cfg.chap !== "none") {
    chapEl.style.display = "flex";
    chapEl.className = active.cfg.chap === "dark" ? "dark" : "";
    chapName.textContent = CHAPTERS[active.s.chapter];
    chapDots.forEach((d, i) => d.classList.toggle("on", i < active.s.chapter));
    chapEl.style.opacity = clamp((t - active.s.start) / 0.4);
  } else chapEl.style.display = "none";
  if (PENDING.length) { await Promise.all(PENDING.splice(0)); }
}
window.seek = seek;

// ---- 手で確かめる用（?render=1 のときは出さない）----
const params = new URLSearchParams(location.search);
const ctrl = document.getElementById("ctrl"), pos = document.getElementById("pos"), tt = document.getElementById("tt");
pos.max = TL.seconds;
if (params.get("render")) ctrl.style.display = "none";
else {
  let playing = false, t0 = 0, p0 = 0;
  const tick = () => { if (!playing) return; const t = p0 + (performance.now() - t0) / 1000; pos.value = t; tt.textContent = t.toFixed(1); seek(t); if (t < TL.seconds) requestAnimationFrame(tick); else playing = false; };
  document.getElementById("play").onclick = () => { playing = !playing; t0 = performance.now(); p0 = +pos.value; if (playing) tick(); };
  pos.oninput = () => { tt.textContent = (+pos.value).toFixed(1); seek(+pos.value); };
}
seek(+(params.get("t") || 0));
