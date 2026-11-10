// 第1章 課題: 冒頭（作者の朝）→ はまった車は100%助ける → でも家の雪かきはしない（見えない）→ 数字 → 一行 → 題字

// ── 冒頭: 作者が撮った初雪の朝の通り ──
SC.open = (root, s, H) => {
  root.innerHTML = `
    <div class="full" style="background:url(${A.street}) center/cover;filter:blur(26px) brightness(.5) saturate(.8);transform:scale(1.18)"></div>
    <div class="full" style="background:linear-gradient(90deg,rgba(10,18,28,.2) 0%,rgba(10,18,28,.7) 55%,rgba(10,18,28,.88) 100%)"></div>
    <div class="photo" id="ph" style="left:200px;top:52px"><img src="${A.street}" width="675" height="900"><div class="cap">2026年11月8日・札幌の朝（作者撮影）</div></div>
    <div class="abs" id="strap" style="left:1010px;top:104px;width:860px">
      <div style="display:inline-flex;align-items:center;gap:14px;padding:8px 24px;border-radius:999px;background:rgba(255,255,255,.14);border:2px solid rgba(255,255,255,.32);font-size:32px;font-weight:900">シマエナGO<span style="font-weight:700;font-size:23px;color:#dfe8f0;font-family:var(--sans)">Built with Claude: Japan 2026</span></div>
      <div style="margin-top:14px;font-size:33px;font-weight:700;line-height:1.5;color:#e6eef5">雪の朝、ひとり暮らしの家の雪かきを、<br>近所の3チームが10分だけ手伝うアプリ。</div></div>
    <div class="abs h1" id="t1" style="left:1010px;top:372px;font-size:100px;line-height:1.2">札幌に来て、<br><span class="lampc">15年。</span></div>
    <div class="abs h2" id="t2" style="left:1010px;top:664px;font-size:62px">雪かきで、毎年、<br>腰を痛めます。</div>
    <div class="full" id="blk" style="background:#000"></div>`;
  const snow = snowLayer(21, 70, { alpha: 0.9, size: 9, blur: true }); root.insertBefore(snow, root.querySelector("#blk"));
  const ph = root.querySelector("#ph"), t1 = root.querySelector("#t1"), t2 = root.querySelector("#t2"), blk = root.querySelector("#blk");
  return (lt) => {
    snow.update(lt);
    blk.style.opacity = 1 - pr(lt, 0, 0.9, Ease.lin);
    ph.style.transform = `rotate(-1.6deg) scale(${0.97 + 0.035 * Ease.out(lt / H.dur)})`;
    show(root.querySelector("#strap"), lt, 0.5, { dy: 16 });
    show(t1, lt, H.at("n01", -0.15), { dy: 30 });
    show(t2, lt, H.at("n02", -0.1), { dy: 30 });
  };
};

