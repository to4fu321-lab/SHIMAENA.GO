// 第3幕「ありがとう」: 隊長がやらない仕事。声は合成しない。だから動画の中でも、そこは空けておく。
ACTS.push({ from: "thanks", to: "blank", make(root) {
  root.innerHTML = `
    <div class="full" style="background:radial-gradient(90% 90% at 30% 45%, #3a3350 0%, #1b2436 55%, #0e1622 100%)"></div>
    <div class="full" id="a3s"></div>
    <div class="full" id="a3b" style="background:#0a121c;opacity:0">
      <div class="abs" style="left:0;right:0;top:300px;text-align:center"><div id="a3mic" style="font-size:90px">🎤</div>
        <div id="a3l1" style="margin-top:24px;font-size:66px;font-weight:700;letter-spacing:.06em">ここには、家の人の声が入ります。</div></div>
      <svg class="abs" style="left:260px;top:600px" width="1400" height="120" viewBox="0 0 1400 120"><path id="a3wave" d="" fill="none" stroke="#ffd59a" stroke-width="5" stroke-linecap="round"/></svg>
      <div class="abs" id="a3l2" style="left:0;right:0;top:760px;text-align:center;font-family:var(--sans);font-size:32px;font-weight:600;color:#9fb3c6;letter-spacing:.04em">聞けるのは、手伝った人だけ。7日で消えます。　AI には、渡しません。</div>
    </div>`;
  const q = (s) => root.querySelector(s), stage = q("#a3s"), blank = q("#a3b"), wave = q("#a3wave");
  const sn = snow(31, 110, { size: 3.4 }); root.insertBefore(sn, stage);
  const ph = phone("thanks", "c", { w: 366, label: `<span class="chip" style="position:relative;top:34px;background:#fff;color:#1e3346;font-size:22px;padding:5px 18px;z-index:5">小林さん（頼んだ家）</span>` }); stage.append(ph);
  const txt = $(`<div class="abs" style="left:830px;top:170px;width:1000px">
      <div id="a3big" style="font-size:176px;font-weight:900;line-height:1.1;color:#ffd59a;text-shadow:0 0 70px rgba(255,170,90,.4)">ありがとう</div>
      <div id="a3sub" style="font-size:50px;font-weight:700;margin-top:10px;color:#e6eef6">これだけは、AI の仕事じゃない。</div>
      <div style="margin-top:44px;display:flex;flex-direction:column;gap:16px">${["AI は、書かない。", "文字にも、しない。", "要約も、しない。"].map((w) => `<div class="a3no" style="display:flex;align-items:center;gap:20px;font-size:50px;font-weight:700"><span style="display:inline-grid;place-items:center;width:62px;height:62px;border-radius:50%;background:rgba(255,255,255,.1);border:3px solid #ff9c8a;color:#ff9c8a;font-size:38px;font-weight:900">✕</span>${w}</div>`).join("")}</div>
    </div>`); stage.append(txt);
  const big = q("#a3big"), sub = q("#a3sub"), nos = [...root.querySelectorAll(".a3no")];
  const t0 = T("thanks"), tb = T("blank"), te = E("blank"), c26 = L("c26"), c27 = L("c27"), c28 = L("c28"), d27 = LE("c27") - c27;
  return (t) => {
    sn.update(t, 0.6);
    ph.at(330 - (1 - pr(t, t0, 0.6, Ease.out5)) * 70, 134, { op: 1 });
    ph.frame(kf(t, [[t0, mk("thanks", "mic") - (c26 + 0.9 - t0)], [c26 + 0.9, mk("thanks", "mic")], [c26 + 1.3, mk("thanks", "mic") + 0.4], [c26 + 1.32, mk("thanks", "talk") - 1.3], [c27 + 0.3, mk("thanks", "talk")], [tb, mk("thanks", "talk") + (tb - c27 - 0.3)]], Ease.lin));
    show(big, t, c26 + 0.5, { scale: 0.85, ease: Ease.back, d: 0.7 });
    show(sub, t, c26 + (LE("c26") - c26) * 0.5);
    nos.forEach((n, i) => show(n, t, c27 + d27 * [0.42, 0.62, 0.78][i], { dx: 40, dy: 0 }));
    // 空けておく: 画面が暗くなり、平らな線だけが残る
    const b = win(t, c28 + 0.9, tb + 0.2, te - 0.01, te + 0.5);
    blank.style.opacity = b;
    const lt = t - tb;
    let d = "";
    for (let i = 0; i <= 140; i++) { const x = i * 10, u = i / 140, bump = Math.exp(-Math.pow((u - (lt / 4.6)) * 9, 2)); const y = 60 + Math.sin(i * 0.9 + t * 3) * 1.2 + Math.sin(i * 0.55 + t * 5) * 9 * bump * 0.35; d += (i ? "L" : "M") + x + " " + y.toFixed(1); }
    wave.setAttribute("d", d);
    return { hide: t > tb - 0.05, note: t < tb ? "※ 画面は実際のアプリの録画です" : "" };
  };
} });
