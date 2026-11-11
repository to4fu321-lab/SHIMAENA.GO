// 第1幕「静かな朝」: あいさつ → 町の朝（課題）→ 数字 → きっかけ → 題字。ひとつの町を、カメラが動いていく。
ACTS.push({ from: "hello", to: "title", make(root) {
  const G = 830, W = 4200, LONE = 4;
  const r = rng(11);
  const WALL = ["#4a5f76", "#56667a", "#63596c", "#48636a", "#5d6675", "#52607e"], COAT = ["#c8553d", "#3f7cac", "#e0a43b", "#5b8c5a", "#8a5fa8", "#d9825b", "#2f6f8f", "#b5524f"];
  const houses = Array.from({ length: 9 }, (_, i) => ({ i, cx: 340 + i * 440, w: 250 + r() * 60, h: 150 + r() * 40, rh: 80 + r() * 36, wall: WALL[i % WALL.length], coat: COAT[i % COAT.length], hat: COAT[(i + 3) % COAT.length], side: i % 2 ? -1 : 1, ph: r() * 6.28, sp: 1.5 + r() * 0.5 }));

  // ── 絵（世界の座標 4200×1080）──
  const base = [], lights = [];
  // 遠くの山と木
  base.push(`<path d="M0 ${G - 150} C400 ${G - 330} 700 ${G - 250} 1100 ${G - 300} C1500 ${G - 380} 1900 ${G - 210} 2300 ${G - 290} C2800 ${G - 400} 3300 ${G - 230} 3700 ${G - 300} C3900 ${G - 330} 4100 ${G - 260} ${W} ${G - 280} L${W} ${G} L0 ${G} Z" fill="#2d4560"/>`);
  for (let k = 0; k < 46; k++) { const x = r() * W, s = 0.7 + r() * 0.9, y = G - 4; base.push(`<g transform="translate(${x.toFixed(0)} ${y}) scale(${s.toFixed(2)})"><path d="M0 -150 L34 -84 L18 -84 L44 -34 L-44 -34 L-18 -84 L-34 -84 Z" fill="#233a50"/><path d="M0 -150 L20 -112 L8 -114 L0 -124 L-8 -114 L-20 -112 Z" fill="#dfe9f1" opacity=".8"/><rect x="-5" y="-34" width="10" height="34" fill="#1b2d3f"/></g>`); }
  // 地面
  base.push(`<rect x="0" y="${G}" width="${W}" height="${1080 - G + 400}" fill="url(#gnd)"/>`);
  base.push(`<rect x="0" y="${G + 150}" width="${W}" height="400" fill="#9fb2c4" opacity=".55"/>`);
  for (let x = 0; x < W; x += 150) base.push(`<ellipse cx="${x + r() * 60}" cy="${G + 150}" rx="${90 + r() * 40}" ry="${16 + r() * 10}" fill="#eef4f9"/>`);
  for (const h of houses) {
    const { cx, w, rh, i } = h, top = G - h.h, lone = i === LONE, dx = cx + w * 0.14 * h.side;
    // 屋根の雪・壁・窓・ドア
    base.push(`<g>
      <rect x="${cx - w / 2}" y="${top}" width="${w}" height="${h.h}" fill="${h.wall}"/>
      <rect x="${cx - w / 2}" y="${top}" width="${w}" height="16" fill="#000" opacity=".16"/>
      <rect x="${cx + w * 0.22 * -h.side - 14}" y="${top - rh * 0.72}" width="28" height="${rh * 0.5}" fill="#3a4a5c"/><rect x="${cx + w * 0.22 * -h.side - 19}" y="${top - rh * 0.72 - 10}" width="38" height="13" rx="6" fill="#f2f7fb"/>
      <polygon points="${cx - w / 2 - 24},${top} ${cx},${top - rh} ${cx + w / 2 + 24},${top}" fill="#2c3d50"/>
      <path d="M${cx - w / 2 - 34} ${top + 6} L${cx} ${top - rh - 16} L${cx + w / 2 + 34} ${top + 6} L${cx + w / 2 + 14} ${top + 4} L${cx} ${top - rh + 14} L${cx - w / 2 - 14} ${top + 4} Z" fill="#f2f7fb" stroke="#f2f7fb" stroke-width="10" stroke-linejoin="round"/>
      <path d="M${cx - w / 2 - 14} ${top + 9} L${cx} ${top - rh + 19} L${cx + w / 2 + 14} ${top + 9}" fill="none" stroke="#b9cbdb" stroke-width="5" stroke-linecap="round" opacity=".8"/>
      <rect x="${cx - h.side * w * 0.2 - 36}" y="${top + 44}" width="72" height="60" rx="5" fill="#17232f"/>
      <rect x="${dx - 27}" y="${G - 92}" width="54" height="92" rx="4" fill="#27333f"/><circle cx="${dx + 16}" cy="${G - 46}" r="3.5" fill="#c9a66b"/>
      <rect x="${dx - 38}" y="${G - 100}" width="76" height="9" rx="4" fill="#f2f7fb"/>
    </g>`);
    const wx = cx - h.side * w * 0.2;
    lights.push(`<g id="win${i}" opacity="0"><ellipse cx="${wx}" cy="${top + 74}" rx="150" ry="120" fill="url(#glow)"/><rect x="${wx - 36}" y="${top + 44}" width="72" height="60" rx="5" fill="#ffd596"/><path d="M${wx} ${top + 44} V${top + 104} M${wx - 36} ${top + 74} H${wx + 36}" stroke="#b9853f" stroke-width="4"/>${lone ? "" : `<circle cx="${wx + 4}" cy="${top + 84}" r="11" fill="#6b4a2a"/><path d="M${wx - 14} ${top + 104} q18 -22 36 0 Z" fill="#6b4a2a"/>`}</g>`);
    if (lone) {
      // 雪かきをする人のいない家: ドアまで雪。足あとなし
      base.push(`<path d="M${cx - w / 2 - 60} ${G + 6} C${cx - w / 4} ${G - 58} ${dx - 40} ${G - 66} ${dx + 10} ${G - 62} C${dx + 90} ${G - 56} ${cx + w / 2 + 20} ${G - 30} ${cx + w / 2 + 80} ${G + 6} Z" fill="#f4f8fb"/><path d="M${cx - w / 4} ${G - 36} C${dx - 30} ${G - 54} ${dx + 40} ${G - 52} ${cx + w / 2} ${G - 22}" fill="none" stroke="#c9d8e5" stroke-width="4" stroke-linecap="round" opacity=".7"/>`);
    } else {
      // 雪かきをした道と、よけた雪の山
      base.push(`<polygon points="${dx - 30},${G} ${dx + 30},${G} ${dx + 58},${G + 150} ${dx - 58},${G + 150}" fill="#8fa5b8" opacity=".55"/><ellipse cx="${dx - 96}" cy="${G + 30}" rx="62" ry="34" fill="#f4f8fb"/><ellipse cx="${dx + 100}" cy="${G + 26}" rx="52" ry="28" fill="#f4f8fb"/>`);
    }
  }
  // 街灯
  for (let k = 0; k < 5; k++) { const x = 560 + k * 880; base.push(`<rect x="${x - 4}" y="${G - 250}" width="8" height="270" fill="#2a3a4b"/><rect x="${x - 4}" y="${G - 254}" width="46" height="8" rx="4" fill="#2a3a4b"/>`); lights.push(`<g class="lampg"><ellipse cx="${x + 36}" cy="${G - 150}" rx="170" ry="210" fill="url(#glow)" opacity=".55"/><circle cx="${x + 36}" cy="${G - 244}" r="9" fill="#ffe2b0"/></g>`); }
  // 雪かきをする人（ひとりずつ）
  const people = houses.filter((h) => h.i !== LONE).map((h) => {
    const px = h.cx + h.w * 0.14 * h.side - h.side * 4, py = G + 78, f = h.side;
    // 人: 帽子（ぼんぼん）・マフラー・ミトン・長ぐつ。両手でスコップを持って、雪をすくって横へ投げる
    const dark = mixc(h.coat, "#101820", 0.28), scarf = h.hat, mitt = mixc(h.hat, "#ffffff", 0.25);
    return { h, px, py, f, html: `<g id="p${h.i}" transform="translate(${px} ${py}) scale(${f * 1.34} 1.34)">
      <ellipse cx="2" cy="4" rx="46" ry="9" fill="#1c3046" opacity=".3"/>
      <g class="lean">
        <path d="M-11 -46 L-15 -8" stroke="#243446" stroke-width="16" stroke-linecap="round"/><path d="M9 -46 L15 -8" stroke="#2c3e52" stroke-width="16" stroke-linecap="round"/>
        <path d="M-27 -12 h20 q8 0 8 8 v6 h-28 Z" fill="#161f29"/><path d="M5 -12 h20 q8 0 8 8 v6 h-28 Z" fill="#1b2631"/>
        <path d="M-27 -110 Q-33 -72 -27 -42 Q0 -30 27 -42 Q34 -76 25 -110 Q0 -124 -27 -110 Z" fill="${h.coat}"/>
        <path d="M-27 -54 Q0 -43 27 -54" fill="none" stroke="#000" stroke-opacity=".17" stroke-width="5"/>
        <circle cx="12" cy="-92" r="2.6" fill="#fff" opacity=".55"/><circle cx="13" cy="-76" r="2.6" fill="#fff" opacity=".55"/>
        <g class="tail"><path d="M-16 -112 l-17 25 l12 6 l13 -24 Z" fill="${mixc(scarf, "#101820", 0.2)}"/></g>
        <rect x="-23" y="-123" width="47" height="16" rx="8" fill="${scarf}"/>
        <circle cx="3" cy="-143" r="23.5" fill="#f3dccb"/>
        <path d="M-21.5 -147 Q-21 -174 4 -174 Q28 -174 27.5 -148 Z" fill="${h.hat}"/><rect x="-24" y="-155" width="54" height="12" rx="6" fill="${mixc(h.hat, "#ffffff", 0.3)}"/><circle cx="3" cy="-178" r="8.5" fill="#fff"/>
        <circle cx="14.5" cy="-141" r="2.9" fill="#27323f"/><ellipse cx="17" cy="-132.5" rx="5.2" ry="3.2" fill="#f0a5a5" opacity=".75"/><path d="M12 -127.5 q4 2.6 8 0" fill="none" stroke="#27323f" stroke-width="2" stroke-linecap="round"/>
        <g class="arm">
          <path d="M-6 -100 Q6 -80 20 -58" fill="none" stroke="${dark}" stroke-width="15" stroke-linecap="round"/>
          <line x1="6" y1="-74" x2="80" y2="-8" stroke="#8a6a4a" stroke-width="7" stroke-linecap="round"/>
          <path d="M67 -21 l31 15 l-12 21 l-31 -15 Z" fill="#d5e0e9" stroke="#9fb1c1" stroke-width="2.5" stroke-linejoin="round"/>
          <circle cx="20" cy="-60" r="9.5" fill="${mitt}"/>
          <path d="M10 -102 Q36 -88 46 -40" fill="none" stroke="${h.coat}" stroke-width="15" stroke-linecap="round"/><circle cx="46" cy="-38" r="9.5" fill="${mitt}"/>
        </g>
        <g class="breath" fill="#fff"><circle cx="34" cy="-136" r="5"/><circle cx="44" cy="-142" r="7"/><circle cx="57" cy="-150" r="9"/></g>
      </g>
      <circle class="puff" cx="0" cy="0" r="9" fill="#fff"/></g>` };
  });
  const defs = `<defs><linearGradient id="gnd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9f0f6"/><stop offset="1" stop-color="#c3d2df"/></linearGradient><radialGradient id="glow"><stop offset="0" stop-color="#ffd596" stop-opacity=".75"/><stop offset="1" stop-color="#ffd596" stop-opacity="0"/></radialGradient></defs>`;
  const svg = (inner) => `<svg class="abs" width="${W}" height="1500" viewBox="0 0 ${W} 1500" style="left:0;top:0;overflow:visible">${defs}${inner}</svg>`;

  root.innerHTML = `
    <div class="full" id="a1sky"></div>
    <div class="full" id="a1stars"></div>
    <div class="abs" id="a1world" style="left:0;top:0;width:${W}px;height:1500px;transform-origin:0 0">${svg(base.join("") + people.map((p) => p.html).join(""))}</div>
    <div class="full" id="a1tint" style="mix-blend-mode:multiply"></div>
    <div class="abs" id="a1lights" style="left:0;top:0;width:${W}px;height:1500px;transform-origin:0 0">${svg(lights.join("") + `<g id="a1arcs"></g><g id="a1rings"></g>`)}<div class="abs" id="a1cap2"></div></div>
    <div class="full" id="a1spot"></div>
    <div class="full" id="a1dim" style="background:#08111b;opacity:0"></div>
    <div class="full" id="a1fg"></div>
    <div class="full" id="a1txt"></div>`;
  const q = (s) => root.querySelector(s);
  const sky = q("#a1sky"), stars = q("#a1stars"), world = q("#a1world"), tint = q("#a1tint"), lightsEl = q("#a1lights"), spot = q("#a1spot"), dim = q("#a1dim"), fg = q("#a1fg"), txt = q("#a1txt");
  { const rs = rng(5); stars.innerHTML = Array.from({ length: 90 }, () => `<i class="abs" style="left:${rs() * 1920}px;top:${rs() * 560}px;width:${1.5 + rs() * 2.5}px;height:${1.5 + rs() * 2.5}px;border-radius:50%;background:#fff;opacity:${0.3 + rs() * 0.6}"></i>`).join(""); }
  const sn = snow(3, 240, { size: 4.6 }), snFar = snow(8, 200, { size: 2.2, min: 1, speed: 0.6 });
  root.insertBefore(snFar, world); root.insertBefore(sn, fg);
  const P = people.map((p) => { const g = q("#p" + p.h.i); return { ...p, g, lean: g.querySelector(".lean"), arm: g.querySelector(".arm"), puff: g.querySelector(".puff"), breath: g.querySelector(".breath"), tail: g.querySelector(".tail") }; });
  const wins = houses.map((h) => q("#win" + h.i));
  const lampg = [...root.querySelectorAll(".lampg")];

  // ── あいさつの前景: 雪の枝と隊長 ──
  fg.innerHTML = `<div class="abs" id="a1branch" style="left:0;top:0;width:1920px;height:1080px"><svg width="1920" height="1080" viewBox="0 0 1920 1080" style="overflow:visible">
      <path d="M-60 820 C200 800 420 760 640 716 C820 682 980 668 1120 640" fill="none" stroke="#3a2c26" stroke-width="44" stroke-linecap="round"/>
      <path d="M640 716 C760 640 820 560 850 470" fill="none" stroke="#3a2c26" stroke-width="20" stroke-linecap="round"/><path d="M300 786 C330 700 300 640 250 590" fill="none" stroke="#3a2c26" stroke-width="18" stroke-linecap="round"/>
      <path d="M-60 800 C200 780 420 740 640 696 C820 662 980 648 1120 622" fill="none" stroke="#f4f8fb" stroke-width="26" stroke-linecap="round"/>
      <path d="M648 700 C760 626 812 556 842 474" fill="none" stroke="#f4f8fb" stroke-width="11" stroke-linecap="round"/><path d="M292 772 C318 700 292 646 246 598" fill="none" stroke="#f4f8fb" stroke-width="10" stroke-linecap="round"/>
    </svg></div>
    <div class="abs" id="a1tag" style="left:1010px;top:300px"><span class="chip" style="background:rgba(255,255,255,.94);color:#1e3346;font-size:34px;padding:12px 30px;box-shadow:0 12px 30px rgba(0,0,0,.3)">${SPARK("#e8834f", 44)} 中身は Claude</span></div>
    <div class="abs" id="a1ten" style="left:1010px;top:270px;width:860px"><div style="font-size:54px;font-weight:700;color:#dbe7f1;letter-spacing:.04em">ある雪の朝の、</div><div style="font-size:150px;font-weight:900;line-height:1.1;letter-spacing:.01em">10<span style="font-size:96px">分間</span><span style="font-size:70px;font-weight:700;color:#dbe7f1">の話。</span></div>
      <div class="chip mono" style="margin-top:22px;background:rgba(255,255,255,.12);border:2px solid rgba(255,255,255,.2);font-size:28px">12月14日（月）　AM 6:30　積雪 12cm</div></div>`;
  const cap = captain(390); cap.style.left = "0px"; cap.style.top = "0px"; fg.append(cap);
  const branch = q("#a1branch"), tag = q("#a1tag"), ten = q("#a1ten");

  // ── 文字 ──
  txt.innerHTML = `
    <div class="abs" id="a1n" style="left:0;right:0;top:200px;display:flex;justify-content:center;gap:150px">
      <div id="a1n1" style="width:700px;text-align:center"><div style="font-size:250px;font-weight:900;line-height:1;color:#ffcfae"><span id="a1v1">0</span><span style="font-size:130px">%</span></div><div style="margin-top:18px;font-family:var(--sans);font-size:36px;font-weight:700;line-height:1.5">雪かきの手伝いを頼む世帯のうち、<br><b style="color:#ffcfae">70歳以上だけ</b>の世帯</div></div>
      <div id="a1n2" style="width:700px;text-align:center"><div style="font-size:250px;font-weight:900;line-height:1;color:#a9d3e6"><span id="a1v2">0</span><span style="font-size:130px">%</span></div><div style="margin-top:18px;font-family:var(--sans);font-size:36px;font-weight:700;line-height:1.5">手伝う近所の人のうち、<br><b style="color:#a9d3e6">70歳以上</b>の人</div></div>
    </div>
    <div class="abs" id="a1src" style="left:0;right:0;top:92px;text-align:center;font-family:var(--sans);font-size:21px;font-weight:600;color:rgba(255,255,255,.62);line-height:1.6">出典: 札幌市社会福祉協議会「令和5年度 福祉除雪事業アンケート調査」（福祉除雪の利用世帯）／札幌市保健福祉局「福祉除雪事業の見直し（案）」2025年12月（地域協力員）</div>
    <div class="abs" id="a1k" style="left:0;right:0;top:120px;text-align:center"><div id="a1k1" style="font-size:66px;font-weight:700;color:#e3edf5">足りないのは、</div><div id="a1k2" style="font-size:170px;font-weight:900;line-height:1.25;letter-spacing:.04em;color:#ffd59a;text-shadow:0 0 60px rgba(255,180,90,.45)">きっかけ。</div></div>
    <div class="abs" id="a1t" style="left:0;right:0;top:92px;text-align:center"><div id="a1logo" style="font-size:190px;font-weight:900;line-height:1.1;letter-spacing:.02em;text-shadow:0 10px 40px rgba(10,25,45,.45)">シマエナ<span style="color:#ffb37f">GO</span></div>
      <div id="a1tl" style="margin-top:14px;display:flex;justify-content:center;gap:18px">${["雪の朝", "近所の3チームが", "10分だけ", "助けに行く"].map((w) => `<span class="chip" style="background:rgba(255,255,255,.95);color:#1e3346;font-size:40px;padding:10px 30px;box-shadow:0 10px 26px rgba(10,25,45,.3)">${w}</span>`).join("")}</div></div>`;
  const n1 = q("#a1n1"), n2 = q("#a1n2"), v1 = q("#a1v1"), v2 = q("#a1v2"), src = q("#a1src"), k1 = q("#a1k1"), k2 = q("#a1k2"), logo = q("#a1logo"), tl = [...q("#a1tl").children];
  const cap2 = captain(150), cap2Box = q("#a1cap2"); cap2Box.append(cap2);
  const arcs = q("#a1arcs"), rings = q("#a1rings");
  const lone = houses[LONE], roofX = lone.cx, roofY = G - lone.h - lone.rh - 14;
  const TEAM = ["#2F6FE4", "#FF8A3D", "#9B5DE5"];
  const helpers = houses.filter((h) => h.i !== LONE && h.i >= 1 && h.i <= 7);
  arcs.innerHTML = helpers.map((h, k) => { const x0 = h.cx, y0 = G - h.h - h.rh - 30, mx = (x0 + roofX) / 2, my = Math.min(y0, roofY) - 150 - Math.abs(x0 - roofX) * 0.12; return `<path id="arc${k}" d="M${x0} ${y0} Q${mx} ${my} ${roofX + (x0 < roofX ? -60 : 60)} ${roofY + 60}" fill="none" stroke="${TEAM[k % 3]}" stroke-width="9" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/>`; }).join("");
  const arcEls = helpers.map((_, k) => q("#arc" + k));

  const t0 = T("hello"), tq = T("quiet"), tn = T("numbers"), ts = T("spark"), tt = T("title"), tE = E("title");
  const c07 = L("c07"), sparkHalf = L("c11") + (LE("c11") - L("c11")) * 0.5;
  return (t) => {
    // 空: 夜 → 夜明け
    const dawn = kf(t, [[t0, 0], [tq, 0.12], [tn, 0.3], [ts, 0.42], [tt, 0.62], [tE, 1]], Ease.lin);
    sky.style.background = `linear-gradient(180deg, ${mixc("#0a1420", "#41639a", dawn)} 0%, ${mixc("#15263b", "#9a95b6", dawn)} 52%, ${mixc("#243a55", "#f6bd9c", dawn)} 100%)`;
    stars.style.opacity = 1 - dawn * 1.6;
    tint.style.background = mixc("#5b6f9a", "#ffffff", dawn * 0.9 + 0.05);
    for (const l of lampg) l.style.opacity = 1 - clamp((dawn - 0.5) * 3);
    // カメラ
    const zoom = kf(t, [[tq - 0.3, 0.46], [tq + 2.2, 1.0], [c07 - 0.6, 1.0], [c07 + 1.2, 1.32], [tn - 0.2, 1.32], [tn + 1.4, 0.92], [ts - 0.3, 0.92], [ts + 1.6, 0.62], [tE, 0.66]]);
    const cx = kf(t, [[tq - 0.3, 2100], [tq + 2.2, 1250], [c07 + 0.6, 2100]]) ;
    const cy = kf(t, [[tq - 0.3, 330], [tq + 2.2, 610], [c07 - 0.6, 610], [c07 + 1.2, 650], [tn - 0.2, 650], [tn + 1.4, 600], [ts - 0.3, 600], [ts + 1.6, 470], [tE, 480]]);
    const tr = `translate(${(960 - cx * zoom).toFixed(2)}px,${(540 - cy * zoom).toFixed(2)}px) scale(${zoom.toFixed(4)})`;
    world.style.transform = tr; lightsEl.style.transform = tr;
    const far = 1 - pr(t, tq - 0.3, 2.2, Ease.io);
    world.style.filter = far > 0.02 ? `blur(${(far * 2.2).toFixed(2)}px) brightness(${1 - far * 0.25})` : "none";
    sn.update(t, 1); snFar.update(t, 0.8);
    // 雪かきの人
    for (const p of P) {
      const c = (t * p.h.sp + p.h.ph) % 6.2832, s = Math.sin(c), up = Math.max(0, s);
      p.arm.setAttribute("transform", `rotate(${(-6 - up * 44).toFixed(1)} 4 -100)`);
      // 白い息（すくう前に、ふうっと）とマフラーのゆれ
      const bk = ((t * 0.5 + p.h.ph) % 1);
      p.breath.setAttribute("opacity", (Math.sin(bk * 3.14) * 0.55).toFixed(2)); p.breath.setAttribute("transform", `translate(${(bk * 14).toFixed(1)} ${(-bk * 10).toFixed(1)})`);
      p.tail.setAttribute("transform", `rotate(${(Math.sin(t * 2.4 + p.h.ph) * 9).toFixed(1)} -16 -112)`);
      p.lean.setAttribute("transform", `rotate(${(6 - up * 9).toFixed(1)} 0 0)`);
      const k = clamp((c - 1.5) / 1.3);
      p.puff.setAttribute("cx", (60 - k * 150).toFixed(1)); p.puff.setAttribute("cy", (-70 - Math.sin(k * 3.14) * 70 + k * 60).toFixed(1));
      p.puff.setAttribute("opacity", c > 1.5 && c < 2.8 ? 0.95 : 0); p.puff.setAttribute("r", 9 - k * 4);
    }
    // 窓の灯り: はじめは雪かきをする人のいない家だけ。「若い人も近くに」で、近所の窓がともる
    houses.forEach((h, i) => { const k = h.i === LONE ? 1 : pr(t, ts + 0.5 + Math.abs(i - LONE) * 0.28 + (i % 2) * 0.12, 0.5); wins[i].setAttribute("opacity", k.toFixed(2)); });
    // 「この家には、雪かきをする人がいません」→ 光の輪。「通りからは見えません」で輪が消えて、ほかの家と同じに見える
    const half = c07 + (LE("c07") - c07) * 0.52;
    const sp = win(t, c07 - 0.2, c07 + 0.7, half + 0.2, half + 1.6);
    spot.style.background = `radial-gradient(circle at 50% 46%, rgba(8,17,27,0) ${lerp(900, 250, sp)}px, rgba(8,17,27,${0.78 * sp}) ${lerp(1300, 470, sp)}px)`;
    dim.style.opacity = Math.max(win(t, half + 0.3, half + 1.6, tn, tn + 0.01) * 0.35, win(t, tn - 0.01, tn + 0.9, ts - 0.2, ts + 0.9) * 0.8, win(t, ts + 0.2, ts + 1.2, tt, tt + 1.0) * 0.25);

    // あいさつ: 隊長が枝にとまる
    const land = t0 + 1.55, fly = pr(t, t0 + 0.35, 1.2, Ease.out), exit = pr(t, tq - 0.35, 0.9, Ease.in);
    const dip = t > land ? Math.exp(-(t - land) * 3.2) * Math.sin((t - land) * 11) * 14 : 0;
    branch.style.transform = `translate(${-exit * 500}px,${dip + exit * 420}px) rotate(${exit * 8}deg)`;
    branch.style.opacity = 1 - exit;
    const f = Math.round(t * FPS), env = (TL.env[f] + (TL.env[f - 1] || 0)) / 2 || 0;
    const happy = t >= L("c01") - 0.1 && t < LE("c01") + 0.5;
    const hop = happy ? Math.abs(Math.sin((t - L("c01")) * 7.5)) * 34 : 0;
    const bx = lerp(-420, 400, fly) - exit * 700, by = lerp(40, 342, fly) - Math.sin(fly * 3.14) * 150 + dip - hop + exit * 300 - env * 8;
    cap.mood(happy ? "happy" : "normal");
    cap.style.transform = `translate(${bx}px,${by}px) rotate(${(1 - fly) * -18 + Math.sin(t * 7) * env * 3 + (t > LE("c01") + 0.5 && t < L("c02") + 0.4 ? -6 : 0)}deg) scale(${1 + env * 0.03},${1 - env * 0.03})`;
    cap.style.opacity = 1 - exit;
    const c02b = L("c02") + (LE("c02") - L("c02")) * 0.45;
    show(tag, t, c02b, { out: L("c04") - 0.35, scale: 0.8, ease: Ease.back });
    show(ten, t, L("c04") + 0.1, { out: tq - 0.4, dy: 34 });

    // 数字
    const a9 = L("c09"), a10 = L("c10");
    show(n1, t, a9 + 0.9, { out: ts - 0.25 }); show(n2, t, a10 + 0.1, { out: ts - 0.25 }); show(src, t, a9 + 1.4, { out: ts - 0.25, dy: 0 });
    v1.textContent = Math.round(94 * pr(t, a9 + 0.9, 1.4, Ease.out5)); v2.textContent = Math.round(68 * pr(t, a10 + 0.1, 1.2, Ease.out5));
    // きっかけ
    show(k1, t, sparkHalf - 0.1, { out: tt - 0.2 }); show(k2, t, sparkHalf + 0.9, { out: tt - 0.2, scale: 0.86, ease: Ease.back, d: 0.6 });

    // 題字: 隊長が屋根へ → 声の輪 → 近所の家から線がのびる
    const f2 = pr(t, tt + 0.1, 1.0, Ease.io), env2 = t > tt ? env : 0;
    const sx = lerp(roofX - 1500, roofX - 75, f2), sy = lerp(roofY + 500, roofY - 132, f2) - Math.sin(f2 * 3.14) * 330;
    cap2Box.style.transform = `translate(${sx}px,${sy - env2 * 8}px) rotate(${(1 - f2) * -20}deg)`;
    cap2Box.style.opacity = t > tt ? 1 : 0;
    cap2.mood(t > L("c13") - 0.2 ? "happy" : "normal");
    const call = L("c12") + 0.5;
    rings.innerHTML = [0, 0.45, 0.9, 1.6, 2.05].map((d) => { const k = clamp((t - call - d) / 1.7); return k > 0 && k < 1 ? `<circle cx="${roofX}" cy="${roofY - 50}" r="${60 + k * 900}" fill="none" stroke="#ffd59a" stroke-width="${10 * (1 - k) + 2}" opacity="${(1 - k) * 0.9}"/>` : ""; }).join("");
    arcEls.forEach((a, k) => a.setAttribute("stroke-dashoffset", (1 - pr(t, L("c13") + 0.9 + k * 0.16, 0.9, Ease.io)).toFixed(3)));
    show(logo, t, L("c13") - 0.15, { scale: 0.8, ease: Ease.back, d: 0.7 });
    tl.forEach((c, i) => show(c, t, L("c13") + 1.0 + i * 0.5, { dy: 20, scale: 0.8, ease: Ease.back }));
    return { noAva: t < tq - 0.3, note: t < tq ? "シマエナGO ─ 雪の朝、ご近所で雪かきを助け合うアプリ　／　語り: シマエナ隊長（アプリの中の AI）" : t < tt ? "※ 町と人は、架空のイメージです" : "" };
  };
} });
