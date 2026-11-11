// 第2幕「10分間」: 本物のアプリの録画で、隊長の3つの仕事（知らせる・割り振る・確かめる）を見せる。
ACTS.push({ from: "ask", to: "card", make(root) {
  const PW = 366, PY = 134;
  root.innerHTML = `
    <div class="full" style="background:linear-gradient(180deg,#d6e6f1 0%,#eef4f9 58%,#dfeaf2 100%)"></div>
    <svg class="abs" style="left:0;bottom:0" width="1920" height="300" viewBox="0 0 1920 300"><path d="M0 190 C300 120 520 210 820 160 C1120 110 1400 200 1920 130 L1920 300 L0 300 Z" fill="#fff" opacity=".75"/><path d="M0 240 C400 190 900 260 1300 215 C1600 185 1800 230 1920 215 L1920 300 L0 300 Z" fill="#fff"/></svg>
    <div class="full hud" style="z-index:20;pointer-events:none"><div class="step" id="a2step"><span class="chip"><b>1</b>知らせる</span><span class="chip"><b>2</b>割り振る</span><span class="chip"><b>3</b>確かめる</span></div>
    <div class="abs" id="a2clock" style="right:44px;top:30px;width:150px;height:150px">
      <svg width="150" height="150" viewBox="0 0 150 150"><circle cx="75" cy="75" r="62" fill="#fff" stroke="#d3e0ea" stroke-width="12"/><circle id="a2arc" cx="75" cy="75" r="62" fill="none" stroke="#e8834f" stroke-width="12" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" transform="rotate(-90 75 75)"/></svg>
      <div class="abs mono" id="a2time" style="left:0;right:0;top:40px;text-align:center;font-size:40px;font-weight:800;color:#1e3346">6:30</div>
      <div class="abs" id="a2min" style="left:0;right:0;top:88px;text-align:center;font-family:var(--sans);font-size:19px;font-weight:800;color:#c96a3a">0分</div>
    </div></div>
    <div class="full" id="a2s"></div>`;
  const q = (s) => root.querySelector(s);
  const stage = q("#a2s"), pills = [...q("#a2step").children], stepEl = q("#a2step"), clock = q("#a2clock"), arc = q("#a2arc"), timeEl = q("#a2time"), minEl = q("#a2min");
  const sn = snow(21, 90, { color: "#9fc0d6", size: 3.6 }); root.insertBefore(sn, stage);
  const add = (el) => { stage.append(el); return el; };
  const lab = (text) => `<span class="chip" style="position:relative;top:34px;background:#1e3346;color:#fff;font-size:22px;padding:5px 18px;z-index:5">${text}</span>`;
  const panel = (x, y, w, html) => add($(`<div class="abs" style="left:${x}px;top:${y}px;width:${w}px">${html}</div>`));

  // ── 頼む家の登録 ──
  const pAsk = add(phone("ask", "c", { w: PW, label: lab("頼む家の画面（小林さん）") }));
  const askTxt = panel(820, 250, 1000, `<div class="kick">冬の初めに</div><div class="head" style="margin-top:10px">登録は、一度だけ。</div>
    <div class="body" style="margin-top:26px">10cm 以上積もった朝は、自動で「雪かき待ち」になります。<br>離れて暮らす家族が、代わりに登録することもできます。</div>
    <div id="a2q" style="margin-top:38px"><span class="chip" style="background:#1e3346;color:#fff;font-size:36px;padding:14px 34px">「頼みにくさ」は、雪より重いから。</span></div>`);
  const askQ = q("#a2q");

  // ── 6:30 知らせる ──
  const pR = ["a", "b", "c"].map((k, i) => add(phone("ring", k, { w: PW, label: lab(["田中さん（手伝う人）", "近所の人（手伝う人）", "小林さん（頼んだ家）"][i]) })));
  const ringX = [200, 646, 1092];
  const waves = ringX.map((x) => add($(`<div class="abs" style="left:${x + PW / 2}px;top:${PY + 384}px;width:0;height:0"></div>`)));
  const ringTxt = panel(1510, 250, 380, `<div class="mono" style="font-size:104px;font-weight:800;color:#1e3346;line-height:1">6:30</div><div class="body" style="font-weight:800;font-size:34px;color:#1e3346;margin-top:8px">積雪 12cm</div>
    <div class="body" style="margin-top:18px;font-size:30px;font-weight:700">10cm 以上で<br>自動で始まる</div><div id="a2bell" style="margin-top:22px;font-size:84px;transform-origin:50% 10%;width:100px">🔔</div>`);
  const bell = q("#a2bell");

  // ── 割り振る ──
  const pRe = add(phone("reason", "a", { w: PW, label: lab("町の地図（田中さん）") }));
  const rb = REC.reason.marks.box?.box, reBox = rb ? { x: Math.max(0, rb.x - 6), y: rb.y - 6, w: Math.min(390, rb.w + 12), h: rb.h + 12 } : { x: 8, y: 548, w: 374, h: 100 };
  const lRe = add(lens("reason", "a", reBox, 1080));
  const reTxt = panel(720, 190, 1120, `<div class="kick">${SPARK("#c96a3a", 30)}　Claude が決めた人数と、その理由</div>`);
  const reCard = panel(720, 610, 1080, `<div style="display:flex;gap:18px;align-items:stretch">
      <div class="card" style="position:relative;flex:1;padding:22px 28px"><div class="kick" style="font-size:22px">わたすもの</div><div class="body" style="font-size:28px;color:#1e3346;font-weight:700;margin-top:6px">予報・頼み方・家の位置<br>採点表 <span class="mono" style="font-size:25px">rubric.json</span></div></div>
      <div style="align-self:center;font-size:44px;color:#c96a3a;font-weight:900">→</div>
      <div class="card" style="position:relative;flex:1.15;padding:22px 28px"><div class="kick" style="font-size:22px">返ってくるもの（JSON）</div><div class="body" style="font-size:28px;color:#1e3346;font-weight:700;margin-top:6px">家ごとの人数・担当・理由<br>ひとりずつへの文面</div></div></div>`);

  // ── 行く ──
  const pGa = add(phone("go", "a", { w: PW, label: lab("田中さん（手伝う人）") }));
  const pGc = add(phone("go", "c", { w: PW, label: lab("小林さん（頼んだ家）") }));
  const goTxt = panel(800, 300, 320, `<div style="text-align:center"><div class="head" style="font-size:60px">「行く」</div><svg width="300" height="70" viewBox="0 0 300 70"><path id="a2arr" d="M10 35 H270 M240 10 L275 35 L240 60" fill="none" stroke="#e8834f" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/></svg><div class="body" style="font-weight:800;color:#1e3346;font-size:30px;margin-top:6px">家の人にも<br>「向かっています」</div></div>`);
  const arr = q("#a2arr");

  // ── ヘルプ: 人手が足りない → 近くの人に知らせる → ほかのチームの人も来られる ──
  const HP = REC._help || {}, hasH = !!REC.help, hasHg = !!(REC.helpgo && REC.helpgo.marks.go);
  const pHa = hasH ? add(phone("help", "a", { w: PW, label: lab(`田中さん（${HP.myTeam || "サルビア"}）`) })) : null;
  const pHb = hasHg ? add(phone("helpgo", "b", { w: PW, label: lab(`ほかのチームの人（${HP.helperTeam || "別のチーム"}）`) })) : null;
  const helpTxt = panel(700, 190, 560, `<div class="kick" style="color:#c0392b">ヘルプ</div><div class="head" style="margin-top:8px;font-size:66px;line-height:1.25">人手が足りない<br>→ 近くに知らせる</div>
    <svg width="520" height="70" viewBox="0 0 520 70" style="margin-top:18px"><path id="a2harr" d="M10 35 H490 M460 10 L495 35 L460 60" fill="none" stroke="#c0392b" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/></svg>
    <div id="a2hc" style="margin-top:22px;display:flex;flex-direction:column;gap:14px;align-items:flex-start"><span class="chip" style="background:#fff;color:#1e3346;font-size:30px;padding:10px 24px;box-shadow:0 10px 24px rgba(40,70,100,.14)">ほかのチームも、助けに行ける</span><span class="chip" style="background:#fff;color:#1e3346;font-size:30px;padding:10px 24px;box-shadow:0 10px 24px rgba(40,70,100,.14)">10分だけでも OK</span></div>`);
  const harr = q("#a2harr"), hChips = [...q("#a2hc").children];
  const tH = SC.help ? T("help") : T("map"), c21 = SC.help ? L("c21") : tH, e21 = SC.help ? LE("c21") : tH + 1;
  const hm = hasH ? REC.help.marks : {}, hg = hasHg ? REC.helpgo.marks : {};
  const vShort = c21 + 0.5, vSend = c21 + 1.5, vB = c21 + (e21 - c21) * 0.52, vGo2 = vB + 1.3;

  // ── 地図（チーム戦）──
  const pMap = add(phone("map", "a", { w: PW, label: lab("町の地図") }));
  const mb = REC.map.marks.bbox?.box;
  const mapBox = (() => {
    if (!mb) return { x: 28, y: 178, w: 216, h: 190 };
    // 印の範囲に少し余白をつけ、窓の形（760:668）に合わせる
    // 窓は 760×668 に収まるいちばん大きい形（スマホの幅 390 より広くは切り出せない）
    const pad = 14, x0 = Math.max(0, mb.x - pad), x1 = Math.min(390, mb.x + mb.w + pad), y0 = Math.max(64, mb.y - pad), y1 = mb.y + mb.h + pad;
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  })();
  const mapW0 = Math.round(mapBox.w * Math.min(760 / mapBox.w, 668 / mapBox.h));
  const padBox = (b) => { const pad = 14, x0 = Math.max(0, b.x - pad), x1 = Math.min(390, b.x + b.w + pad), y0 = Math.max(64, b.y - pad), y1 = b.y + b.h + pad; return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; };
  const mapBoxes = Object.values(REC.map.marks).filter((m) => m.box).map((m) => ({ t: m.t, r: padBox(m.box) })).sort((a, b) => a.t - b.t);
  const lMap = add(lens("map", "a", mapBox, mapW0));
  const allDone = panel(700, 150 + 668 + 16, 760, `<div style="text-align:center"><span class="chip" style="background:#1e7a52;color:#fff;font-size:32px;padding:10px 28px">✓ 全部の家に、色がつきました</span></div>`);
  const teams = [["salvia", "サルビア", "#2F6FE4"], ["marigold", "マリーゴールド", "#FF8A3D"], ["lupinus", "ルピナス", "#9B5DE5"]];
  const teamTxt = panel(1500, 170, 400, `<div class="kick">3チーム戦</div>` + teams.map(([k, n, c], i) => `<div class="a2team" style="position:absolute;left:0;top:${60 + i * 150}px;display:flex;align-items:center;gap:14px">${mascot(SCARF[k], 120)}<span class="chip" style="background:${c};color:#fff;font-size:27px;padding:6px 20px">${n}</span></div>`).join("") +
    `<div id="a2shuf" style="position:absolute;left:0;top:530px;width:400px"><span class="chip" style="background:#1e3346;color:#fff;font-size:30px">■ 終わった家</span><div class="body" style="font-size:28px;margin-top:12px;font-weight:700">四角がチームの色に。<br>個人の順位は出さない。</div></div>`);
  const teamEls = [...teamTxt.querySelectorAll(".a2team")], shuf = q("#a2shuf");

  // ── 確かめる ──
  const pFin = add(phone("finish", "a", { w: PW, label: lab("田中さん（手伝う人）") }));
  // カードの場面だけ別の録画（rec/card）があれば、そちらを使う（公開版の完了画面にカードが出なかったとき）
  const CR = REC.card ? "card" : "finish";
  const pCard = CR === "finish" ? pFin : add(phone("card", "a", { w: PW, label: lab("田中さん（手伝う人）") }));
  const PWd = 780, PHt = Math.round((PWd * 768) / 1408);
  const photo = add($(`<div class="abs" style="left:720px;top:150px;width:${PWd}px;height:${PHt}px;border-radius:26px;overflow:hidden;box-shadow:0 22px 50px rgba(20,40,60,.3),0 0 0 6px #fff">
      <img src="${ASSET.before}" style="position:absolute;inset:0;width:100%;height:100%"><div id="a2aft" style="position:absolute;inset:0;overflow:hidden"><img src="${ASSET.after}" style="position:absolute;left:0;top:0;width:${PWd}px;height:${PHt}px"></div>
      <div id="a2scan" style="position:absolute;top:0;bottom:0;width:6px;background:#fff;box-shadow:0 0 24px 6px rgba(255,255,255,.8)"></div>
      <div id="a2pl" class="chip" style="position:absolute;left:18px;top:16px;background:rgba(12,22,34,.78);color:#fff;font-size:24px">雪かきの前</div></div>`));
  const aft = q("#a2aft"), scan = q("#a2scan"), pl = q("#a2pl");
  const checks = panel(720, 150 + PHt + 22, 1100, `<div style="display:flex;gap:16px;align-items:center"><span class="chip a2ck" style="background:#1e7a52;color:#fff;font-size:32px;padding:10px 28px">✓ 通れる</span><span class="chip a2ck" style="background:#1e7a52;color:#fff;font-size:32px;padding:10px 28px">✓ 凍っていない</span><span class="a2ck body" style="font-size:27px;line-height:1.4;font-weight:700">${SPARK("#c96a3a", 26)} Claude が写真を見る。<br>判断できない写真は、人が決める。</span></div>`);
  const cks = [...checks.querySelectorAll(".a2ck")];
  const lClear = add(lens("finish", "a", { x: 6, y: 26, w: 378, h: 108 }, 640));
  const ten = panel(1530, 150, 360, `<div style="text-align:center"><div style="font-size:170px;font-weight:900;line-height:1;color:#e8834f">10<span style="font-size:80px">分</span></div><div class="body" style="font-weight:800;color:#1e3346;font-size:30px;margin-top:6px">1軒の玄関が、開く。</div></div>`);

  // ── カード ──
  const lCard = add(lens(CR, "a", { x: 44, y: 128, w: 302, h: 424 }, 470));
  const cardTxt = panel(1300, 230, 600, `<div class="kick">お礼は、その朝だけのカード</div><div class="head" style="margin-top:10px;font-size:68px">${SPARK("#e8834f", 60)} が毎回、<br>ゼロから描く。</div>
    <div class="body" style="margin-top:22px;font-size:30px;white-space:nowrap">その朝の空・雪・人数・チームの色から、<br>SVG で描く。<br>描いたあと、自分で見て1回なおす。</div>
    <div class="body" style="margin-top:22px;font-size:21px;color:#7890a5">${REC._meta?.prod && !REC.card && !REC.finish.local ? "※ この絵は、公開中のアプリで Claude が描いたものです" : "※ この録画の絵は、API キーなしで動かしたときの見本です"}</div>`);

  const tA = T("ask"), tR = T("ring"), tRe = T("reason"), tG = T("go"), tM = T("map"), tF = T("finish"), tC = T("card"), tE = E("card");
  const c17 = L("c17"), c22 = L("c22"), c23 = L("c23");
  // 場面ごとの出入り（0〜1）と、横からすべりこむ動き
  const seg = (t, a, b) => win(t, a, a + 0.45, b - 0.3, b);
  const slide = (t, a) => (1 - pr(t, a, 0.6, Ease.out5)) * 70;
  // 録画の時間合わせは、録画の印（届いた・押した・完了した瞬間）から決める。本番は Claude を待つ時間があるので、待ちは飛ばす
  const arriveAt = c17 + 0.3;
  const ringRec = (t, k, i) => { const a = mk("ring", "arrive-" + k), at = arriveAt + i * 0.28; return kf(t, [[tR, 0.3], [at - 0.02, 0.8], [at, a - 0.2], [tRe + 0.4, a - 0.2 + (tRe + 0.4 - at)]], Ease.lin); };
  const mapPts = (() => {
    const dones = Object.keys(REC.map.marks).filter((n) => /^done/.test(n)).map((n) => mk("map", n)).sort((a, b) => a - b);
    const t1 = tM + 1.1, step = (tF - 1.5 - t1) / dones.length, pts = [[tM, mk("map", "fold") - 0.5], [t1, mk("map", "fold") + 1.4]];
    dones.forEach((d, i) => { pts.push([t1 + i * step + step * 0.25, d - 0.5], [t1 + (i + 1) * step, d + 0.9]); });
    if (REC.map.marks.all) pts.push([tF - 1.2, mk("map", "all") + 0.2], [tF + 0.4, mk("map", "all") + 1.2]);
    return pts;
  })();
  const tapGo = tG + 0.85;
  return (t) => {
    sn.update(t, 0.7);
    // 10分の時計: 6:30（知らせる）→ 6:40（玄関が開く）
    const k10 = kf(t, [[c17, 0], [c23, 1]], Ease.lin);
    show(clock, t, tRe - 0.2, { dy: -20 });
    arc.setAttribute("stroke-dashoffset", (1 - k10).toFixed(4));
    const m = Math.round(k10 * 10);
    timeEl.textContent = "6:" + (30 + m); minEl.textContent = m + "分";
    clock.style.transform += ` scale(${1 + Math.max(0, 1 - Math.abs(t - c23 - 0.15) * 3) * 0.2})`;
    // 3つの仕事
    const cur = t < c17 - 0.1 ? 0 : t < L("c18") - 0.1 ? 1 : t < c22 - 0.1 ? 2 : 3;
    show(stepEl, t, LE("c15") - 1.1, { dy: -18, out: tC + 0.3 });
    pills.forEach((p, i) => { p.className = "chip" + (cur === i + 1 ? " on" : cur > i + 1 ? " done" : ""); p.style.transform = `scale(${cur === i + 1 ? 1 + Math.max(0, 1 - (t - [c17, L("c18"), c22][i]) * 2.5) * 0.18 : 1})`; });

    // 頼む家
    let o = seg(t, tA - 0.1, tR + 0.25);
    pAsk.at(330 - slide(t, tA), PY, { op: o }); pAsk.frame(kf(t, [[tA, 0.6], [tR, 7.0]], Ease.lin));
    askTxt.style.opacity = o; askTxt.style.transform = `translateX(${slide(t, tA + 0.15)}px)`;
    show(askQ, t, L("c14") + (LE("c14") - L("c14")) * 0.55, { scale: 0.9, ease: Ease.back });

    // 知らせる
    o = seg(t, tR, tRe + 0.2);
    pR.forEach((p, i) => { p.at(ringX[i], PY + (1 - pr(t, tR + i * 0.1, 0.6, Ease.out5)) * 60, { op: o }); p.frame(ringRec(t, "abc"[i], i)); });
    ["a", "b", "c"].forEach((k, i) => { const dt = t - (arriveAt + i * 0.28); waves[i].innerHTML = dt > 0 && o > 0.5 ? [0, 0.35, 0.7].map((d) => { const u = clamp((dt - d) / 1.3); return u > 0 && u < 1 ? `<i class="abs" style="left:${-190 - u * 46}px;top:${-392 - u * 46}px;width:${380 + u * 92}px;height:${784 + u * 92}px;border-radius:${56 + u * 30}px;border:${7 * (1 - u) + 2}px solid #e8834f;opacity:${(1 - u) * 0.8}"></i>` : ""; }).join("") : ""; });
    ringTxt.style.opacity = o; ringTxt.style.transform = `translateX(${slide(t, tR + 0.3)}px)`;
    const bd = t - arriveAt;
    bell.style.transform = `rotate(${bd > 0 && bd < 3 ? Math.sin(bd * 22) * 22 * Math.exp(-bd * 1.2) : 0}deg)`;

    // 割り振る
    o = seg(t, tRe, tG + 0.2);
    const re = kf(t, [[tRe, 1.0], [tG, 6.4]], Ease.lin);
    pRe.at(250 - slide(t, tRe), PY, { op: o }); pRe.frame(re);
    lRe.at(720, 250, { op: o * pr(t, tRe + 0.9, 0.5), scale: lerp(0.86, 1, pr(t, tRe + 0.9, 0.6, Ease.back)) }); lRe.frame(Math.max(re, 4.2));
    reTxt.style.opacity = o * pr(t, tRe + 0.7, 0.4); reCard.style.opacity = o * pr(t, L("c18") + 1.9, 0.5); reCard.style.transform = `translateY(${(1 - pr(t, L("c18") + 1.9, 0.6)) * 26}px)`;

    // 行く
    o = seg(t, tG, tM + 0.2);
    const g0 = mk("go", "go"), gRe = Math.max(g0 + 0.3, mk("go", "reply") - 0.15), gCo = mk("go", "coming");
    pGa.at(380 - slide(t, tG), PY, { op: o }); pGa.frame(kf(t, [[tG, g0 - (tapGo - tG)], [tapGo, g0], [tapGo + 0.3, g0 + 0.3], [tapGo + 0.32, gRe], [tM + 0.3, gRe + (tM + 0.3 - tapGo)]], Ease.lin));
    pGc.at(1180 + slide(t, tG), PY, { op: o }); pGc.frame(kf(t, [[tG, g0 - (tapGo - tG)], [tapGo + 0.75, g0], [tapGo + 0.77, gCo - 0.15], [tM + 0.3, gCo + 1.2]], Ease.lin));
    goTxt.style.opacity = o * pr(t, tapGo - 0.2, 0.3); arr.setAttribute("stroke-dashoffset", (1 - pr(t, tapGo + 0.1, 0.7, Ease.io)).toFixed(3));

    // ヘルプ
    o = SC.help ? seg(t, tH, tM + 0.2) : 0;
    if (pHa) { pHa.at(250 - slide(t, tH), PY, { op: o }); pHa.frame(kf(t, [[tH, (hm.short?.t ?? 2) - 0.9], [vShort, hm.short?.t ?? 2], [vSend, hm.send?.t ?? 4], [vSend + 0.5, (hm.send?.t ?? 4) + 0.6], [vSend + 0.52, (hm.sent?.t ?? 8) - 0.4], [tM + 0.3, (hm.sent?.t ?? 8) + 2]], Ease.lin)); }
    if (pHb) { pHb.at(1300 + slide(t, tH + 0.2), PY, { op: o * (0.4 + 0.6 * pr(t, vB - 0.2, 0.4)) }); pHb.frame(kf(t, [[tH, (hg.shown?.t ?? 2) - 0.2], [vGo2 - 0.3, (hg.go?.t ?? 4) - 0.3], [vGo2 + 0.3, (hg.go?.t ?? 4) + 0.3], [vGo2 + 0.32, (hg.reply?.t ?? 8) - 0.2], [tM + 0.3, (hg.reply?.t ?? 8) + 1.6]], Ease.lin)); }
    helpTxt.style.opacity = o * pr(t, tH + 0.3, 0.4); helpTxt.style.transform = `translateX(${slide(t, tH + 0.15)}px)`;
    harr.setAttribute("stroke-dashoffset", (1 - pr(t, vSend + 0.2, 0.8, Ease.io)).toFixed(3));
    hChips.forEach((c, i) => show(c, t, vB + 0.1 + i * 0.9, { dx: 20, dy: 0 }));

    // 地図
    o = seg(t, tM, tF + 0.2);
    const mr = kf(t, mapPts, Ease.lin);
    // 録画の途中で地図の見え方が変わる（全部終わると引く）ので、その時の印の範囲を映す
    const mbNow = mapBoxes.filter((b) => b.t <= mr + 0.05).at(-1) ?? mapBoxes[0];
    if (mbNow && mbNow !== lMap._b) { lMap._b = mbNow; lMap._w = Math.round(mbNow.r.w * Math.min(760 / mbNow.r.w, 668 / mbNow.r.h)); lMap.region(mbNow.r, lMap._w); }
    const mapW = lMap._w ?? mapW0;
    pMap.at(250 - slide(t, tM), PY, { op: o }); pMap.frame(mr);
    lMap.at(700 + (760 - mapW) / 2, 150, { op: o * pr(t, tM + 0.5, 0.5), scale: lerp(0.9, 1, pr(t, tM + 0.5, 0.6, Ease.back)) }); lMap.frame(mr);
    teamTxt.style.opacity = o;
    const sw = 0, order = [[0, 1, 2], [2, 0, 1]];
    teamEls.forEach((e, i) => { const y = lerp(order[0][i], order[1][i], sw) * 150, x = Math.sin(sw * 3.14) * (i === 1 ? 50 : -40); e.style.transform = `translate(${x + slide(t, tM + 0.3 + i * 0.12)}px,${y - i * 150}px)`; e.style.opacity = pr(t, tM + 0.3 + i * 0.12, 0.4); });
    show(shuf, t, L("c20") + 0.9, { scale: 0.9, ease: Ease.back });
    show(allDone, t, tF - 1.25, { scale: 0.8, ease: Ease.back }); allDone.style.opacity = o * pr(t, tF - 1.25, 0.3);

    // 確かめる → 10分
    o = seg(t, tF, tE);
    const f0 = mk("finish", "finish"), fc = mk("finish", "clear"), fk = mk(CR, "card"), fs = Math.max(fk + 0.4, (REC[CR].marks.cardshown?.t ?? fk + 2.6) - 2.4);
    const fr = t < tC ? kf(t, [[tF, f0 - (c22 + 1.0 - tF)], [c22 + 1.0, f0], [c22 + 1.5, f0 + 0.5], [c23 - 0.4, f0 + 0.5], [c23 - 0.38, fc - 0.1], [tC, fc - 0.1 + (tC - c23 + 0.38)]], Ease.lin)
      : kf(t, [[tC, fk - 0.9], [tC + 0.9, fk], [tC + 1.25, fk + 0.35], [tC + 1.27, fs], [tE + 0.4, fs + (tE + 0.4 - tC - 1.27)]], Ease.lin);
    if (pCard === pFin) { pFin.at(250 - slide(t, tF), PY, { op: o }); pFin.frame(fr); }
    else { pFin.at(250 - slide(t, tF), PY, { op: t < tC ? o : 0 }); if (t < tC) pFin.frame(fr); pCard.at(250, PY, { op: t >= tC ? o : 0 }); if (t >= tC) pCard.frame(fr); }
    const po = seg(t, c22 + 1.3, tC + 0.15), wipe = pr(t, c22 + 2.5, 1.5, Ease.io);
    photo.style.opacity = po; photo.style.transform = `scale(${lerp(0.9, 1, pr(t, c22 + 1.3, 0.55, Ease.back))})`;
    aft.style.width = wipe * 100 + "%"; scan.style.left = `calc(${wipe * 100}% - 3px)`; scan.style.opacity = wipe > 0.01 && wipe < 0.99 ? 1 : 0;
    pl.textContent = wipe > 0.5 ? "雪かきのあと（この1枚を送る）" : "雪かきの前";
    checks.style.opacity = po;
    cks.forEach((c, i) => show(c, t, c22 + 3.6 + i * 0.5, { dy: 14, scale: 0.8, ease: Ease.back }));
    lClear.at(720, 150 + PHt + 104, { op: seg(t, c23 - 0.1, tC + 0.15), scale: lerp(0.9, 1, pr(t, c23 - 0.1, 0.5, Ease.back)) }); lClear.frame(t < tC ? Math.max(fr, fc + 0.5) : fc + 0.6);
    ten.style.opacity = seg(t, c23, tC + 0.15); ten.style.transform = `scale(${lerp(0.7, 1, pr(t, c23, 0.5, Ease.back))})`;

    // カード
    const co = seg(t, tC + 0.1, tE + 0.3);
    lCard.at(770, 150, { op: co * pr(t, tC + 2.0, 0.5), scale: lerp(0.85, 1, pr(t, tC + 2.0, 0.6, Ease.back)) }); lCard.frame(fr);
    cardTxt.style.opacity = co; cardTxt.style.transform = `translateX(${slide(t, tC + 0.3)}px)`;
    return { dark: true, note: REC._meta?.prod ? (REC.finish.local && t >= tF ? "※ この場面（写真 → 完了 → カード）は、API キーなしで動かしたときの録画です（写真の確認とカードの絵は見本）" : REC.card && t >= tC ? "※ このカードの場面だけ、API キーなしで動かしたときの録画です（絵は見本）" : "※ 画面は、公開中のアプリの録画です（町と人は架空のデモ。AI の答えは本物の Claude）") : "※ 画面はすべて実際のアプリの録画です（町と人は架空のデモ。AI の応答は、API キーなしのときの見本）" };
  };
} });
