// 場面を時間で切りかえて動かす。seek(t) は、そのコマの絵がそろったら終わる Promise を返す。
const XF = 0.5; // 幕と幕のつなぎ（秒）
const actsEl = document.getElementById("acts");
const RUN = ACTS.map((a, i) => {
  const root = $(`<div class="act" style="z-index:${i + 1}"></div>`);
  actsEl.append(root);
  return { ...a, root, start: T(a.from), end: E(a.to), update: a.make(root) };
});
function seek(t) {
  t = clamp(t, 0, TL.seconds - 0.001);
  let cur = null;
  RUN.forEach((a, i) => {
    const on = t >= a.start && t < a.end + (i < RUN.length - 1 ? XF : 0);
    a.root.style.display = on ? "block" : "none";
    if (!on) return;
    a.root.style.opacity = i === 0 ? 1 : clamp((t - a.start) / XF);
    const o = a.update(t) || {};
    if (t < a.end) cur = { a, o };
  });
  const o = cur ? cur.o : {};
  subtitle(t, o);
  noteEl.textContent = o.note || "";
  noteEl.className = o.dark ? "dark" : "";
  bubEl.style.background = "";
  const p = Promise.all(PENDING.splice(0));
  return p;
}
window.seek = seek;
if (!/render=1/.test(location.search)) {
  const s = document.getElementById("scrub"), r = document.getElementById("rng"), tt = document.getElementById("tt");
  s.hidden = false; r.max = TL.seconds;
  r.oninput = () => { tt.textContent = (+r.value).toFixed(2); seek(+r.value); };
}
seek(0);
