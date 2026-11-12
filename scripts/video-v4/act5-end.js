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
    <div class="full" id="a5g" style="opacity:0;background:linear-gradient(180deg,#0f2034 0%,#1d3554 60%,#2c4a70 100%)">
      <div class="abs" id="a5gh" style="left:0;right:0;top:100px;text-align:center;font-size:84px;font-weight:900;letter-spacing:.02em">雪かきで、<span style="color:#ffd59a">ポイント</span>がたまる。</div>
      <div class="abs" id="a5gp" style="left:0;right:0;top:214px;text-align:center;font-family:var(--maru);font-weight:900;color:#ffd59a;line-height:1"><span style="font-size:70px">+</span><span id="a5gn" style="font-size:150px">0</span><span style="font-size:60px;color:#fff"> ポイント</span><span style="font-family:var(--sans);font-size:28px;font-weight:700;color:#dbe7f1;margin-left:14px">（1軒の手伝いで 10羽）</span></div>
      <div class="abs" id="a5gc" style="left:0;right:0;top:388px;text-align:center"><span class="chip" style="background:#ffd59a;color:#1e3346;font-size:30px;padding:8px 28px">今後の展望</span></div>
      <svg class="abs" style="left:0;top:0;overflow:visible" width="1920" height="1080">
        <path class="a5gl" d="M560 620 L750 620" fill="none" stroke="#ffd59a" stroke-width="10" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/>
        <path class="a5gl" d="M1170 620 L1360 620" fill="none" stroke="#ffd59a" stroke-width="10" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/>
      </svg>
      ${[["雪かき", "シマエナGO", "手伝い・自分の家・道の知らせ", 180, "#fff"], ["行政と連携", "ポイントを支える", "除雪や見守りとも、つなぐ", 750, "#d7e8ff"], ["地元のお店", "ポイントが使える", "パン屋・銭湯・商店街 など", 1360, "#ffe9cf"]].map(([a, b, c, x, bg], i) => `<div class="abs a5gn" style="left:${x}px;top:458px;width:380px;height:330px;border-radius:44px;background:${bg};color:#1e3346;box-shadow:0 26px 60px rgba(0,0,0,.35);text-align:center;padding-top:${i === 0 ? 16 : 30}px">${i === 0 ? `<div style="height:104px;display:flex;justify-content:center">${mascot(SCARF.lamp, 104, "happy")}</div>` : `<div style="font-size:84px;line-height:1.1">${i === 1 ? "🏛️" : "🏪"}</div>`}<div style="font-size:${a.length > 5 ? 44 : 60}px;font-weight:900;margin-top:${i === 0 ? 0 : 8}px;white-space:nowrap">${a}</div><div style="font-family:var(--sans);font-size:30px;font-weight:800;margin-top:6px;color:#4a637a">${b}</div><div style="font-family:var(--sans);font-size:23px;font-weight:700;margin-top:8px;color:#7a6a5e;padding:0 14px;line-height:1.4">${c}</div></div>`).join("")}
      <div class="abs" id="a5coin" style="left:0;top:0;width:64px;height:64px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff3c9,#ffc45a 60%,#e59a1f);box-shadow:0 8px 20px rgba(0,0,0,.35);display:grid;place-items:center;font-family:var(--maru);font-size:34px;font-weight:900;color:#8a5a00">P</div>
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
  const th = T("huddle"), tg = T("gov"), tf = tg, te = T("end"), tE = E("end"), c40 = th + 0.1, c62 = L("c62"), c63 = L("c63"), coin = q("#a5coin"), gnum = q("#a5gn"), Gg = q("#a5g"), gl = [...root.querySelectorAll(".a5gl")], gn = [...root.querySelectorAll(".a5gn")], c43 = L("c43"), c44 = L("c44");
  const branchY = (x) => 678 - (x - 300) * 0.045;
  return (t) => {
    sn.update(t, t < te ? 1 : 0.6);
    H.style.opacity = 1 - pr(t, tf - 0.1, 0.6, Ease.lin);
    // 1羽ずつ飛んできて、まん中へ寄ってくっつく
    const sq = pr(t, c40 + 0.9, 1.1, Ease.io);
    birds.forEach((b, i) => {
      const at = th + 0.15 + [0.5, 0.15, 0, 0.3, 0.65][i], f = pr(t, at, 0.95, Ease.out), land = at + 0.95;
      const tx = 960 - 115 + (i - 2) * lerp(196, 136, sq), ty = branchY(tx + 115) - 205;
      const from = i < 2 ? -300 : i > 2 ? 2100 : 960 - 115, sx = lerp(from, tx, f), sy = lerp(i === 2 ? -260 : 140, ty, f) - Math.sin(f * 3.14) * 130;
      const bob = t > land ? Math.exp(-(t - land) * 4) * Math.sin((t - land) * 12) * 10 : 0, breathe = sq > 0.9 ? Math.sin(t * 1.6 + i) * 2.5 : 0;
      b.set(sq > 0.75 ? "sleep" : "normal");
      b.style.transform = `translate(${sx}px,${sy + bob}px) rotate(${(1 - f) * (i < 2 ? -16 : 16) + (i - 2) * sq * 3.5}deg) scale(${(i < 2 ? 1 : -1) * 1},1) scale(${1 + breathe * 0.004},${1 - breathe * 0.004})`;
      b.style.zIndex = 5 - Math.abs(i - 2);
    });
    Pp.style.opacity = 0;
    // これから: 雪かき → ポイント →（行政・スポンサーと）→ 地元のお店（構想）
    Gg.style.opacity = win(t, tg - 0.1, tg + 0.5, te - 0.1, te + 0.6);
    show(q("#a5gh"), t, tg + 0.2, { dy: 30 });
    show(q("#a5gp"), t, c62 + 0.5, { scale: 0.8, ease: Ease.back }); gnum.textContent = Math.round(10 * pr(t, c62 + 0.6, 1.1, Ease.out5));
    show(q("#a5gc"), t, c63 - 0.1, { dy: 10 });
    const gT = [c63 - 0.05, c63 + 0.9, c63 + 2.6];
    gn.forEach((n, i) => show(n, t, gT[i], { scale: 0.7, ease: Ease.back, d: 0.6 }));
    gl.forEach((l, i) => l.setAttribute("stroke-dashoffset", (1 - pr(t, gT[i + 1] - 0.45, 0.5, Ease.io)).toFixed(3)));
    // コインが、雪かきから お店へ 転がっていく
    const ck = pr(t, c63 + 1.2, 2.2, Ease.io);
    coin.style.opacity = win(t, c63 + 1.0, c63 + 1.3, c63 + 3.6, c63 + 4.0);
    coin.style.transform = `translate(${lerp(520, 1380, ck)}px,${588 - Math.abs(Math.sin(ck * Math.PI * 3)) * 46}px) rotate(${ck * 720}deg)`;
    // 題字
    Ee.style.opacity = pr(t, te - 0.1, 0.7, Ease.lin);
    show(q("#a5tag"), t, c43 - 0.15, { dy: 30, d: 0.8 });
    show(q("#a5logo"), t, c44 - 0.25, { scale: 0.8, ease: Ease.back, d: 0.6 });
    const qr = q("#a5qr"), kq = pr(t, c44 + 0.7, 0.6); qr.style.opacity = kq; qr.style.transform = `translateX(-50%) translateY(${(1 - kq) * 26}px)`;
    const c45 = L("c44") + 1.4, hop = t > c45 ? Math.abs(Math.sin((t - c45) * 6)) * Math.exp(-(t - c45) * 0.9) * 26 : 0;
    row.style.opacity = pr(t, c43 - 0.3, 0.6); row.style.transform = `translateY(${-hop}px)`;
    return { note: t >= tg && t < te ? "※ ポイントは、いまはアプリの中の点（羽・チームの点）です。お店で使えるしくみ・行政との連携は、今後の展望です（まだありません）" : t >= te ? "声: 合成音声（AivisSpeech モデル「まい」）／音楽・効果音: アプリと同じ Web Audio 合成／地図: © OpenStreetMap contributors／画面の町と人は架空です" : "" };
  };
} });
