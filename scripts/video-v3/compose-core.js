// 合成ページの土台: 時間の道具・雪・シマエナガ・人物・スマホ（録画のコマを映す）・拡大レンズ。
// 場面は compose-s1〜s4.js が SC.<場面id> = (root, s, H) => update(lt) の形で登録し、compose-run.js が seek(t) で動かす。
const TL = window.TL;
const FPS = TL.fps;
const EDIT = window.buildEdit(TL);
const REC = "../../.video/v3/rec/";
const A = {
  street: "../../docs/video/ref-street.jpg",
  park: "../../docs/video/ref-park.jpg",
  before: "../../public/demo/entrance-before.jpg",
  after: "../../public/demo/entrance.jpg",
  screens: "../../docs/screens/",
  qr: "../../.video/v3/qr.svg",
};
const PENDING = [];
const SC = {};

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const Ease = {
  lin: (k) => clamp(k),
  out: (k) => 1 - Math.pow(1 - clamp(k), 3),
  out5: (k) => 1 - Math.pow(1 - clamp(k), 5),
  io: (k) => { k = clamp(k); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; },
  back: (k) => { k = clamp(k); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); },
};
/** t0 から d 秒で 0→1 */
const pr = (t, t0, d = 0.5, e = Ease.out) => e((t - t0) / d);
const $ = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/**
 * 出入り: tIn で下から浮かんで出る。tOut があれば消える。opts: dy（動く幅）・d（かかる秒）・dx・scale（出るときの大きさ）・rot
 * 返り値は出具合（0〜1）
 */
function show(el, lt, tIn, opts = {}) {
  const { dy = 28, dx = 0, d = 0.55, out, dOut = 0.35, scale, ease = Ease.out, base = "" } = opts;
  const k = pr(lt, tIn, d, ease);
  const o = out != null ? 1 - pr(lt, out, dOut, Ease.lin) : 1;
  el.style.opacity = clamp(Math.min(1, (lt - tIn) / (d * 0.6))) * o;
  const s = scale != null ? lerp(scale, 1, k) : 1;
  el.style.transform = `${base} translate(${(1 - k) * dx}px, ${(1 - k) * dy}px) scale(${s})`;
  return k * o;
}

// ---- 雪（決まった乱数で、何度描いても同じ）----
function snowLayer(seed, n, opts = {}) {
  const r = rng(seed); const el = document.createElement("div"); el.className = "snowbg";
  const flakes = [];
  for (let i = 0; i < n; i++) {
    const f = document.createElement("div"); f.className = "flake";
    const s = (opts.min ?? 3) + r() * (opts.size ?? 7); f.style.width = f.style.height = s + "px"; f.style.opacity = (0.35 + r() * 0.5) * (opts.alpha ?? 1);
    if (opts.color) f.style.background = opts.color;
    if (opts.blur && s > 7) f.style.filter = "blur(1.5px)";
    el.append(f); flakes.push({ el: f, x: r() * 1920, y: r() * 1080, v: 30 + r() * 60 + s * 6, w: 10 + r() * 20, p: r() * 6.28 });
  }
  el.update = (t) => { for (const f of flakes) { const y = (f.y + t * f.v * (opts.speed ?? 1)) % 1100 - 10; const x = (f.x + Math.sin(t * 0.7 + f.p) * f.w + t * (opts.drift ?? 12)) % 1920; f.el.style.transform = `translate(${x}px,${y}px)`; } };
  return el;
}

