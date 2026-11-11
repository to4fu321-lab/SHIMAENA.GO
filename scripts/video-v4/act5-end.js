// 第5幕「くっついて乗り切る」: 枝の上でくっつくシマエナガ → 初雪（作者の写真）→ 題字。
ACTS.push({ from: "huddle", to: "end", make(root) {
  const KINDS = ["salvia", "marigold", "lamp", "lupinus", "ice"];
  root.innerHTML = `
    <div class="full" style="background:linear-gradient(180deg,#0a1420 0%,#16273c 55%,#263c58 100%)"></div>
    <div class="full" id="a5h">
      <svg class="abs" style="left:0;top:0" width="1920" height="1080" viewBox="0 0 1920 1080"><path d="M-40 700 C400 660 900 690 1300 664 C1560 648 1780 640 1960 610" fill="none" stroke="#3a2c26" stroke-width="46" stroke-linecap="round"/><path d="M-40 680 C400 640 900 670 1300 644 C1560 628 1780 620 1960 590" fill="none" stroke="#f4f8fb" stroke-width="26" stroke-linecap="round"/><path d="M1300 664 C1420 600 1500 520 1540 430" fill="none" stroke="#3a2c26" stroke-width="20" stroke-linecap="round"/><path d="M1308 648 C1420 588 1492 516 1532 434" fill="none" stroke="#f4f8fb" stroke-width="10" stroke-linecap="round"/></svg>
      <div class="abs" id="a5birds" style="left:0;top:0"></div>
    </div>
    <div class="full" id="a5p" style="opacity:0;overflow:hidden">
      <img src="${ASSET.park}" class="abs" style="left:-10%;top:-60%;width:120%;filter:blur(26px) brightness(.55)">
      <div class="abs" id="a5card" style="left:250px;top:86px;width:620px;height:827px;border-radius:14px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.55),0 0 0 14px #fff"><img id="a5img" src="${ASSET.park}" style="position:absolute;left:0;top:0;width:100%;transform-origin:50% 60%"></div>
      <div class="abs" style="left:1010px;top:230px;width:860px">
        <div id="a5d" class="mono" style="font-size:54px;font-weight:700;color:#ffd59a;letter-spacing:.06em">2026.11.8</div>
        <div id="a5f" style="font-size:118px;font-weight:900;line-height:1.2;margin-top:4px;white-space:nowrap">札幌に、初雪。</div>
        <div id="a5n" style="font-size:66px;font-weight:700;line-height:1.4;margin-top:60px;color:#e6eef6">本物の雪の朝は、<br><span style="color:#ffd59a">これから。</span></div>
        <div id="a5c" style="font-family:var(--sans);font-size:24px;font-weight:600;color:rgba(255,255,255,.6);margin-top:40px">写真: 作者が撮った、その朝の公園</div>
      </div>
    </div>
    <div class="full" id="a5e" style="opacity:0;background:linear-gradient(180deg,#15263b 0%,#34507a 62%,#e9a98a 135%)">
      <div class="abs" id="a5row" style="left:0;right:0;top:92px;height:170px;display:flex;justify-content:center"></div>
      <div class="abs" id="a5tag" style="left:0;right:0;top:290px;text-align:center;font-family:var(--min);font-size:112px;font-weight:700;letter-spacing:.06em;text-shadow:0 8px 40px rgba(0,0,0,.35)">寒い冬は、くっついて乗り切る。</div>
      <div class="abs" id="a5logo" style="left:0;right:0;top:470px;text-align:center;font-size:150px;font-weight:900;letter-spacing:.02em">シマエナ<span style="color:#ffb37f">GO</span></div>
      <div class="abs" id="a5qr" style="left:50%;top:690px;transform:translateX(-50%);display:flex;align-items:center;gap:26px;padding:16px 34px 16px 16px;border-radius:26px;background:#fff;color:#1e3346;box-shadow:0 18px 50px rgba(0,0,0,.35)"><img src="${ASSET.qr}" width="150" height="150"><div><div style="font-family:var(--sans);font-size:26px;font-weight:800;color:#c96a3a">登録なしで、いま触れます</div><div class="mono" style="font-size:38px;font-weight:800;margin-top:4px">shimaena-go.vercel.app</div></div></div>
    </div>`;
  const q = (s) => root.querySelector(s);
  const H = q("#a5h"), birdsEl = q("#a5birds"), Pp = q("#a5p"), Ee = q("#a5e"), img = q("#a5img"), row = q("#a5row");
  const sn = snow(51, 200, { size: 4.2 }); root.append(sn);
  const birds = KINDS.map((k, i) => { const el = $(`<div class="abs" style="width:230px;height:230px;transform-origin:50% 88%"></div>`); el.set = (m) => { if (el._m !== m) { el._m = m; el.innerHTML = mascot(SCARF[k], 230, m); } }; el.set("normal"); birdsEl.append(el); return el; });
  row.innerHTML = KINDS.map((k, i) => `<div style="margin:0 -22px;transform:translateY(${[10, 0, -8, 0, 10][i]}px) rotate(${(i - 2) * 3}deg)">${mascot(SCARF[k], 170, "happy")}</div>`).join("");
  const th = T("huddle"), tf = T("firstsnow"), te = T("end"), tE = E("end"), c40 = L("c40"), c41 = L("c41"), c42 = L("c42"), c43 = L("c43"), c44 = L("c44"), c45 = L("c45");
  const branchY = (x) => 678 - (x - 300) * 0.045;
  return (t) => {
    sn.update(t, t < te ? 1 : 0.6);
    H.style.opacity = 1 - pr(t, tf - 0.1, 0.6, Ease.lin);
    // 1羽ずつ飛んできて、まん中へ寄ってくっつく
    const sq = pr(t, c40 + (LE("c40") - c40) * 0.45, 1.3, Ease.io);
    birds.forEach((b, i) => {
      const at = th + 0.15 + [0.5, 0.15, 0, 0.3, 0.65][i], f = pr(t, at, 0.95, Ease.out), land = at + 0.95;
      const tx = 960 - 115 + (i - 2) * lerp(196, 136, sq), ty = branchY(tx + 115) - 205;
      const from = i < 2 ? -300 : i > 2 ? 2100 : 960 - 115, sx = lerp(from, tx, f), sy = lerp(i === 2 ? -260 : 140, ty, f) - Math.sin(f * 3.14) * 130;
      const bob = t > land ? Math.exp(-(t - land) * 4) * Math.sin((t - land) * 12) * 10 : 0, breathe = sq > 0.9 ? Math.sin(t * 1.6 + i) * 2.5 : 0;
      b.set(sq > 0.75 ? "sleep" : "normal");
      b.style.transform = `translate(${sx}px,${sy + bob}px) rotate(${(1 - f) * (i < 2 ? -16 : 16) + (i - 2) * sq * 3.5}deg) scale(${(i < 2 ? 1 : -1) * 1},1) scale(${1 + breathe * 0.004},${1 - breathe * 0.004})`;
      b.style.zIndex = 5 - Math.abs(i - 2);
    });
    // 初雪
    Pp.style.opacity = win(t, tf - 0.1, tf + 0.6, te - 0.1, te + 0.6);
    img.style.transform = `scale(${1 + clamp((t - tf) / 9) * 0.1})`;
    q("#a5card").style.transform = `rotate(${-2.2 + pr(t, tf, 1.2) * 0.8}deg) translateY(${(1 - pr(t, tf, 0.9, Ease.out5)) * 60}px)`;
    show(q("#a5d"), t, c41 - 0.2); show(q("#a5f"), t, c41 + 0.5, { dy: 30 }); show(q("#a5n"), t, c42 - 0.1, { dy: 30 }); show(q("#a5c"), t, c41 + 1.2, { dy: 0 });
    // 題字
    Ee.style.opacity = pr(t, te - 0.1, 0.7, Ease.lin);
    show(q("#a5tag"), t, c43 - 0.15, { dy: 30, d: 0.8 });
    show(q("#a5logo"), t, c44 - 0.25, { scale: 0.8, ease: Ease.back, d: 0.6 });
    const qr = q("#a5qr"), kq = pr(t, c44 + 0.7, 0.6); qr.style.opacity = kq; qr.style.transform = `translateX(-50%) translateY(${(1 - kq) * 26}px)`;
    const hop = t > c45 ? Math.abs(Math.sin((t - c45) * 6)) * Math.exp(-(t - c45) * 0.9) * 26 : 0;
    row.style.opacity = pr(t, c43 - 0.3, 0.6); row.style.transform = `translateY(${-hop}px)`;
    return { note: t >= te ? "声: 合成音声（AivisSpeech モデル「まい」）／音楽・効果音: アプリと同じ Web Audio 合成／地図: © OpenStreetMap contributors／画面の町と人は架空です" : "" };
  };
} });
