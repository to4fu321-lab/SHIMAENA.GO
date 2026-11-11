// 第2幕のつづき「つながる」: バトン（途中まででも、次の人へ）と、なかま帳（一緒に雪かきをした人が残る。ひと冬で顔見知りが増える）。
// 11/11 本人「バトンや仲間の話もして欲しい、出会い繋がりができることを」。スマホの中は本物のアプリの録画。
ACTS.push({ from: "chat", to: "nakama", make(root) {
  const PW = 366, PY = 134;
  root.innerHTML = `
    <div class="full" style="background:linear-gradient(180deg,#fdebdc 0%,#fff6ee 55%,#fbe6d6 100%)"></div>
    <svg class="abs" style="left:0;bottom:0" width="1920" height="300" viewBox="0 0 1920 300"><path d="M0 200 C320 130 560 220 860 170 C1160 120 1440 210 1920 150 L1920 300 L0 300 Z" fill="#fff" opacity=".8"/><path d="M0 250 C400 200 900 270 1300 225 C1600 195 1800 240 1920 225 L1920 300 L0 300 Z" fill="#fff"/></svg>
    <div class="full" id="tbS"></div>`;
  const q = (s) => root.querySelector(s), stage = q("#tbS");
  const sn = snow(27, 70, { color: "#f0c9ad", size: 3.4 }); root.insertBefore(sn, stage);
  const add = (el) => { stage.append(el); return el; };
  const lab = (text) => `<span class="chip" style="position:relative;top:34px;background:#1e3346;color:#fff;font-size:22px;padding:5px 18px;z-index:5">${text}</span>`;
  const panel = (x, y, w, html) => add($(`<div class="abs" style="left:${x}px;top:${y}px;width:${w}px">${html}</div>`));
  const has = (r) => !!REC[r];
  const tB = T("baton"), tN = T("nakama"), tE = E("nakama");
  const c51 = L("c51"), c52 = L("c52"), c53 = c52 + (LE("c52") - c52) * 0.5, d53 = LE("c52") - c53;

  // ── 隊長トーク（迷ったら聞く。公開版では本物の Claude が、天気と道を確かめてから答える）──
  const tC = T("chat"), tS = T("solo"), c60 = L("c60"), e60 = LE("c60"), c61 = L("c61"), e61 = LE("c61");
  const pC = has("chat") ? add(phone("chat", "a", { w: PW, label: lab("田中さん → 隊長トーク") })) : null;
  const cTxt = panel(690, 150, 1160, `<div class="kick">隊長トーク</div><div class="head" style="margin-top:8px;font-size:74px;white-space:nowrap">迷ったら、隊長に聞く。</div>`);
  const cm = pC ? REC.chat.marks : {};
  const cAns = cm.answer?.box ? (() => { const b = cm.answer.box, pad = 10, x0 = Math.max(0, b.x - pad), y0 = Math.max(50, b.y - pad), x1 = Math.min(390, b.x + b.w + pad), y1 = Math.min(770, b.y + b.h + pad); return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; })() : null;
  const cW = cAns ? Math.round(cAns.w * Math.min(560 / cAns.w, 380 / cAns.h)) : 0;
  const lAns = cAns ? add(lens("chat", "a", cAns, cW)) : null;
  const cQ = panel(700, 318, 700, `<div style="display:inline-block;white-space:nowrap;background:#b9e88f;color:#1e3346;border-radius:28px 28px 6px 28px;padding:14px 28px;font-family:var(--sans);font-size:32px;font-weight:800;box-shadow:0 12px 30px rgba(60,90,40,.18)">「10分しかないけど、行ってもいい？」</div>`);
  const cSteps = ["天気と道を確かめる", "今朝の町を調べる", "返事を書く"].map((w, i) => panel(1320, 322 + i * 84, 540, `<span class="chip" style="background:#fff;color:#1e3346;font-size:30px;padding:12px 26px;box-shadow:0 10px 24px rgba(120,70,30,.14)"><b style="color:#c96a3a;margin-right:10px">${i + 1}</b>${w}</span>`));
  const cLab = panel(700, 418, 600, `<span class="chip" style="background:#1e3346;color:#fff;font-size:24px;padding:6px 20px">隊長の答え（そのままの画面）</span>`);
  const cRule = panel(1320, 600, 540, `<div class="body" style="font-size:25px;color:#7a6a5e">段取りと作業の話だけ。<br>体調や医療のことは、判断しません。</div>`);
  const cSend = cm.send ? cm.send.t : 5, cAt = cm.answer ? cm.answer.t : cSend + 4, vSend = c60 + 0.9, vAns = c60 + (e60 - c60) * 0.6;
  const cPts = pC ? [[tC, (cm.focus?.t ?? 2) - 0.6], [vSend - 0.45, (cm.typed?.t ?? 4) + 0.1], [vSend, cSend], [vSend + 0.5, cSend + 0.9], [vAns - 0.45, cSend + 7.5], [vAns - 0.43, cAt - 0.5], [tS + 0.5, cAt + (tS + 0.5 - vAns) + 0.4]] : [];

  // ── ソロミッション（行けない朝は、自分の家の前でもいい）──
  const pS = has("solo") ? add(phone("solo", "a", { w: PW, label: lab("田中さんの「ソロミッション」") })) : null;
  const sTxt = panel(690, 150, 1160, `<div class="kick">ソロミッション</div><div class="head" style="margin-top:8px;font-size:66px;white-space:nowrap">行けない朝は、<span style="color:#c96a3a">ひとりでできること</span>を。</div>`);
  const sm = pS ? REC.solo.marks : {};
  // ソロでできる2つ: 自分の家の雪かき／危ない道を知らせる（点はアプリの実数）
  const sOpt = (id, icon, title, sub, a, b) => `<div class="card" id="${id}" style="position:relative;flex:1;padding:24px 30px"><div style="display:flex;align-items:center;gap:16px"><span style="font-size:64px;line-height:1">${icon}</span><div><div style="font-family:var(--maru);font-size:42px;font-weight:900;color:#1e3346;white-space:nowrap">${title}</div><div style="font-family:var(--sans);font-size:24px;font-weight:700;color:#7a6a5e;margin-top:2px">${sub}</div></div></div>
      <div style="display:flex;gap:26px;margin-top:14px;font-family:var(--maru);font-weight:900;line-height:1.05"><div style="color:#c96a3a"><span style="font-size:40px">+</span><span class="tbSn" data-n="${a}" style="font-size:96px">0</span><span style="font-size:34px"> 羽</span></div><div style="color:#2F6FE4"><span style="font-size:40px">チーム +</span><span class="tbSn" data-n="${b}" style="font-size:96px">0</span><span style="font-size:34px"> 点</span></div></div></div>`;
  const sNum = panel(700, 330, 1150, `<div style="display:flex;gap:30px">${sOpt("tbSa", "🧹", "自分の家の雪かき", "写真を撮って報告", 8, 5)}${sOpt("tbSb2", "📷", "危ない道を知らせる", "つるつる・道が細い など", 5, 3)}</div>`);
  const sBar = panel(700, 690, 1150, `<div style="font-family:var(--sans);font-size:26px;font-weight:800;color:#4a637a;margin-bottom:10px">チームの得点（みんなの10分 ＋ ひとりの雪かき・知らせ）</div><div style="height:30px;border-radius:15px;background:#fff;overflow:hidden;box-shadow:inset 0 0 0 2px rgba(47,111,228,.2)"><div id="tbSb" style="height:100%;width:0;border-radius:15px;background:linear-gradient(90deg,#2F6FE4,#7FA6F0)"></div></div>`);
  const sSteps = panel(700, 800, 1150, `<div class="body" style="font-size:27px;color:#7a6a5e">それも、町の力になります。</div>`);
  const sns = [...sNum.querySelectorAll(".tbSn")], sA = q("#tbSa"), sB2 = q("#tbSb2");
  const sb = q("#tbSb");
  const sGo = sm.go ? sm.go.t : 6, vGo = c61 + (e61 - c61) * 0.42;
  // 録画は「道の危険を知らせる」のカードから始まり、次へ →「自分の家の雪かき」→ GO。語りに合わせて、家 → 危ない道の順に光らせる
  const vRoad = c61 + (e61 - c61) * 0.62, sNext = sm.next0?.t ?? 2;
  const sPts = pS ? [[tS, 0.3], [c61 + 0.2, sNext - 0.3], [c61 + 0.9, (sm.card?.t ?? 3) + 0.2], [vGo - 0.4, sGo - 0.4], [vGo + 0.5, sGo + 0.5], [tB + 0.5, (sm.started?.t ?? sGo + 3) + 1.5]] : [];

  // ── バトン ──
  const pA = has("baton") ? add(phone("baton", "a", { w: PW, label: lab("田中さん（途中で時間切れ）") })) : null;
  const pB = has("batonget") ? add(phone("batonget", "b", { w: PW, label: lab("近所の人（あとから通る）") })) : null;
  const bTxt = panel(690, 190, 560, `<div class="kick">次の人へ、バトン</div><div class="head" style="margin-top:10px;font-size:74px">途中まででも、<br>いい。次の人へ。</div>
    <div class="body" style="margin-top:22px;font-size:31px">「ここまで雪かきしました」<br>「続きをお願いします」<br>名前は出ません。</div>`);
  const fly = add($(`<svg class="abs" style="left:640px;top:600px;overflow:visible" width="640" height="240" viewBox="0 0 640 240">
      <path id="tbPath" d="M0 150 C160 30 480 30 640 150" fill="none" stroke="#e8834f" stroke-width="9" stroke-linecap="round" stroke-dasharray="2 20" opacity=".7"/>
      <g id="tbBaton"><rect x="-44" y="-15" width="88" height="30" rx="15" fill="#e8834f"/><rect x="-44" y="-15" width="26" height="30" rx="13" fill="#ffd59a"/><rect x="18" y="-15" width="26" height="30" rx="13" fill="#ffd59a"/></g></svg>`));
  const baton = q("#tbBaton"), path = q("#tbPath");
  const got = panel(760, 770, 500, `<span class="chip" style="background:#1e7a52;color:#fff;font-size:30px;padding:10px 26px">✓ 続きを、引き受ける</span>`);
  // 押す瞬間を、語りに合わせて等しい間隔に並べる（「渡す」は「バトンを渡せば」の所で）
  const bm = pA ? ["tab", "give", "msg", "half", "pass"].filter((n) => REC.baton.marks[n]).map((n) => mk("baton", n)) : [];
  const vPass = c51 + (LE("c51") - c51) * 0.6, v0 = tB + 0.35;
  const bPts = [];
  bm.forEach((m, i) => { const v = lerp(v0, vPass, bm.length > 1 ? i / (bm.length - 1) : 1); bPts.push([v - 0.4, m - 0.4], [v + 0.3, m + 0.3]); });
  if (bm.length) { const last = bm[bm.length - 1], end = REC.baton.marks.passed ? mk("baton", "passed") : last + 3; bPts.push([vPass + 0.32, Math.max(last + 0.3, end - 0.6)], [tN + 0.5, end + 1.2]); }
  const gTab = pB && REC.batonget.marks.tab ? mk("batonget", "tab") : 1.5;

  // ── なかま帳 ──
  const pN = has("nakama") ? add(phone("nakama", "a", { w: PW, label: lab("田中さんの「なかま帳」") })) : null;
  const nTxt = panel(720, 150, 1120, `<div class="kick">なかま帳</div><div class="head" style="margin-top:8px;font-size:62px;white-space:nowrap">知らない人が、ひと冬で<span style="color:#c96a3a">顔見知り</span>に。</div>`);
  // 町の人たち（まんなかが自分）。週が変わるたびにチームが入れかわり、一緒に雪かきをした人と線でつながっていく
  const CX = 1290, CY = 650, N = 11, TEAMS = ["salvia", "marigold", "lupinus"], COL = { salvia: "#2F6FE4", marigold: "#FF8A3D", lupinus: "#9B5DE5" };
  const pos = Array.from({ length: N }, (_, i) => { const a = (-90 + (i + 0.5) * (360 / N)) * Math.PI / 180; return { x: CX + Math.cos(a) * 470, y: CY + Math.sin(a) * 175 }; });
  const WEEKS = [[1, 4, 8], [0, 6, 9], [3, 5, 10], [2, 7]]; // その週、同じチームになる人
  const web = add($(`<svg class="abs" style="left:0;top:0;overflow:visible" width="1920" height="1080">${pos.map((p, i) => `<line class="tbl" x1="${CX}" y1="${CY}" x2="${p.x}" y2="${p.y}" stroke="#e8834f" stroke-width="7" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/>`).join("")}</svg>`));
  const lines = [...web.querySelectorAll(".tbl")];
  const birds = pos.map((p, i) => add($(`<div class="abs" style="left:${p.x - 55}px;top:${p.y - 62}px;width:110px">${TEAMS.map((k) => `<div class="tbv" style="position:absolute;left:0;top:0">${mascot(SCARF[k], 110)}</div>`).join("")}<div style="height:110px"></div></div>`)));
  const me = add($(`<div class="abs" style="left:${CX - 80}px;top:${CY - 92}px;width:160px">${TEAMS.map((k) => `<div class="tbv" style="position:absolute;left:0;top:0">${mascot(SCARF[k], 160, "happy")}</div>`).join("")}<div style="height:160px"></div><div style="text-align:center;margin-top:-6px"><span class="chip" style="background:#1e3346;color:#fff;font-size:24px;padding:4px 18px">あなた</span></div></div>`));
  const weekEl = panel(720, 306, 220, `<span class="chip" id="tbWk" style="background:#fff;color:#1e3346;font-size:34px;padding:10px 26px;box-shadow:0 10px 24px rgba(120,70,30,.18)">第1週</span>`);
  const count = panel(960, 290, 800, `<div style="font-family:var(--sans);font-size:32px;font-weight:800;color:#4a637a;white-space:nowrap">顔と名前のわかる人 <span id="tbCnt" style="font-family:var(--maru);font-size:84px;font-weight:900;line-height:1;color:#c96a3a;margin-left:10px">0</span><span style="font-size:40px;font-weight:900;color:#c96a3a"> 人</span></div>`);
  const wk = q("#tbWk"), cnt = q("#tbCnt");
  const nm = pN ? ["tab", "again", "next"].filter((n) => REC.nakama.marks[n]).map((n) => mk("nakama", n)) : [];
  const nV = [tN + 0.7, c52 + (LE("c52") - c52) * 0.75, c53 + d53 * 0.5];
  const nPts = [];
  nm.forEach((m, i) => { nPts.push([nV[i] - 0.4, m - 0.4], [nV[i] + 0.5, m + 0.5]); });
  if (nm.length) nPts.push([tE + 0.5, nm[nm.length - 1] + 2.4]);
  // 週が進む（語りの「チームは毎週シャッフル」から）
  const wT = (w) => c53 + 0.15 + w * (d53 + 0.5) / 4;
  const seg = (t, a, b) => win(t, a, a + 0.45, b - 0.3, b);
  const slide = (t, a) => (1 - pr(t, a, 0.6, Ease.out5)) * 70;
  return (t) => {
    sn.update(t, 0.6);
    // 隊長トーク
    let o = seg(t, tC - 0.1, tS + 0.25);
    if (pC) { pC.at(250 - slide(t, tC), PY, { op: o }); pC.frame(kf(t, cPts, Ease.lin)); }
    cTxt.style.opacity = o; cTxt.style.transform = `translateX(${slide(t, tC + 0.15)}px)`;
    show(cQ, t, vSend + 0.1, { scale: 0.8, ease: Ease.back }); cQ.style.opacity = o * pr(t, vSend + 0.1, 0.3);
    cSteps.forEach((el, i) => { show(el, t, vSend + 0.55 + i * 0.42, { dx: 30, dy: 0 }); el.style.opacity = o * pr(t, vSend + 0.55 + i * 0.42, 0.3) * (t > vAns ? 0.55 : 1); });
    show(cLab, t, vAns - 0.1, { dy: 10 }); cLab.style.opacity = o * pr(t, vAns - 0.1, 0.3);
    if (lAns) { lAns.at(700, 470, { op: o * pr(t, vAns, 0.35), scale: lerp(0.85, 1, pr(t, vAns, 0.55, Ease.back)) }); lAns.frame(Math.max(kf(t, cPts, Ease.lin), cAt + 0.3)); }
    show(cRule, t, vAns + 0.5, { dy: 12 }); cRule.style.opacity = o * pr(t, vAns + 0.5, 0.3);

    // ソロ
    o = seg(t, tS, tB + 0.25);
    if (pS) { pS.at(250 - slide(t, tS), PY, { op: o }); pS.frame(kf(t, sPts, Ease.lin)); }
    sTxt.style.opacity = o; sTxt.style.transform = `translateX(${slide(t, tS + 0.15)}px)`;
    show(sNum, t, c61 + 0.2, { dy: 30 }); sNum.style.opacity = o * pr(t, c61 + 0.2, 0.35);
    const kA = pr(t, c61 + 0.9, 1.0, Ease.out5), kB = pr(t, vRoad, 1.0, Ease.out5);
    sns.forEach((el, i) => (el.textContent = Math.round(+el.dataset.n * (i < 2 ? kA : kB))));
    sA.style.transform = `scale(${1 + Math.max(0, 1 - Math.abs(t - c61 - 1.1) * 2.5) * 0.05})`; sB2.style.transform = `scale(${1 + Math.max(0, 1 - Math.abs(t - vRoad - 0.2) * 2.5) * 0.05})`;
    sB2.style.opacity = 0.45 + 0.55 * pr(t, vRoad - 0.2, 0.4);
    show(sBar, t, c61 + 1.2, { dy: 16 }); sBar.style.opacity = o * pr(t, c61 + 1.2, 0.3); sb.style.width = lerp(40, 40 + 14 * kA + 9 * kB, 1) * pr(t, c61 + 1.2, 0.6) + "%";
    show(sSteps, t, vRoad + 1.0, { dy: 16 }); sSteps.style.opacity = o * pr(t, vRoad + 1.0, 0.3);

    // バトン
    o = seg(t, tB, tN + 0.25);
    if (pA) { pA.at(250 - slide(t, tB), PY, { op: o }); pA.frame(kf(t, bPts, Ease.lin)); }
    if (pB) { pB.at(1300 + slide(t, tB + 0.2), PY, { op: o * (0.45 + 0.55 * pr(t, vPass + 0.7, 0.4)) }); pB.frame(kf(t, [[vPass + 0.6, 0.2], [vPass + 0.9, gTab - 0.3], [vPass + 1.6, gTab + 0.5], [tN + 0.5, gTab + 3.2]], Ease.lin)); }
    bTxt.style.opacity = o; bTxt.style.transform = `translateX(${slide(t, tB + 0.15)}px)`;
    const fk = pr(t, vPass + 0.12, 0.85, Ease.io);
    fly.style.opacity = o * pr(t, tB + 0.5, 0.4);
    const pt = path.getPointAtLength(path.getTotalLength() * fk);
    baton.setAttribute("transform", `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)}) rotate(${(-30 + fk * 60 + Math.sin(fk * 9) * 8).toFixed(1)}) scale(${1 + Math.sin(fk * 3.14) * 0.35})`);
    show(got, t, vPass + 1.25, { scale: 0.8, ease: Ease.back }); got.style.opacity = o * pr(t, vPass + 1.25, 0.3);

    // なかま帳
    o = seg(t, tN, tE + 0.3);
    if (pN) { pN.at(250 - slide(t, tN), PY, { op: o }); pN.frame(kf(t, nPts, Ease.lin)); }
    nTxt.style.opacity = o; nTxt.style.transform = `translateX(${slide(t, tN + 0.15)}px)`;
    const w = t < wT(0) ? -1 : Math.min(3, Math.floor((t - wT(0)) / ((d53 + 0.5) / 4)));
    let met = 0;
    pos.forEach((p, i) => {
      const wi = WEEKS.findIndex((g) => g.includes(i)), k = wi <= w && wi >= 0 ? pr(t, wT(wi) + 0.1 + WEEKS[wi].indexOf(i) * 0.1, 0.45, Ease.io) : 0;
      if (k > 0.5) met++;
      lines[i].setAttribute("stroke-dashoffset", (1 - k).toFixed(3)); lines[i].setAttribute("opacity", (o * (0.35 + 0.65 * (wi === w ? 1 : 0.5))).toFixed(2));
      // スカーフの色（その週のチーム）: 同じチームの週は自分と同じ色
      const myTeam = (Math.max(0, w)) % 3, team = wi === w ? myTeam : (i + Math.max(0, w) * 2 + 1 + (i % 2)) % 3 === myTeam ? (myTeam + 1) % 3 : (i + Math.max(0, w) * 2 + 1 + (i % 2)) % 3;
      [...birds[i].querySelectorAll(".tbv")].forEach((v, j) => (v.style.opacity = j === team ? 1 : 0));
      const pop = wi === w ? Math.max(0, 1 - Math.abs(t - wT(wi) - 0.35) * 3) : 0;
      birds[i].style.opacity = o * pr(t, tN + 0.3 + i * 0.04, 0.4) * (k > 0 ? 1 : 0.5);
      birds[i].style.transform = `translateY(${Math.sin(t * 2 + i) * 4 - pop * 16}px) scale(${1 + pop * 0.15})`;
    });
    [...me.querySelectorAll(".tbv")].forEach((v, j) => (v.style.opacity = j === Math.max(0, w) % 3 ? 1 : 0));
    me.style.opacity = o * pr(t, tN + 0.3, 0.4); me.style.transform = `translateY(${Math.sin(t * 2.2) * 4}px)`;
    web.style.opacity = o;
    weekEl.style.opacity = o * pr(t, c53 - 0.1, 0.3); wk.textContent = w >= 3 ? "ひと冬" : `第${Math.max(0, w) + 1}週`;
    wk.style.transform = `scale(${1 + Math.max(0, 1 - Math.abs(t - wT(Math.max(0, w)) - 0.15) * 5) * 0.2})`;
    count.style.opacity = o * pr(t, c53 - 0.1, 0.3); cnt.textContent = met;
    return { dark: true, note: t < tS ? (REC._meta?.prod ? "※ スマホの中は、公開中のアプリの録画です（隊長の答えは本物の Claude。待ち時間は早送り）" : "※ スマホの中は実際のアプリの録画です（隊長の答えは、API キーなしのときの見本）") : t < tN ? "※ スマホの中は実際のアプリの録画です" : "※ スマホの中は実際のアプリの録画です。右の図は、ひと冬で知り合いが増えていくイメージ" };
  };
} });