// ---- シマエナガ（lib/mascot-svg.ts と同じ絵）----
const SCARF = { salvia: { color: "#2F6FE4", shade: "#2457b5", light: "#7fa6f0" }, marigold: { color: "#FF8A3D", shade: "#d9702c", light: "#ffb784" }, lupinus: { color: "#9B5DE5", shade: "#7a44bd", light: "#c39bf0" }, lamp: { color: "#e8834f", shade: "#d06d3b", light: "#f6a57a" } };
function mascot(scarf, size = 220, mood = "normal") {
  const eyes = mood === "happy"
    ? `<path d="M40 54 Q45 48 50 54" fill="none" stroke="#1d2f40" stroke-width="3.4" stroke-linecap="round"/><path d="M70 54 Q75 48 80 54" fill="none" stroke="#1d2f40" stroke-width="3.4" stroke-linecap="round"/>`
    : `<circle cx="45" cy="54" r="4.6" fill="#1d2f40"/><circle cx="75" cy="54" r="4.6" fill="#1d2f40"/><circle cx="46.4" cy="52.6" r="1.4" fill="#fff"/><circle cx="76.4" cy="52.6" r="1.4" fill="#fff"/>`;
  return `<svg viewBox="0 0 120 120" width="${size}" height="${size}"><path d="M96 70 L116 62 L112 78 Z" fill="#29445c"/><ellipse cx="60" cy="64" rx="44" ry="42" fill="#ffffff" stroke="#dbe6ee" stroke-width="2"/><path d="M88 52 C104 62 104 86 86 96 C90 82 88 66 80 56 Z" fill="#29445c"/><path d="M32 56 C20 66 22 84 34 92 C32 80 34 66 40 58 Z" fill="#3b6584"/>${eyes}<path d="M56 60 L64 60 L60 66 Z" fill="#1d2f40"/><ellipse cx="36" cy="64" rx="6" ry="3.6" fill="#f2b8bf" opacity="0.8"/><ellipse cx="84" cy="64" rx="6" ry="3.6" fill="#f2b8bf" opacity="0.8"/><path d="M22 76 C40 88 80 88 98 76 L98 86 C80 98 40 98 22 86 Z" fill="${scarf.color}"/><path d="M70 88 L78 112 L90 108 L84 86 Z" fill="${scarf.shade}"/><path d="M26 80 C42 90 78 90 94 80" fill="none" stroke="${scarf.light}" stroke-width="2"/></svg>`;
}
/** Claude のしるし（放射の星。色はアプリの灯りオレンジに合わせる） */
const SPARK = (c = "#fff") => `<svg class="spark" viewBox="0 0 40 40"><g stroke="${c}" stroke-width="4.6" stroke-linecap="round">${[0, 30, 60, 90, 120, 150].map((a) => `<line x1="20" y1="4" x2="20" y2="36" transform="rotate(${a} 20 20)"/>`).join("")}</g></svg>`;