// ── 車がはまったら、知らない人どうしで助ける（絵。実写がないので ※イメージ）──
SC.car = (root, s, H) => {
  const P = (o) => person({ y: 392, s: 1.5, ...o });
  const group = (pose, face) => `
      ${P({ x: 1150, pose, face, coat: "#7d4f68", hat: "#ffd27a", lean: pose === "push" ? -13 : 0, y: 380 })}
      ${P({ x: 1050, pose, face, coat: "#FF8A3D", hat: "#1e3346", lean: pose === "push" ? -14 : 0, y: 398, kind: "adult", beanie: false, hair: "#3b2a22" })}
      ${P({ x: 960, pose, face, coat: "#2F6FE4", hat: "#c0392b", lean: pose === "push" ? -15 : 0, y: 410 })}`;
  root.innerHTML = `
    <div class="full" style="background:linear-gradient(180deg,#15243a 0%,#2c4664 46%,#7f9bb5 78%,#c9d8e4 100%)"></div>
    <svg viewBox="0 0 1920 1080" width="1920" height="1080" class="full">
      <defs><linearGradient id="beam" x1="1" x2="0"><stop offset="0" stop-color="#fff3c4" stop-opacity=".55"/><stop offset="1" stop-color="#fff3c4" stop-opacity="0"/></linearGradient>
        <radialGradient id="lampglow"><stop offset="0" stop-color="#ffe3a3" stop-opacity=".55"/><stop offset="1" stop-color="#ffe3a3" stop-opacity="0"/></radialGradient></defs>
      <g fill="#101d2d" opacity=".9"><rect x="1340" y="470" width="330" height="290"/><polygon points="1320,480 1505,340 1690,480"/><rect x="1720" y="520" width="260" height="240"/><polygon points="1700,530 1850,420 2000,530"/></g>
      <g fill="#ffe9a8" opacity=".9"><rect x="1420" y="560" width="60" height="70" rx="6"/><rect x="1790" y="600" width="50" height="60" rx="6"/></g>
      <g fill="#eef3f8"><path d="M1320 480 L1505 340 L1690 480 L1650 486 L1505 380 L1360 486 Z"/><path d="M1700 530 L1850 420 L2000 530 L1960 536 L1850 458 L1740 536 Z"/></g>
      <rect x="1262" y="330" width="12" height="440" fill="#31475c"/><circle cx="1268" cy="320" r="150" fill="url(#lampglow)"/><circle cx="1268" cy="320" r="20" fill="#ffe9a8"/>
      <rect x="0" y="770" width="1920" height="310" fill="#f4f7fa"/>
      <path d="M0 790 Q240 730 520 780 T1040 770 T1560 790 T1920 770 L1920 800 L0 800Z" fill="#fff"/>
      <ellipse cx="300" cy="820" rx="340" ry="70" fill="#e3eef3"/><ellipse cx="1700" cy="830" rx="360" ry="70" fill="#e3eef3"/>
      <g id="shovelman">${person({ x: 330, y: 404, s: 1.36, pose: "shovel", coat: "#29445c", hat: "#9B5DE5", face: "smile", id: "sm" })}</g>
      <g id="car">
        <polygon points="500,690 500,750 150,800 150,650" fill="url(#beam)"/>
        <g id="carbody" transform="translate(470 560)">
          <path d="M10 200 L10 140 Q12 112 40 108 L112 100 L152 36 Q160 20 182 20 L430 20 Q462 20 466 52 L478 200 Z" fill="#86b3cd"/>
          <path d="M10 200 L10 166 L478 166 L478 200 Z" fill="#5f8ea9"/>
          <path d="M152 36 Q160 20 182 20 L430 20 Q462 20 466 52 L468 62 L140 62 Z" fill="#f4f7fa"/>
          <path d="M166 50 L132 102 L250 102 L250 50 Z" fill="#d6ebf5"/><rect x="266" y="50" width="160" height="52" rx="8" fill="#d6ebf5"/>
          <path d="M258 60 L258 190" stroke="#5f8ea9" stroke-width="4"/><rect x="276" y="122" width="34" height="8" rx="4" fill="#5f8ea9"/>
          <ellipse cx="24" cy="148" rx="11" ry="14" fill="#fff3c4"/><rect x="464" y="118" width="12" height="32" rx="4" fill="#d9534f"/>
          <g><circle cx="110" cy="204" r="46" fill="#1b232c"/><circle cx="110" cy="204" r="19" fill="#9fb0bf"/></g>
          <g id="rw" transform="translate(380 204)"><circle r="46" fill="#1b232c"/><circle r="19" fill="#9fb0bf"/><g id="spokes" stroke="#5c6b78" stroke-width="7"><path d="M-40 0H40M0 -40V40"/></g></g>
        </g>
        <g id="spray" fill="#fff"></g>
        <g id="b2" opacity="0"><rect x="560" y="486" width="250" height="64" rx="32" fill="#fff"/><path d="M660 548 l14 20 l14 -20Z" fill="#fff"/><text x="685" y="530" font-size="32" font-weight="900" fill="#29445c" text-anchor="middle" font-family="Zen Maru Gothic">ありがとう〜！</text></g>
      </g>
      <ellipse id="rut" cx="850" cy="812" rx="120" ry="40" fill="#fff"/><ellipse cx="850" cy="826" rx="150" ry="30" fill="#e9f1f6"/>
      <g id="pushers">${group("push", "open")}</g>
      <g id="cheers" opacity="0">${group("cheer", "happy")}</g>
      <g id="b1"><rect x="1010" y="318" width="170" height="64" rx="32" fill="#fff"/><path d="M1060 380 l14 20 l14 -20Z" fill="#fff"/><text x="1095" y="362" font-size="34" font-weight="900" fill="#29445c" text-anchor="middle" font-family="Zen Maru Gothic">せーの！</text></g>
    </svg>
    <div class="abs h2" id="c1" style="left:110px;top:96px;font-size:56px">北海道の人は、雪にはまった車を</div>
    <div class="abs" id="c2" style="left:104px;top:150px;font-weight:900;line-height:1;color:var(--lamp-light);text-shadow:0 8px 30px rgba(0,0,0,.35)"><span id="num" style="font-size:250px;letter-spacing:-.02em">100</span><span style="font-size:120px">%</span><span style="font-size:72px;color:#fff;margin-left:26px">助けます。</span></div>
    <div class="abs h3" id="c3" style="left:112px;top:404px;font-size:44px;color:#fff">知らない人どうしでも、みんなで。</div>
    <div class="note">※イメージ（「100%」は作者の15年の実感です）</div>`;
  const snow = snowLayer(4, 110, { alpha: 0.85 }); root.append(snow);
  const q = (x) => root.querySelector(x);
  const car = q("#car"), body = q("#carbody"), spokes = q("#spokes"), spray = q("#spray"), pushers = q("#pushers"), cheers = q("#cheers"), b1 = q("#b1"), b2 = q("#b2"), num = q("#num"), arm = q("#sm .arm");
  const uppers = [...pushers.querySelectorAll(".upper")];
  const baseT = uppers.map((u) => u.getAttribute("transform"));
  const drops = Array.from({ length: 12 }, () => { const c = document.createElementNS("http://www.w3.org/2000/svg", "circle"); spray.append(c); return c; });
  const tFree = H.mid("n03", 0.86);
  return (lt) => {
    snow.update(lt);
    const free = pr(lt, tFree, 1.5, Ease.io);
    const stuck = lt < tFree;
    const jx = stuck ? Math.sin(lt * 9) * 6 : 0;
    car.setAttribute("transform", `translate(${jx - free * 470} 0)`);
    body.setAttribute("transform", `translate(470 ${560 + (stuck ? 6 : 6 * (1 - free))}) rotate(${stuck ? 1.2 + Math.sin(lt * 9) * 0.5 : 1.2 * (1 - free)} 240 200)`);
    spokes.setAttribute("transform", `rotate(${lt * (stuck ? 900 : 500)})`);
    drops.forEach((c, i) => { const ph = (lt * 1.8 + i / 12) % 1; c.setAttribute("cx", 870 + ph * (120 + (i % 4) * 30)); c.setAttribute("cy", 770 - Math.sin(ph * Math.PI) * (50 + (i % 3) * 26)); c.setAttribute("r", 4 + (i % 3) * 3); c.setAttribute("opacity", stuck ? (1 - ph) * 0.95 : 0); });
    uppers.forEach((u, i) => u.setAttribute("transform", baseT[i].replace(/rotate\(([-\d.]+)/, (m, a) => `rotate(${+a + Math.sin(lt * 9 + i) * 3}`)));
    const sw = pr(lt, tFree + 0.15, 0.3, Ease.lin);
    pushers.setAttribute("opacity", 1 - sw); cheers.setAttribute("opacity", sw);
    cheers.setAttribute("transform", `translate(0 ${-Math.abs(Math.sin((lt - tFree) * 7)) * 14 * sw})`);
    b1.setAttribute("opacity", pr(lt, 0.5, 0.3, Ease.lin) * (1 - pr(lt, tFree - 0.1, 0.25, Ease.lin)));
    b2.setAttribute("opacity", pr(lt, tFree + 0.7, 0.3, Ease.lin));
    if (arm) arm.setAttribute("transform", `rotate(${-4 + Math.sin(lt * 5) * 12} 112 90)`);
    show(q("#c1"), lt, H.at("n03", -0.1), { dy: 24 });
    const tn = H.mid("n03", 0.56);
    show(q("#c2"), lt, tn, { dy: 0, scale: 0.86, d: 0.45, ease: Ease.back });
    num.textContent = countUp(pr(lt, tn, 0.75, Ease.lin), 100);
    show(q("#c3"), lt, H.end("n03", 0.25), { dy: 20 });
  };
};

// ── でも、知らない家の雪かきはしない。見えないから ──
SC.invisible = (root, s, H) => {
  const house = (x, lit) => `<g transform="translate(${x} 0)"><rect x="0" y="470" width="420" height="330" fill="#0d1a27"/><polygon points="-30,480 210,300 450,480" fill="#0d1a27"/><path d="M-30 480 L210 300 L450 480 L400 486 L210 345 L20 486 Z" fill="#eef3f8"/>${lit ? `<rect x="80" y="560" width="70" height="80" rx="6" fill="#ffe9a8" opacity=".9"/>` : `<rect x="80" y="560" width="70" height="80" rx="6" fill="#2a3d52"/>`}<rect x="250" y="600" width="90" height="200" rx="6" fill="#1b2c3f"/></g>`;
  root.innerHTML = `
    <div class="full" id="pa">
      <div class="full" style="background:linear-gradient(180deg,#0f1c2b 0%,#223b54 55%,#6d8aa6 100%)"></div>
      <svg viewBox="0 0 1920 1080" width="1920" height="1080" class="full">
        <defs><radialGradient id="spot"><stop offset="0" stop-color="#fff" stop-opacity=".2"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
        <circle cx="150" cy="210" r="50" fill="#fff8e1" opacity=".9"/>
        ${house(110, true)}${house(750, false)}${house(1390, true)}
        <rect x="0" y="790" width="1920" height="290" fill="#f4f7fa"/>
        <ellipse cx="960" cy="800" rx="250" ry="70" fill="#fff"/><ellipse cx="1045" cy="790" rx="110" ry="60" fill="#fff"/>
        <ellipse cx="330" cy="930" rx="250" ry="60" fill="url(#spot)"/><ellipse cx="1610" cy="930" rx="250" ry="60" fill="url(#spot)"/>
        ${person({ x: 190, y: 560, s: 1.22, pose: "shovel", coat: "#29445c", hat: "#c0392b", id: "pA", lean: 10, face: "tired" })}
        ${person({ x: 1470, y: 560, s: 1.22, pose: "shovel", coat: "#5b6f84", hat: "#3b6584", id: "pB", lean: 10, face: "tired", flip: true })}
        <g id="q" opacity="0"><circle cx="960" cy="610" r="64" fill="none" stroke="#ffd0b5" stroke-width="6" stroke-dasharray="14 12"/><text x="960" y="640" font-size="84" font-weight="900" fill="#ffd0b5" text-anchor="middle" font-family="Zen Maru Gothic">？</text></g>
      </svg>
      <div class="abs h1" id="a1" style="left:0;width:1920px;top:92px;text-align:center;font-size:78px">でも、知らない家の雪かきは、<span class="lampc">しない。</span></div>
    </div>
    <div class="full" id="pb" style="opacity:0">
      <div class="full" id="img" style="background:url(${A.before}) 50% 40%/cover;transform-origin:72% 30%"></div>
      <div class="full" style="background:linear-gradient(180deg,rgba(8,16,25,.35) 0%,rgba(8,16,25,.05) 30%,rgba(8,16,25,.25) 55%,rgba(8,16,25,.88) 100%)"></div>
      <div class="abs h2" id="b1t" style="left:120px;top:560px;font-size:64px">冷たいからじゃない。</div>
      <div class="abs h1" id="b2t" style="left:120px;top:660px;font-size:100px">誰が困っているか、<span class="lampc">見えない</span>から。</div>
      <div class="abs small" id="b3t" style="left:126px;top:828px;font-size:32px;color:#dfe8f0">ひとり暮らしの家。玄関が雪でふさがっていても、外からは分からない。</div>
      <div class="note">※イメージ</div>
    </div>`;
  const snow = snowLayer(9, 120, { alpha: 0.85 }); root.append(snow);
  const q = (x) => root.querySelector(x);
  const arms = [...root.querySelectorAll("#pa .arm")];
  const tB = H.at("n06", -0.35);
  return (lt) => {
    snow.update(lt);
    arms.forEach((a, i) => a.setAttribute("transform", `rotate(${-4 + Math.sin(lt * 3.6 + i * 2) * 12} 112 90)`));
    show(q("#a1"), lt, H.at("n05", -0.15), { dy: 24 });
    q("#q").setAttribute("opacity", pr(lt, H.mid("n05", 0.55), 0.4, Ease.lin) * (0.75 + 0.25 * Math.sin(lt * 5)));
    q("#pb").style.opacity = pr(lt, tB, 0.7, Ease.lin);
    q("#img").style.transform = `scale(${1.03 + 0.1 * Ease.out((lt - tB) / (H.dur - tB + 0.5))})`;
    show(q("#b1t"), lt, H.at("n06", -0.05), { dy: 20 });
    show(q("#b2t"), lt, H.at("n07", -0.1), { dy: 26 });
    show(q("#b3t"), lt, H.mid("n07", 0.5), { dy: 14 });
  };
};

// ── 数字: 頼む人も、手伝う人も、年をとっていく ──
SC.numbers = (root, s, H) => {
  const stat = (id, x, big, unit, bar, lbl) => `
    <div class="abs" id="${id}" style="left:${x}px;top:226px;width:540px">
      <div style="height:250px;display:flex;align-items:flex-end;font-weight:900;line-height:1;color:var(--lamp-light);white-space:nowrap"><span class="n" style="font-size:${unit === "%" ? 250 : 132}px;letter-spacing:-.02em;line-height:${unit === "%" ? 0.86 : 1.25}">${big}</span><span style="font-size:${unit === "%" ? 110 : 0}px;line-height:1">${unit === "%" ? "%" : ""}</span></div>
      <div style="margin-top:26px;height:24px;border-radius:12px;background:rgba(255,255,255,.14);overflow:hidden">${bar}</div>
      <div class="h3" style="margin-top:28px;font-size:35px;color:#fff;line-height:1.5;white-space:nowrap">${lbl}</div>
    </div>`;
  const dots = Array.from({ length: 8 }, (_, i) => `<i style="display:inline-block;width:52px;height:24px;margin-right:9px;border-radius:12px;background:${i === 0 ? "var(--lamp)" : "rgba(255,255,255,.2)"}"></i>`).join("");
  root.innerHTML = `
    <div class="full bg-deep"></div>
    <div class="abs h2" id="hd" style="left:130px;top:112px;font-size:52px">札幌の雪かきの、いま</div>
    ${stat("s1", 130, "94", "%", `<i class="b" style="display:block;height:100%;width:0;background:var(--lamp);border-radius:10px"></i>`, `雪かきの手伝いを使う世帯のうち<br><b class="lampc">70歳以上だけ</b>の世帯`)}
    ${stat("s2", 690, "68", "%", `<i class="b" style="display:block;height:100%;width:0;background:var(--lamp);border-radius:10px"></i>`, `手伝う近所の人のうち<br><b class="lampc">70歳以上</b>の人`)}
    ${stat("s3", 1250, "8人に1人", "", `<div style="background:#16263a;height:100%;white-space:nowrap">${dots}</div>`, `困ったとき近所を頼れる<br>お年寄り（12.9%）`)}
    <div class="abs h1" id="concl" style="left:0;width:1920px;top:770px;text-align:center;font-size:68px">頼む人も、手伝う人も、<span class="lampc">年をとっていく。</span></div>
    <div class="abs" style="left:130px;right:130px;top:1018px;font-family:var(--sans);font-size:18px;font-weight:600;color:#7f97ab;line-height:1.5">出典: 札幌市社会福祉協議会「令和5年度 福祉除雪事業アンケート調査結果の概要」（利用世帯）／札幌市保健福祉局「福祉除雪事業の見直し（案）」2025年12月（地域協力員）／内閣府「令和8年版 高齢社会白書」</div>`;
  const snow = snowLayer(31, 50, { alpha: 0.35, speed: 0.6 }); root.append(snow);
  const q = (x) => root.querySelector(x);
  const S = [["#s1", H.at("n08", 0.2), 94], ["#s2", H.at("n09", 0.1), 68], ["#s3", H.mid("n09", 0.62), null]];
  return (lt) => {
    snow.update(lt);
    show(q("#hd"), lt, 0.15, { dy: 16 });
    for (const [sel, t0, to] of S) {
      const el = q(sel);
      show(el, lt, t0, { dy: 34 });
      if (to != null) { el.querySelector(".n").textContent = countUp(pr(lt, t0 + 0.1, 1.0, Ease.lin), to); el.querySelector(".b").style.width = to * Ease.out((lt - t0 - 0.1) / 1.0) + "%"; }
    }
    show(q("#concl"), lt, H.end("n09", -0.7), { dy: 24 });
  };
};

// ── 一行: 足りないのは、人じゃない。見えないことです ──
SC.key = (root, s, H) => {
  root.innerHTML = `
    <div class="full" style="background:#070c12"></div>
    <div class="abs" id="k1" style="left:0;width:1920px;top:350px;text-align:center;font-size:92px;font-weight:900;letter-spacing:.04em">足りないのは、人じゃない。</div>
    <div class="abs" id="k2" style="left:0;width:1920px;top:500px;text-align:center;font-size:150px;font-weight:900;letter-spacing:.04em;color:var(--lamp-light)">見えないことです。</div>
    <div class="full" id="glow" style="background:radial-gradient(circle at 50% 52%,rgba(244,247,250,1) 0%,rgba(244,247,250,.9) 30%,rgba(244,247,250,0) 70%);opacity:0"></div>`;
  const snow = snowLayer(77, 40, { alpha: 0.3, speed: 0.5 }); root.insertBefore(snow, root.querySelector("#k1"));
  const q = (x) => root.querySelector(x);
  return (lt) => {
    snow.update(lt);
    show(q("#k1"), lt, H.at("n10", -0.1), { dy: 0, d: 0.7, scale: 0.97 });
    show(q("#k2"), lt, H.at("n11", -0.1), { dy: 0, d: 0.6, scale: 0.94 });
    const g = pr(lt, H.dur - 0.55, 0.55, Ease.io);
    q("#glow").style.opacity = g; q("#glow").style.transform = `scale(${0.4 + g * 3})`;
  };
};

// ── 題字 ──
SC.title = (root, s, H) => {
  const bird = (sc, size, mood, id) => `<div class="abs" id="${id}">${mascot(SCARF[sc], size, mood)}</div>`;
  root.innerHTML = `
    <div class="full bg-paper"></div>
    <div class="abs" id="branch" style="left:520px;top:356px;width:880px;height:14px;border-radius:8px;background:#6b4a33;transform-origin:0 50%"></div>
    ${bird("marigold", 230, "normal", "bd1")}${bird("lupinus", 230, "normal", "bd2")}${bird("salvia", 290, "happy", "bd3")}
    <div class="abs" id="logo" style="left:0;width:1920px;top:372px;text-align:center;font-size:176px;font-weight:900;color:var(--ink);letter-spacing:.02em;text-shadow:0 6px 0 #fff">シマエナ<span style="color:var(--lamp-deep)">GO</span></div>
    <div class="abs" id="tagl" style="left:0;width:1920px;top:586px;text-align:center;font-size:58px;font-weight:700;color:var(--lamp-deep)">寒い冬は、くっついて乗り切る。</div>
    <div class="abs" id="see" style="left:0;width:1920px;top:694px;text-align:center;font-size:50px;font-weight:900;color:var(--ink)">「困っている」を、<span style="background:linear-gradient(transparent 62%,#ffd9a8 62%)">見える</span>ようにするアプリ。</div>
    <div class="abs" id="chips" style="left:0;width:1920px;top:800px;display:flex;justify-content:center;gap:22px">
      ${["❄ 雪の朝", "🧣 近所の3チームが", "⏱ 10分だけ", "🏠 助けに行く"].map((t, i) => `<div class="cp" style="padding:16px 34px;border-radius:999px;font-size:42px;font-weight:900;color:#fff;background:${["#5f8ea9", "#29445c", "#b8603a", "#d9825b"][i]};box-shadow:0 10px 24px rgba(41,68,92,.2)">${t}</div>`).join("")}
    </div>
    <div class="abs" style="left:0;width:1920px;top:1024px;text-align:center;font-size:24px;font-weight:700;color:#6c8296;font-family:var(--sans)">Built with Claude: Japan 2026 提出作品</div>`;
  const snow = snowLayer(7, 60, { alpha: 0.9, color: "#bfd3e0" }); root.append(snow);
  const q = (x) => root.querySelector(x);
  const birds = [["#bd1", 760, 150, 0.35], ["#bd2", 880, 140, 0.55], ["#bd3", 990, 90, 0.75]];
  const chips = [...root.querySelectorAll(".cp")];
  return (lt) => {
    snow.update(lt);
    q("#branch").style.transform = `scaleX(${pr(lt, 0.1, 0.5)})`;
    for (const [sel, x, y, t0] of birds) { const el = q(sel); const k = pr(lt, t0, 0.5, Ease.back); el.style.left = x + "px"; el.style.top = y + (1 - k) * 60 + Math.sin(lt * 2 + x) * 3 + "px"; el.style.opacity = clamp((lt - t0) / 0.2); el.style.transform = `scale(${0.6 + 0.4 * k})`; }
    show(q("#logo"), lt, 0.55, { dy: 30, scale: 0.92, d: 0.6, ease: Ease.back });
    show(q("#tagl"), lt, 1.0, { dy: 18 });
    show(q("#see"), lt, H.at("n12", 0.3), { dy: 20 });
    const t13 = H.at("n13", 0), d13 = H.end("n13") - t13;
    chips.forEach((c, i) => show(c, lt, t13 + [0, 0.22, 0.52, 0.76][i] * d13, { dy: 26, scale: 0.9, d: 0.4, ease: Ease.back }));
  };
};
