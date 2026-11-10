// 合成ページの土台: 時間の道具・雪・シマエナ隊長・スマホ（録画のコマを映す）・拡大レンズ・字幕（隊長の吹き出し）。
// 場面は act*.js が ACTS.push({ from, to, make(root) → update(t) }) の形で登録し、run.js が seek(t) で動かす。
const TL = window.TL, REC = window.REC || {}, FPS = TL.fps;
const SC = Object.fromEntries(TL.scenes.map((s) => [s.id, s]));
const LN = {};
for (const s of TL.scenes) for (const l of s.lines) LN[l.id] = l;
/** 場面の頭・終わり、行の頭・終わり（秒） */
const T = (id) => SC[id].start, E = (id) => SC[id].end, L = (id) => LN[id].at, LE = (id) => LN[id].end;
const RECDIR = "../../.video/v4/rec/";
const ASSET = { park: "../../docs/video/ref-park.jpg", before: "../../public/demo/entrance-before.jpg", after: "../../public/demo/entrance.jpg", qr: "../../.video/v4/qr.svg" };
const ACTS = [];
const PENDING = [];

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const Ease = {
  lin: (k) => clamp(k),
  out: (k) => 1 - Math.pow(1 - clamp(k), 3),
  out5: (k) => 1 - Math.pow(1 - clamp(k), 5),
  in: (k) => Math.pow(clamp(k), 3),
  io: (k) => { k = clamp(k); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; },
  back: (k) => { k = clamp(k); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); },
};
/** t0 から d 秒で 0→1 */
const pr = (t, t0, d = 0.5, e = Ease.out) => e((t - t0) / d);
/** a〜b で出て、c〜d で消える（0〜1） */
const win = (t, a, b, c = 1e9, d = 1e9 + 1) => Math.min(clamp((t - a) / Math.max(0.001, b - a)), 1 - clamp((t - c) / Math.max(0.001, d - c)));
/** 折れ線で値をつなぐ: pts = [[t, v], …] */
function kf(t, pts, e = Ease.io) {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) { const [a, va] = pts[i - 1], [b, vb] = pts[i]; return lerp(va, vb, e((t - a) / Math.max(0.001, b - a))); }
  return pts[pts.length - 1][1];
}
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mixc = (a, b, k) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], clamp(k)))).join(",")})`; };
const $ = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** 出入り: tIn で下から浮かんで出る。out があれば消える。返り値は出具合（0〜1） */
function show(el, t, tIn, o = {}) {
  const { dy = 26, dx = 0, d = 0.55, out, dOut = 0.35, scale, ease = Ease.out, base = "" } = o;
  const k = pr(t, tIn, d, ease);
  const op = clamp((t - tIn) / (d * 0.6)) * (out != null ? 1 - clamp((t - out) / dOut) : 1);
  el.style.opacity = op;
  el.style.transform = `${base} translate(${(1 - k) * dx}px,${(1 - k) * dy}px) scale(${scale != null ? lerp(scale, 1, k) : 1})`;
  return op;
}

// ---- 雪（canvas。決まった乱数で、何度描いても同じ）----
function snow(seed, n, o = {}) {
  const c = document.createElement("canvas"); c.className = "snow"; c.width = 1920; c.height = 1080;
  const g = c.getContext("2d"), r = rng(seed);
  const fl = Array.from({ length: n }, () => { const s = (o.min ?? 1.6) + r() * (o.size ?? 4.2); return { x: r() * 1920, y: r() * 1080, s, v: 34 + r() * 50 + s * 9, w: 10 + r() * 22, p: r() * 6.28, a: 0.35 + r() * 0.55 }; });
  c.update = (t, alpha = 1) => {
    g.clearRect(0, 0, 1920, 1080);
    if (alpha <= 0.01) return;
    g.fillStyle = o.color || "#fff";
    for (const f of fl) {
      const y = ((f.y + t * f.v * (o.speed ?? 1)) % 1110) - 15, x = (((f.x + Math.sin(t * 0.7 + f.p) * f.w + t * (o.drift ?? 14)) % 1920) + 1920) % 1920;
      g.globalAlpha = f.a * alpha; g.beginPath(); g.arc(x, y, f.s, 0, 6.2832); g.fill();
    }
  };
  return c;
}

// ---- シマエナガ（lib/mascot-svg.ts と同じ絵）----
const SCARF = {
  lamp: { color: "#e8834f", shade: "#d06d3b", light: "#f6a57a" },
  salvia: { color: "#2F6FE4", shade: "#2457b5", light: "#7fa6f0" },
  marigold: { color: "#FF8A3D", shade: "#d9702c", light: "#ffb784" },
  lupinus: { color: "#9B5DE5", shade: "#7a44bd", light: "#c39bf0" },
  ice: { color: "#5fa9c4", shade: "#468aa3", light: "#a5d3e3" },
};
function mascotInner(scarf = SCARF.lamp, mood = "normal") {
  const eyes = mood === "happy"
    ? `<path d="M40 54 Q45 48 50 54" fill="none" stroke="#1d2f40" stroke-width="3.4" stroke-linecap="round"/><path d="M70 54 Q75 48 80 54" fill="none" stroke="#1d2f40" stroke-width="3.4" stroke-linecap="round"/>`
    : mood === "sleep"
      ? `<path d="M40 53 Q45 58 50 53" fill="none" stroke="#1d2f40" stroke-width="3.2" stroke-linecap="round"/><path d="M70 53 Q75 58 80 53" fill="none" stroke="#1d2f40" stroke-width="3.2" stroke-linecap="round"/>`
      : `<circle cx="45" cy="54" r="4.6" fill="#1d2f40"/><circle cx="75" cy="54" r="4.6" fill="#1d2f40"/><circle cx="46.4" cy="52.6" r="1.4" fill="#fff"/><circle cx="76.4" cy="52.6" r="1.4" fill="#fff"/>`;
  return `<path d="M96 70 L116 62 L112 78 Z" fill="#29445c"/><ellipse cx="60" cy="64" rx="44" ry="42" fill="#ffffff" stroke="#dbe6ee" stroke-width="2"/><path d="M88 52 C104 62 104 86 86 96 C90 82 88 66 80 56 Z" fill="#29445c"/><path d="M32 56 C20 66 22 84 34 92 C32 80 34 66 40 58 Z" fill="#3b6584"/>${eyes}<path class="beak" d="M56 60 L64 60 L60 66 Z" fill="#1d2f40"/><ellipse cx="36" cy="64" rx="6" ry="3.6" fill="#f2b8bf" opacity="0.8"/><ellipse cx="84" cy="64" rx="6" ry="3.6" fill="#f2b8bf" opacity="0.8"/><path d="M22 76 C40 88 80 88 98 76 L98 86 C80 98 40 98 22 86 Z" fill="${scarf.color}"/><path d="M70 88 L78 112 L90 108 L84 86 Z" fill="${scarf.shade}"/><path d="M26 80 C42 90 78 90 94 80" fill="none" stroke="${scarf.light}" stroke-width="2"/>`;
}
const mascot = (scarf, size = 200, mood = "normal") => `<svg viewBox="0 0 120 120" width="${size}" height="${size}" style="display:block;overflow:visible">${mascotInner(scarf, mood)}</svg>`;
/** 気分を切りかえられる隊長（el.mood("happy")）。帽子つき（隊長のしるし） */
function captain(size = 200, scarf = SCARF.lamp) {
  const el = $(`<div class="abs" style="width:${size}px;height:${size}px;transform-origin:50% 88%"></div>`);
  const hat = `<g transform="translate(60 26)"><path d="M-30 4 C-28 -16 28 -16 30 4 Z" fill="#29445c"/><path d="M-34 4 Q0 12 34 4 L36 9 Q0 18 -36 9 Z" fill="#1e3346"/><circle cx="0" cy="-5" r="5" fill="#f2c14e"/></g>`;
  let cur = "";
  el.mood = (m) => { if (m === cur) return; cur = m; el.innerHTML = `<svg viewBox="0 0 120 120" width="${size}" height="${size}" style="display:block;overflow:visible">${mascotInner(scarf, m)}${hat}</svg>`; };
  el.mood("normal");
  return el;
}
/** Claude のしるし（放射の星） */
const SPARK = (c = "#e8834f", s = 40) => `<svg viewBox="0 0 40 40" width="${s}" height="${s}" style="display:inline-block;vertical-align:middle"><g stroke="${c}" stroke-width="4.6" stroke-linecap="round">${[0, 30, 60, 90, 120, 150].map((a) => `<line x1="20" y1="4" x2="20" y2="36" transform="rotate(${a} 20 20)"/>`).join("")}</g></svg>`;

// ---- 録画のコマ ----
const pad5 = (n) => String(n).padStart(5, "0");
function setFrame(img, dir, frames, recT) {
  const i = clamp(Math.round(recT * FPS) + 1, 1, frames);
  if (img._i === i) return;
  img._i = i; img.src = RECDIR + dir + "/" + pad5(i) + ".jpg";
  PENDING.push(img.decode().catch(() => {}));
}
/**
 * スマホ。rec = 録画の場面の名前、key = その中のスマホ（a/b/c）。w = 外枠の幅。
 * el.at(x, y, {scale, op})／el.frame(recT)（指の印も出る）
 */
function phone(rec, key, o = {}) {
  const w = o.w ?? 372, sw = w - 20, sh = Math.round((sw * 844) / 390), h = sh + 20, k = sw / 390;
  const info = REC[rec], ph = info.phones[key];
  const el = $(`<div class="ph" style="width:${w}px;height:${h}px"><div class="ph-label" style="${o.labelColor ? "color:" + o.labelColor : ""}">${o.label || ""}</div><div class="ph-scr"><img></div><div class="ph-ripple"></div><div class="ph-finger"></div></div>`);
  const img = el.querySelector("img"), fin = el.querySelector(".ph-finger"), rip = el.querySelector(".ph-ripple");
  const taps = Object.values(info.marks).filter((m) => m.tap && m.x != null && (m.phone ?? Object.keys(info.phones)[0]) === key);
  el.w = w; el.h = h;
  el.at = (x, y, p = {}) => { el.style.left = x + "px"; el.style.top = y + "px"; el.style.opacity = p.op ?? 1; el.style.transform = `scale(${p.scale ?? 1}) rotate(${p.rot ?? 0}deg)`; };
  el.frame = (recT) => {
    setFrame(img, ph.dir, ph.frames, recT);
    let f = 0, r = 0, rs = 1, fx = 0, fy = 0;
    for (const m of taps) {
      const dt = recT - m.t;
      if (dt > -0.5 && dt < 0.7) { fx = 10 + m.x * k; fy = 10 + m.y * k; f = win(dt, -0.5, -0.3, 0.25, 0.45); if (dt >= 0) { r = 1 - clamp(dt / 0.6); rs = 0.5 + dt * 2.4; } }
    }
    fin.style.opacity = f; fin.style.left = rip.style.left = fx + "px"; fin.style.top = rip.style.top = fy + "px";
    fin.style.transform = `scale(${f ? 1.25 - 0.25 * f : 1})`;
    rip.style.opacity = r; rip.style.transform = `scale(${rs})`;
  };
  return el;
}
/** 拡大レンズ: 録画の一部（region = {x,y,w,h}。390×844 の座標）を box の幅に広げて映す */
function lens(rec, key, region, boxW) {
  const ph = REC[rec].phones[key], s = boxW / region.w;
  const el = $(`<div class="lens" style="width:${boxW}px;height:${Math.round(region.h * s)}px"><img style="width:${390 * s}px;height:${844 * s}px;left:${-region.x * s}px;top:${-region.y * s}px"></div>`);
  const img = el.querySelector("img");
  el.frame = (recT) => setFrame(img, ph.dir, ph.frames, recT);
  el.at = (x, y, p = {}) => { el.style.left = x + "px"; el.style.top = y + "px"; el.style.opacity = p.op ?? 1; el.style.transform = `scale(${p.scale ?? 1})`; };
  return el;
}
/** 録画の印（秒） */
const mk = (rec, name) => REC[rec].marks[name].t;

// ---- 字幕（隊長の吹き出し）----
const subEl = document.getElementById("sub"), bubEl = document.getElementById("bub"), avaEl = document.getElementById("ava"), noteEl = document.getElementById("note");
avaEl.innerHTML = captain(112).innerHTML;
const ALL_LINES = TL.scenes.flatMap((s) => s.lines);
let subId = null;
function subtitle(t, o = {}) {
  const l = ALL_LINES.find((l) => t >= l.at - 0.12 && t < l.end + 0.3);
  if (!l || o.hide) { subEl.style.opacity = 0; subId = null; return; }
  if (subId !== l.id) { subId = l.id; bubEl.innerHTML = l.text.replace(/\n/g, "<br>"); }
  subEl.style.opacity = win(t, l.at - 0.12, l.at + 0.06, l.end + 0.12, l.end + 0.3);
  subEl.classList.toggle("noava", !!o.noAva);
  avaEl.style.display = o.noAva ? "none" : "block";
  // しゃべる動き: 声の大きさで体がはずむ
  const f = Math.round(t * FPS), e = (TL.env[f - 1] + TL.env[f] * 2 + (TL.env[f + 1] ?? 0)) / 4 || 0;
  avaEl.style.transform = `translateY(${-e * 9}px) rotate(${Math.sin(t * 7) * e * 5}deg) scale(${1 + e * 0.05},${1 - e * 0.04})`;
}