// ---- 人物（丸くてやわらかい絵柄）。200×300 の枠。足の底が y=292 ----
// pose: shovel / back / cane / blower / wave / cup / push（両手で前へ押す）/ cheer（両手を上げる）/ stand
function person(o) {
  const { x = 0, y = 0, s = 1, flip = false, skin = "#f3d9c6", coat = "#29445c", pants = "#1e3346", hat = "#c0392b", hair = "#3b2a22", scarf = "#d9825b", boots = "#2a2a2a", mitt = "#c0392b", pose = "shovel", face = "smile", kind = "adult", id = "", lean = 0 } = o;
  const child = kind === "child", elder = kind === "elder";
  const H = child ? 0.8 : 1;
  const headR = child ? 40 : 34, headY = child ? 92 : 78;
  const bodyTop = headY + headR - 6, bodyBot = child ? 232 : 250;
  const legTop = bodyBot - 12;
  const headPart = () => {
    let top;
    if (elder) top = `<path d="M${100 - headR} ${headY - 4} Q100 ${headY - headR - 10} ${100 + headR} ${headY - 4} Q100 ${headY + 2} ${100 - headR} ${headY - 4}Z" fill="#d9d2cc"/><circle cx="${100 + headR - 8}" cy="${headY - headR + 6}" r="11" fill="#d9d2cc"/>`;
    else if (o.beanie === false) top = `<path d="M${100 - headR} ${headY} Q${100 - headR} ${headY - headR - 4} 100 ${headY - headR - 2} Q${100 + headR} ${headY - headR - 4} ${100 + headR} ${headY} Q${100 + headR - 6} ${headY - 10} 100 ${headY - 14} Q${100 - headR + 6} ${headY - 10} ${100 - headR} ${headY}Z" fill="${hair}"/>`;
    else top = `<path d="M${100 - headR - 2} ${headY - 2} Q100 ${headY - headR - 14} ${100 + headR + 2} ${headY - 2} L${100 + headR + 2} ${headY + 6} Q100 ${headY - 2} ${100 - headR - 2} ${headY + 6}Z" fill="${hat}"/><rect x="${100 - headR - 4}" y="${headY - 4}" width="${headR * 2 + 8}" height="14" rx="7" fill="${hat}" filter="brightness(.85)"/><circle cx="100" cy="${headY - headR - 10}" r="9" fill="#fff"/>`;
    const eyes = face === "happy"
      ? `<path d="M86 ${headY + 2} q6 -7 12 0" fill="none" stroke="#1d2f40" stroke-width="3.2" stroke-linecap="round"/><path d="M102 ${headY + 2} q6 -7 12 0" fill="none" stroke="#1d2f40" stroke-width="3.2" stroke-linecap="round"/>`
      : face === "tired"
        ? `<path d="M86 ${headY + 2} q6 4 12 0" fill="none" stroke="#1d2f40" stroke-width="3.2" stroke-linecap="round"/><path d="M102 ${headY + 2} q6 4 12 0" fill="none" stroke="#1d2f40" stroke-width="3.2" stroke-linecap="round"/>`
        : `<circle cx="91" cy="${headY + 2}" r="3.4" fill="#1d2f40"/><circle cx="109" cy="${headY + 2}" r="3.4" fill="#1d2f40"/>`;
    const mouth = face === "tired" ? `<path d="M95 ${headY + 16} q5 -4 10 0" fill="none" stroke="#1d2f40" stroke-width="2.6" stroke-linecap="round"/>` : face === "open" ? `<ellipse cx="100" cy="${headY + 16}" rx="5" ry="6" fill="#8f3a3a"/>` : `<path d="M94 ${headY + 14} q6 6 12 0" fill="none" stroke="#1d2f40" stroke-width="2.6" stroke-linecap="round"/>`;
    const glasses = elder ? `<circle cx="91" cy="${headY + 2}" r="8" fill="none" stroke="#5b4636" stroke-width="2"/><circle cx="109" cy="${headY + 2}" r="8" fill="none" stroke="#5b4636" stroke-width="2"/><path d="M99 ${headY + 2} h2" stroke="#5b4636" stroke-width="2"/>` : "";
    return `<circle cx="100" cy="${headY}" r="${headR}" fill="${skin}"/>${top}${eyes}${glasses}<ellipse cx="82" cy="${headY + 11}" rx="6" ry="3.6" fill="#f2b8bf" opacity=".8"/><ellipse cx="118" cy="${headY + 11}" rx="6" ry="3.6" fill="#f2b8bf" opacity=".8"/>${mouth}`;
  };
  const scarfPart = `<path d="M${100 - headR + 4} ${bodyTop + 2} Q100 ${bodyTop + 16} ${100 + headR - 4} ${bodyTop + 2} L${100 + headR - 2} ${bodyTop + 12} Q100 ${bodyTop + 28} ${100 - headR + 2} ${bodyTop + 12}Z" fill="${scarf}"/><path d="M${100 + headR - 14} ${bodyTop + 10} l14 30 l-16 6 l-10 -30Z" fill="${scarf}" filter="brightness(.85)"/>`;
  const body = `<path d="M${100 - 34 * H} ${bodyTop + 10} Q100 ${bodyTop - 4} ${100 + 34 * H} ${bodyTop + 10} L${100 + 46 * H} ${bodyBot} Q100 ${bodyBot + 14} ${100 - 46 * H} ${bodyBot}Z" fill="${coat}"/><path d="M${100 - 44 * H} ${bodyBot - 26} Q100 ${bodyBot - 16} ${100 + 44 * H} ${bodyBot - 26}" fill="none" stroke="rgba(0,0,0,.18)" stroke-width="5"/><circle cx="100" cy="${bodyTop + 40}" r="3.5" fill="rgba(255,255,255,.55)"/><circle cx="100" cy="${bodyTop + 62}" r="3.5" fill="rgba(255,255,255,.55)"/>`;
  const legs = `<rect x="${100 - 30 * H}" y="${legTop}" width="${26 * H + 2}" height="${292 - legTop - 16}" rx="10" fill="${pants}"/><rect x="${100 + 4 * H}" y="${legTop}" width="${26 * H + 2}" height="${292 - legTop - 16}" rx="10" fill="${pants}"/><rect x="${100 - 36 * H}" y="268" width="${34 * H + 4}" height="24" rx="10" fill="${boots}"/><rect x="${100 + 2 * H}" y="268" width="${34 * H + 4}" height="24" rx="10" fill="${boots}"/>`;
  const sh = bodyTop + 22;
  const arm = (d, mx, my) => `<path d="${d}" fill="none" stroke="${coat}" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${mx}" cy="${my}" r="12" fill="${mitt}"/>`;
  let arms = "", tool = "", extra = "", behind = "", front = "";
  if (pose === "shovel") {
    const shovel = (len = 180) => `<g transform="translate(176 ${sh - 6}) rotate(-42)"><rect x="-5.5" y="0" width="11" height="${len}" rx="5" fill="#8b5a2b"/><rect x="-14" y="-6" width="28" height="12" rx="6" fill="#8b5a2b"/><path d="M-27 ${len - 10} L27 ${len - 10} L21 ${len + 36} L-21 ${len + 36}Z" fill="#6b7f92"/><path d="M-27 ${len - 10} L27 ${len - 10} L25 ${len - 2} L-25 ${len - 2}Z" fill="#9fb0bf"/></g>`;
    arms = `<g class="arm">${shovel(child ? 130 : 180)}${arm(`M${100 + 26 * H} ${sh} Q180 ${sh + 4} 203 ${sh + 24}`, 203, sh + 24)}${arm(`M${100 - 6 * H} ${sh + 26} Q150 ${sh + 90} 243 ${sh + 68}`, 243, sh + 68)}</g>`;
  } else if (pose === "back") {
    behind = arm(`M${100 + 28 * H} ${sh} Q${100 + 78 * H} ${sh + 40} ${100 + 30 * H} ${bodyBot - 30}`, 100 + 24 * H, bodyBot - 30) + arm(`M${100 - 28 * H} ${sh} Q${100 - 78 * H} ${sh + 40} ${100 - 30 * H} ${bodyBot - 30}`, 100 - 24 * H, bodyBot - 30);
    front = `<circle cx="${100 - 44 * H}" cy="${bodyBot - 34}" r="13" fill="${mitt}"/><circle cx="${100 + 44 * H}" cy="${bodyBot - 34}" r="13" fill="${mitt}"/>`;
  } else if (pose === "cane") {
    arms = arm(`M${100 + 28 * H} ${sh} Q${100 + 54} ${sh + 40} ${100 + 50} ${sh + 86}`, 150, sh + 90) + arm(`M${100 - 28 * H} ${sh} Q${100 - 56} ${sh + 30} ${100 - 60} ${sh + 70}`, 40, sh + 74);
    tool = `<rect x="146" y="${sh + 90}" width="9" height="${292 - sh - 92}" rx="4" fill="#8b5a2b"/><rect x="134" y="${sh + 84}" width="30" height="12" rx="6" fill="#8b5a2b"/>`;
  } else if (pose === "blower") {
    arms = arm(`M${100 + 28 * H} ${sh} Q${100 + 56} ${sh + 30} ${100 + 62} ${sh + 56}`, 164, sh + 58) + arm(`M${100 - 28 * H} ${sh} Q${100 - 20} ${sh + 46} ${100 + 24} ${sh + 60}`, 128, sh + 64);
    tool = `<g><rect x="130" y="${sh + 56}" width="70" height="12" rx="6" fill="#444"/><rect x="178" y="${sh + 40}" width="110" height="80" rx="16" fill="#c0392b"/><rect x="190" y="${sh + 8}" width="34" height="40" rx="8" fill="#555"/><rect x="266" y="${sh + 48}" width="40" height="50" rx="8" fill="#8a1f16"/><circle cx="205" cy="${sh + 126}" r="20" fill="#222"/><circle cx="205" cy="${sh + 126}" r="8" fill="#888"/><circle cx="272" cy="${sh + 126}" r="20" fill="#222"/><circle cx="272" cy="${sh + 126}" r="8" fill="#888"/><path d="M246 ${sh + 40} l0 -46 q0 -16 16 -16 l22 0" fill="none" stroke="#555" stroke-width="18" stroke-linecap="round"/><g class="spray" fill="#eaf4fa" stroke="#9cc3d8" stroke-width="2"><circle cx="300" cy="${sh - 26}" r="9"/><circle cx="326" cy="${sh - 44}" r="12"/><circle cx="356" cy="${sh - 68}" r="15"/><circle cx="390" cy="${sh - 98}" r="18"/><circle cx="426" cy="${sh - 128}" r="14" opacity=".7"/></g></g>`;
  } else if (pose === "wave") {
    arms = arm(`M${100 + 28 * H} ${sh} Q${100 + 60} ${sh - 10} ${100 + 62} ${sh - 50}`, 164, sh - 56) + arm(`M${100 - 28 * H} ${sh} Q${100 - 56} ${sh + 40} ${100 - 50} ${sh + 80}`, 50, sh + 84);
  } else if (pose === "cup") {
    arms = arm(`M${100 + 28 * H} ${sh} Q${100 + 60} ${sh + 30} ${100 + 26} ${sh + 56}`, 124, sh + 58) + arm(`M${100 - 28 * H} ${sh} Q${100 - 60} ${sh + 30} ${100 - 26} ${sh + 56}`, 76, sh + 58);
    front = `<rect x="84" y="${sh + 40}" width="32" height="30" rx="6" fill="#fff"/><ellipse cx="100" cy="${sh + 40}" rx="16" ry="5" fill="#d9825b"/>`;
  } else if (pose === "push") {
    // 両手を左（車のほう）へ伸ばして押す。手は肩の高さより少し下
    arms = arm(`M${100 - 20 * H} ${sh + 6} Q${100 - 70} ${sh + 6} ${100 - 112} ${sh + 16}`, -14, sh + 16) + arm(`M${100 - 10 * H} ${sh + 30} Q${100 - 60} ${sh + 40} ${100 - 108} ${sh + 46}`, -10, sh + 46);
  } else if (pose === "cheer") {
    arms = arm(`M${100 + 28 * H} ${sh} Q${100 + 62} ${sh - 20} ${100 + 58} ${sh - 62}`, 160, sh - 68) + arm(`M${100 - 28 * H} ${sh} Q${100 - 62} ${sh - 20} ${100 - 58} ${sh - 62}`, 40, sh - 68);
  } else if (pose === "stand") {
    arms = arm(`M${100 + 28 * H} ${sh} Q${100 + 52} ${sh + 40} ${100 + 48} ${sh + 82}`, 148, sh + 86) + arm(`M${100 - 28 * H} ${sh} Q${100 - 52} ${sh + 40} ${100 - 48} ${sh + 82}`, 52, sh + 86);
  }
  const shadow = `<ellipse cx="100" cy="292" rx="${60 * H}" ry="12" fill="rgba(20,34,50,.16)"/>`;
  return `<g class="person" id="${id}" transform="translate(${x} ${y}) scale(${flip ? -s : s} ${s})${flip ? " translate(-200 0)" : ""}">${shadow}${tool}${legs}<g class="upper" transform="rotate(${lean} 100 ${legTop})">${behind}${body}${arms}${front}${scarfPart}${headPart()}</g>${extra}</g>`;
}

