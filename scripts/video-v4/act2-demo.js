// 第2幕「10分間」: 本物のアプリの録画で、隊長の3つの仕事（知らせる・割り振る・確かめる）を見せる。
// 終わりに、ほかの入口（ソロ活動・バトン・なかま）をテンポよく3つ。
ACTS.push({ from: "ask", to: "more", xf: 0.3, make(root) {
  const PW = 366, PY = 134;
  root.innerHTML = `
    <div class="full" style="background:linear-gradient(180deg,#d6e6f1 0%,#eef4f9 58%,#dfeaf2 100%)"></div>
    <svg class="abs" style="left:0;bottom:0" width="1920" height="300" viewBox="0 0 1920 300"><path d="M0 190 C300 120 520 210 820 160 C1120 110 1400 200 1920 130 L1920 300 L0 300 Z" fill="#fff" opacity=".75"/><path d="M0 240 C400 190 900 260 1300 215 C1600 185 1800 230 1920 215 L1920 300 L0 300 Z" fill="#fff"/></svg>
    <div class="step" id="a2step"><span class="chip"><b>1</b>知らせる</span><span class="chip"><b>2</b>割り振る</span><span class="chip"><b>3</b>確かめる</span></div>
    <div class="abs" id="a2clock" style="right:44px;top:30px;width:150px;height:150px">
      <svg width="150" height="150" viewBox="0 0 150 150"><circle cx="75" cy="75" r="62" fill="#fff" stroke="#d3e0ea" stroke-width="12"/><circle id="a2arc" cx="75" cy="75" r="62" fill="none" stroke="#e8834f" stroke-width="12" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" transform="rotate(-90 75 75)"/></svg>
      <div class="abs mono" id="a2time" style="left:0;right:0;top:40px;text-align:center;font-size:40px;font-weight:800;color:#1e3346">6:30</div>
      <div class="abs" id="a2min" style="left:0;right:0;top:88px;text-align:center;font-family:var(--sans);font-size:19px;font-weight:800;color:#c96a3a">0分</div>
    </div>
    <div class="full" id="a2s"></div>
    <div class="full" id="a2more" style="opacity:0;overflow:hidden"></div>
    <div class="full" id="a2go" style="opacity:0;background:radial-gradient(circle at 50% 50%, #ffb37f 0%, #e8834f 55%, #c96a3a 100%);display:grid;place-items:center"><div id="a2gotxt" style="font-size:420px;font-weight:900;letter-spacing:.02em;color:#fff;text-shadow:0 14px 0 rgba(120,50,20,.35)">GO!</div></div>`;
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
  const lRe = add(lens("reason", "a", { x: 8, y: 548, w: 374, h: 100 }, 1080));
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

  // ── 地図（チーム戦）──
  const pMap = add(phone("map", "a", { w: PW, label: lab("町の地図") }));
  const lMap = add(lens("map", "a", { x: 28, y: 178, w: 216, h: 190 }, 760));
  const teams = [["salvia", "サルビア", "#2F6FE4"], ["marigold", "マリーゴールド", "#FF8A3D"], ["lupinus", "ルピナス", "#9B5DE5"]];
  const teamTxt = panel(1500, 170, 400, `<div class="kick">3チーム戦</div>` + teams.map(([k, n, c], i) => `<div class="a2team" style="position:absolute;left:0;top:${60 + i * 150}px;display:flex;align-items:center;gap:14px">${mascot(SCARF[k], 120)}<span class="chip" style="background:${c};color:#fff;font-size:27px;padding:6px 20px">${n}</span></div>`).join("") +
    `<div id="a2shuf" style="position:absolute;left:0;top:530px;width:400px"><span class="chip" style="background:#1e3346;color:#fff;font-size:30px">🔀 毎週シャッフル</span><div class="body" style="font-size:28px;margin-top:12px;font-weight:700">個人の順位は出さない。<br>となりの人は、来週の仲間。</div></div>`);
  const teamEls = [...teamTxt.querySelectorAll(".a2team")], shuf = q("#a2shuf");

  // ── 確かめる ──
  const pFin = add(phone("finish", "a", { w: PW, label: lab("田中さん（手伝う人）") }));
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
  const lCard = add(lens("finish", "a", { x: 44, y: 128, w: 302, h: 424 }, 470));
  const cardTxt = panel(1300, 230, 600, `<div class="kick">お礼は、その朝だけのカード</div><div class="head" style="margin-top:10px;font-size:68px">${SPARK("#e8834f", 60)} が毎回、<br>ゼロから描く。</div>
    <div class="body" style="margin-top:22px;font-size:30px;white-space:nowrap">その朝の空・雪・人数・チームの色から、<br>SVG で描く。<br>描いたあと、自分で見て1回なおす。</div>
    <div class="body" style="margin-top:22px;font-size:21px;color:#7890a5">※ この録画の絵は、API キーなしで動かしたときの見本です</div>`);

  // ── ほかの入口: ソロ活動・バトン・なかま帳（色の帯が斜めに入れかわる）──
  const moreEl = q("#a2more"), goEl = q("#a2go"), goBig = q("#a2gotxt");
  const MORE = [
    { rec: "solo", line: "c51", color: "#2F6FE4", pale: "#dbe8ff", icon: "🧤", kick: "ひとりの日は", head: "ソロ活動", body: "自分の家の雪かき・道の見回り。<br>10分で、チームの点になる。" },
    { rec: "baton", line: "c52", color: "#FF8A3D", pale: "#ffe9d6", icon: "🎽", kick: "途中まででも", head: "バトン", body: "「続きをお願いします」と、<br>次の人へ渡せる。" },
    { rec: "nakama", line: "c53", color: "#9B5DE5", pale: "#eee2ff", icon: "👋", kick: "だれかと一緒に", head: "なかま", body: "前回の仲間とも、新しい人とも、ゆるく合流。<br>毎週、顔見知りが増えていく。" },
  ].filter((m) => REC[m.rec]).map((m, i) => {
    const el = $(`<div class="full" style="background:${m.pale}">
      <div class="abs" style="left:-200px;top:-200px;width:1100px;height:1500px;background:${m.color};opacity:.14;transform:rotate(12deg)"></div>
      <div class="abs a2mt" style="left:860px;top:210px;width:1000px">
        <div style="display:flex;align-items:center;gap:22px"><span style="display:inline-grid;place-items:center;width:110px;height:110px;border-radius:32px;background:${m.color};font-size:64px;box-shadow:0 14px 30px rgba(20,40,60,.25)">${m.icon}</span><span class="kick" style="font-size:40px;color:${m.color}">${m.kick}</span></div>
        <div style="font-size:190px;font-weight:900;line-height:1.15;color:#1e3346;margin-top:14px;white-space:nowrap">${m.head}</div>
        <div class="body" style="font-size:42px;font-weight:700;color:#3d566d;margin-top:10px">${m.body}</div>
        <div style="margin-top:26px;font-size:60px;font-weight:900;color:${m.color}">${i + 1}<span style="font-size:34px;color:#8aa0b3"> / 3</span></div>
      </div></div>`);
    const ph = phone(m.rec, "a", { w: 392 }); el.append(ph); moreEl.append(el);
    return { ...m, el, ph, txt: el.querySelector(".a2mt"), at: i === 0 ? T("more") : L(m.line) - 0.15, dur: REC[m.rec].seconds };
  });

  const tA = T("ask"), tR = T("ring"), tRe = T("reason"), tG = T("go"), tM = T("map"), tF = T("finish"), tC = T("card"), tE = E("card"), tMo = T("more"), tEnd = E("more");
  const c17 = L("c17"), c22 = L("c22"), c23 = L("c23");
  // 場面ごとの出入り（0〜1）と、横からすべりこむ動き
  const seg = (t, a, b) => win(t, a, a + 0.45, b - 0.3, b);
  const slide = (t, a) => (1 - pr(t, a, 0.6, Ease.out5)) * 70;
  const ringRec = (t) => kf(t, [[tR, 0.2], [c17 + 0.15, 3.9], [c17 + 0.6, 4.4], [c17 + 1.4, 7.9], [tRe, 11.9]], Ease.lin);
  const tapGo = tG + 0.85;
  return (t) => {
    sn.update(t, 0.7);
    // 10分の時計: 6:30（知らせる）→ 6:40（玄関が開く）
    const k10 = kf(t, [[c17, 0], [c23, 1]], Ease.lin);
    show(clock, t, tRe - 0.2, { dy: -20, out: tMo - 0.1, dOut: 0.2 });
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
    const rr = ringRec(t);
    pR.forEach((p, i) => { p.at(ringX[i], PY + (1 - pr(t, tR + i * 0.1, 0.6, Ease.out5)) * 60, { op: o }); p.frame(rr); });
    ["a", "b", "c"].forEach((k, i) => { const dt = rr - mk("ring", "arrive-" + k); waves[i].innerHTML = dt > 0 && o > 0.5 ? [0, 0.35, 0.7].map((d) => { const u = clamp((dt - d) / 1.3); return u > 0 && u < 1 ? `<i class="abs" style="left:${-190 - u * 46}px;top:${-392 - u * 46}px;width:${380 + u * 92}px;height:${784 + u * 92}px;border-radius:${56 + u * 30}px;border:${7 * (1 - u) + 2}px solid #e8834f;opacity:${(1 - u) * 0.8}"></i>` : ""; }).join("") : ""; });
    ringTxt.style.opacity = o; ringTxt.style.transform = `translateX(${slide(t, tR + 0.3)}px)`;
    const bd = rr - mk("ring", "arrive-b");
    bell.style.transform = `rotate(${bd > 0 && bd < 3 ? Math.sin(bd * 22) * 22 * Math.exp(-bd * 1.2) : 0}deg)`;

    // 割り振る
    o = seg(t, tRe, tG + 0.2);
    const re = kf(t, [[tRe, 1.0], [tG, 6.4]], Ease.lin);
    pRe.at(250 - slide(t, tRe), PY, { op: o }); pRe.frame(re);
    lRe.at(720, 250, { op: o * pr(t, tRe + 0.9, 0.5), scale: lerp(0.86, 1, pr(t, tRe + 0.9, 0.6, Ease.back)) }); lRe.frame(Math.max(re, 4.2));
    reTxt.style.opacity = o * pr(t, tRe + 0.7, 0.4); reCard.style.opacity = o * pr(t, L("c18") + 1.9, 0.5); reCard.style.transform = `translateY(${(1 - pr(t, L("c18") + 1.9, 0.6)) * 26}px)`;

    // 行く
    o = seg(t, tG, tM + 0.2);
    const gr = kf(t, [[tG, 1.0], [tapGo, mk("go", "go")], [tM, 6.2]], Ease.lin);
    pGa.at(380 - slide(t, tG), PY, { op: o }); pGa.frame(gr);
    pGc.at(1180 + slide(t, tG), PY, { op: o }); pGc.frame(gr);
    goTxt.style.opacity = o * pr(t, tapGo - 0.2, 0.3); arr.setAttribute("stroke-dashoffset", (1 - pr(t, tapGo + 0.1, 0.7, Ease.io)).toFixed(3));

    // 地図
    o = seg(t, tM, tF + 0.2);
    const mr = kf(t, [[tM, 2.2], [L("c20") + 1.4, 5.7], [tF, 28.6]], Ease.lin);
    pMap.at(250 - slide(t, tM), PY, { op: o }); pMap.frame(mr);
    lMap.at(700, 150, { op: o * pr(t, tM + 0.5, 0.5), scale: lerp(0.9, 1, pr(t, tM + 0.5, 0.6, Ease.back)) }); lMap.frame(mr);
    teamTxt.style.opacity = o;
    const c21 = L("c20") + (LE("c20") - L("c20")) * 0.55;
    const sw = pr(t, c21 + 0.2, 0.9, Ease.io), order = [[0, 1, 2], [2, 0, 1]];
    teamEls.forEach((e, i) => { const y = lerp(order[0][i], order[1][i], sw) * 150, x = Math.sin(sw * 3.14) * (i === 1 ? 50 : -40); e.style.transform = `translate(${x + slide(t, tM + 0.3 + i * 0.12)}px,${y - i * 150}px)`; e.style.opacity = pr(t, tM + 0.3 + i * 0.12, 0.4); });
    show(shuf, t, c21 + 0.1, { scale: 0.9, ease: Ease.back });

    // 確かめる → 10分
    o = seg(t, tF, tE);
    const fr = t < tC ? kf(t, [[tF, 1.0], [c22 + 1.0, mk("finish", "finish")], [c22 + 1.5, 3.0], [c23 - 0.4, 3.0], [c23 - 0.25, 3.25], [tC, 7.6]], Ease.lin) : kf(t, [[tC, 7.6], [tC + 0.9, mk("finish", "card")], [tE, 15.4]], Ease.lin);
    pFin.at(250 - slide(t, tF), PY, { op: o }); pFin.frame(fr);
    const po = seg(t, c22 + 1.3, tC + 0.15), wipe = pr(t, c22 + 2.5, 1.5, Ease.io);
    photo.style.opacity = po; photo.style.transform = `scale(${lerp(0.9, 1, pr(t, c22 + 1.3, 0.55, Ease.back))})`;
    aft.style.width = wipe * 100 + "%"; scan.style.left = `calc(${wipe * 100}% - 3px)`; scan.style.opacity = wipe > 0.01 && wipe < 0.99 ? 1 : 0;
    pl.textContent = wipe > 0.5 ? "雪かきのあと（この1枚を送る）" : "雪かきの前";
    checks.style.opacity = po;
    cks.forEach((c, i) => show(c, t, c22 + 3.6 + i * 0.5, { dy: 14, scale: 0.8, ease: Ease.back }));
    lClear.at(720, 150 + PHt + 104, { op: seg(t, c23 - 0.1, tC + 0.15), scale: lerp(0.9, 1, pr(t, c23 - 0.1, 0.5, Ease.back)) }); lClear.frame(Math.max(fr, 3.6));
    ten.style.opacity = seg(t, c23, tC + 0.15); ten.style.transform = `scale(${lerp(0.7, 1, pr(t, c23, 0.5, Ease.back))})`;

    // カード
    const co = seg(t, tC + 0.1, tE + 0.3);
    lCard.at(770, 150, { op: co * pr(t, tC + 2.0, 0.5), scale: lerp(0.85, 1, pr(t, tC + 2.0, 0.6, Ease.back)) }); lCard.frame(fr);
    cardTxt.style.opacity = co; cardTxt.style.transform = `translateX(${slide(t, tC + 0.3)}px)`;
    // 「行く」を押した瞬間: 画面いっぱいの GO!（0.5 秒）
    const gd = t - tapGo;
    goEl.style.opacity = gd >= 0 && gd < 0.62 ? win(gd, 0, 0.05, 0.4, 0.62) : 0;
    goBig.style.transform = `scale(${0.5 + Ease.out5(gd / 0.3) * 0.55 + Math.max(0, gd) * 0.25}) rotate(-4deg)`;

    // ほかの入口: 1つずつ、横からぱっと入れかわる
    moreEl.style.opacity = t >= tMo - 0.02 ? 1 : 0;
    MORE.forEach((m, i) => {
      const next = MORE[i + 1] ? MORE[i + 1].at : tEnd + 1;
      const k = Ease.out5((t - m.at) / 0.32);
      m.el.style.display = t >= m.at && t < next + 0.32 ? "block" : "none";
      m.el.style.zIndex = i + 1;
      m.el.style.clipPath = `polygon(${(1 - k) * 100}% 0, 100% 0, 100% 100%, ${(1 - k) * 112 - 12}% 100%)`;
      m.ph.at(330, 44 + (1 - Ease.back((t - m.at - 0.05) / 0.45)) * 90, { rot: -3 + k * 3 });
      m.ph.frame(kf(t, [[m.at, 0.7], [next, m.dur - 0.2]], Ease.lin));
      m.txt.style.transform = `translateX(${(1 - Ease.out5((t - m.at - 0.08) / 0.4)) * 160}px)`;
    });
    return { dark: true, note: "※ 画面はすべて実際のアプリの録画です（町と人は架空のデモ。AI の応答は、API キーなしのときの見本）" };
  };
} });