// ---- スマホ（録画のコマを映す）----
// clips: [{ t0, scene, phone, from, rate, to }]（EDIT.clips[場面][スマホ]）。押した所には指の印と波紋を出す
function Phone(parent, { x, y, h = 900, label, clips, taps = true }) {
  const w = (h - 22) * 390 / 844 + 22;
  const el = $(`<div class="ph" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"><div class="ph-screen"><img><div class="ph-ripple"></div><div class="ph-finger"></div></div>${label ? `<div class="ph-label">${label}</div>` : ""}</div>`);
  parent.append(el);
  const img = el.querySelector("img"), fg = el.querySelector(".ph-finger"), rp = el.querySelector(".ph-ripple");
  const k = (h - 22) / 844;
  let cur = "";
  const pick = (lt) => {
    let c = clips[0];
    for (const q of clips) if ((q.t0 ?? 0) <= lt) c = q;
    let rt = c.from + Math.max(0, lt - (c.t0 ?? 0)) * (c.rate ?? 1);
    if (c.to != null) rt = Math.min(rt, c.to);
    const ph = TL.rec[c.scene].phones[c.phone];
    const idx = clamp(Math.floor(rt * FPS) + 1, 1, ph.frames);
    return { c, rt, src: `${REC}${ph.dir}/${String(idx).padStart(5, "0")}.jpg` };
  };
  const api = {
    el, img, w, h, k, x, y, pick, src: "",
    update(lt) {
      const f = pick(lt);
      api.src = f.src; api.rt = f.rt; api.clip = f.c;
      if (f.src !== cur) { cur = f.src; img.src = f.src; PENDING.push(img.decode().catch(() => {})); }
      if (!taps) return;
      const first = Object.keys(TL.rec[f.c.scene].phones)[0];
      let on = null;
      for (const m of Object.values(TL.rec[f.c.scene].marks)) {
        if (!m.tap || m.x == null || (m.phone ?? first) !== f.c.phone) continue;
        const d = (f.rt - m.t) / (f.c.rate ?? 1); // 押した瞬間からの秒（動画の時間で）
        if (d > -0.42 && d < 0.55) on = { m, d };
      }
      if (on) {
        const { m, d } = on, kk = clamp((d + 0.42) / 0.42);
        fg.style.left = (m.x + (1 - Ease.out(kk)) * 16) * k + "px"; fg.style.top = (m.y + (1 - Ease.out(kk)) * 30) * k + "px";
        fg.style.opacity = d < 0 ? kk : Math.max(0, 1 - d * 2.6);
        fg.style.transform = `scale(${d < 0 ? 1.25 - kk * 0.25 : d < 0.12 ? 0.82 : 1})`;
        const r = clamp(d / 0.55);
        rp.style.left = m.x * k + "px"; rp.style.top = m.y * k + "px"; rp.style.opacity = d < 0 ? 0 : 1 - r; rp.style.transform = `scale(${0.35 + Ease.out(r) * 1.3})`;
      } else { fg.style.opacity = 0; rp.style.opacity = 0; }
    },
  };
  return api;
}
/**
 * 拡大レンズ: スマホの画面の一部（sx, sy から幅 sw。390×844 の座標）を、x,y,w,h の窓に大きく映す。
 * 動かしたいときは update のあとに set({ sx, sy, sw }) を呼ぶ
 */
function Lens(parent, phone, { x, y, w, h, sx = 0, sy = 0, sw = 390, radius = 30 }) {
  const el = $(`<div class="lens" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-radius:${radius}px"><img></div>`);
  parent.append(el);
  const img = el.querySelector("img");
  let cur = "";
  const api = {
    el, sx, sy, sw,
    set(o) { Object.assign(api, o); },
    update() {
      if (phone.src !== cur) { cur = phone.src; img.src = phone.src; PENDING.push(img.decode().catch(() => {})); }
      const sc = w / api.sw;
      img.style.width = 390 * sc + "px"; img.style.height = 844 * sc + "px";
      img.style.transform = `translate(${-api.sx * sc}px, ${-api.sy * sc}px)`;
    },
  };
  return api;
}

/** 数字を数え上げる */
const countUp = (k, to, digits = 0) => (to * Ease.out(k)).toFixed(digits);
/** 場面の中の時間の道具 */
function helpers(s) {
  const L = Object.fromEntries(s.lines.map((l) => [l.id, l]));
  return {
    dur: s.end - s.start,
    /** その行が始まる秒（場面の頭から） */
    at: (id, off = 0) => (L[id] ? L[id].at - s.start + off : 0),
    /** その行が終わる秒 */
    end: (id, off = 0) => (L[id] ? L[id].at + L[id].dur - s.start + off : 0),
    /** 行の途中（0〜1）の秒 */
    mid: (id, k) => (L[id] ? L[id].at - s.start + L[id].dur * k : 0),
    g: (name) => (EDIT.cue[name] != null ? EDIT.cue[name] - s.start : 0),
  };
}
