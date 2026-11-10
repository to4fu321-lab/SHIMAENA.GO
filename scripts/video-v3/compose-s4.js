// 第4章 深さと、これから: 1週間の量と磨き込み → この冬（誰がどこで使うか）→ 見たい朝 → 初雪 → 題字

// ── 1週間で作った量 ──
SC.depth = (root, s, H) => {
  root.innerHTML = `<div class="full" style="background:#0d1722"></div>`;
  // 後ろ: 本物の画面（docs/screens）の壁が、ゆっくり流れる
  const shots = TL.screens.filter((f) => !/richmenu|line-|icon|card-scenes|cards-book/.test(f));
  const rows = [0, 1, 2].map((r) => {
    const list = shots.filter((_, i) => i % 3 === r);
    const imgs = [...list, ...list].map((f) => `<img src="${A.screens}${f}" style="height:400px;width:185px;object-fit:cover;object-position:top;border-radius:20px;margin-right:22px;flex:none">`).join("");
    return add(root, `<div class="abs" style="left:-200px;top:${-60 + r * 424}px;display:flex;will-change:transform">${imgs}</div>`);
  });
  add(root, `<div class="full" style="background:linear-gradient(180deg,rgba(10,18,28,.9) 0%,rgba(10,18,28,.74) 45%,rgba(10,18,28,.92) 100%)"></div>`);
  const hd = add(root, `<div class="abs h1" style="left:0;width:1920px;top:150px;text-align:center;font-size:70px">11月2日〜8日。<span class="lampc">1週間で、ここまで。</span></div>`);
  const commits = TL.commits.length;
  const stats = [[commits, "コミット", ""], [570, "本のテスト", "11/10 時点"], [52, "回の仕様の改訂", "v1 → v1.52"], [29, "の画面", "どれもスマホ1画面"]];
  const W = 400, X0 = (1920 - W * 4) / 2;
  const els = stats.map(([n, unit, sub], i) => add(root, `<div class="abs" style="left:${X0 + i * W}px;top:330px;width:${W}px;text-align:center"><div style="font-size:170px;font-weight:900;color:var(--lamp-light);line-height:1;letter-spacing:-.02em"><span class="n">0</span></div><div style="font-size:42px;font-weight:900;margin-top:10px">${unit}</div><div style="font-size:26px;font-weight:700;color:#b7c7d6;margin-top:4px">${sub}</div></div>`));
  const chips = add(root, `<div class="abs" style="left:0;width:1920px;top:690px;display:flex;justify-content:center;gap:16px;flex-wrap:wrap;padding:0 150px;box-sizing:border-box">${["架空の20人で、町の朝をまるごとテスト", "音は全部 Web Audio で合成（音ファイル 0）", "文字は 18px 以上・ボタンは少なく大きく", "地図に名前を出さない・夜は行かせない"].map((t) => `<div class="chip" style="font-size:30px;background:rgba(255,255,255,.12)">${t}</div>`).join("")}</div>`);
  return (lt) => {
    rows.forEach((r, i) => { r.style.transform = `translateX(${(i % 2 ? -1 : 1) * (lt * 26) - (i % 2 ? 0 : 320)}px)`; });
    show(hd, lt, 0.15, { dy: 22 });
    els.forEach((el, i) => { const t0 = H.at("n41", 0.2) + i * 0.32; show(el, lt, t0, { dy: 30 }); el.querySelector(".n").textContent = countUp(pr(lt, t0, 0.9, Ease.lin), stats[i][0]); });
    show(chips, lt, H.mid("n41", 0.7), { dy: 16 });
  };
};

// ── ハッカソンのあと: この冬、まず1つの町内で ──
SC.next = (root, s, H) => {
  root.innerHTML = `<div class="full bg-deep"></div>`;
  const snow = snowLayer(51, 40, { alpha: 0.3, speed: 0.5 }); root.append(snow);
  const hd = add(root, `<div class="abs h1" style="left:110px;top:92px;font-size:68px">ハッカソンのあと。<span class="lampc">この冬、まず1つの町内で。</span></div>`);
  const steps = [["この冬", "1つの町内で、<br>本物の雪で動かす", "冬の初めに、町内会や管理組合の<br>集まりで登録を手伝う", true], ["3年", "市の福祉除雪と、<br>役割を分けてつなぐ", "制度が届かない通路や、<br>ドカ雪の朝を受け持つ", false], ["5年", "雪国の町へ。<br>雪以外にも同じ型で", "落ち葉・台風のあと・重いもの。<br>リアルでしか解けない困りごとへ", false]];
  const W = 540, G = 40, X0 = 110;
  const cards = steps.map(([when, a, b, hot], i) => add(root, `<div class="card" style="left:${X0 + i * (W + G)}px;top:226px;width:${W}px;height:360px;${hot ? "border-color:#ffd0b5;background:rgba(217,130,91,.2)" : "background:rgba(8,16,25,.5)"}"><div style="padding:30px 38px">
      <div style="display:inline-block;padding:6px 24px;border-radius:999px;background:${hot ? "var(--lamp)" : "rgba(255,255,255,.14)"};font-size:34px;font-weight:900">${when}</div>
      <div style="font-size:46px;font-weight:900;line-height:1.3;margin-top:18px">${a}</div><div style="font-size:27px;font-weight:700;color:#c4d3e0;line-height:1.45;margin-top:14px">${b}</div></div></div>`));
  const m = add(root, `<div class="abs" style="left:110px;top:636px;width:1700px;display:flex;align-items:center;gap:36px">
      <div style="flex:none;font-size:44px;font-weight:900;color:#c4d3e0">測るのは<br><s style="color:#7f97ab">点数</s> ではなく</div>
      <div style="flex:none;font-size:64px;color:#ffd0b5;font-weight:900">→</div>
      <div style="display:flex;flex-direction:column;gap:14px"><div class="mm" style="font-size:66px;font-weight:900;line-height:1.2">雪の朝に、<span class="lampc">外へ出た人の数</span></div><div class="mm" style="font-size:50px;font-weight:900;line-height:1.2;color:#dfe8f0">顔と名前が一致した人の数</div></div></div>`);
  const note = add(root, `<div class="abs small" style="left:112px;top:868px;font-size:28px">まだ本物の町では使っていません。だから「孤独を解決した」とは言いません。ここからが本番です。</div>`);
  return (lt) => {
    snow.update(lt);
    show(hd, lt, 0.15, { dy: 22 });
    cards.forEach((c, i) => show(c, lt, H.at("n42", 0.1) + i * 0.5, { dy: 36 }));
    show(m, lt, H.at("n43", -0.1), { dy: 26 });
    show(note, lt, H.mid("n43", 0.6), { dy: 12 });
  };
};

// ── 見たい朝（絵）──
SC.future = (root, s, H) => {
  const bubble = (x, y, text, w = 150) => `<g class="bb"><rect x="${x}" y="${y}" width="${w}" height="54" rx="27" fill="#fff" stroke="#c8a7b8" stroke-width="3"/><path d="M${x + 30} ${y + 52} l10 16 l14 -16Z" fill="#fff" stroke="#c8a7b8" stroke-width="3"/><rect x="${x + 28}" y="${y + 48}" width="30" height="6" fill="#fff"/><text x="${x + w / 2}" y="${y + 36}" font-size="28" font-weight="900" fill="#7d4f68" text-anchor="middle" font-family="Zen Maru Gothic">${text}</text></g>`;
  root.innerHTML = `<div class="full" style="background:linear-gradient(180deg,#f7c59f 0%,#fbe3c9 35%,#dbe9f1 70%,#f4f7fa 100%)"></div>
    <svg viewBox="0 0 1920 1080" width="1920" height="1080" class="full">
      <circle id="sun" cx="1500" cy="330" r="110" fill="#ffd27a"/>
      <g fill="#8fa9bd" opacity=".85"><rect x="60" y="420" width="380" height="330"/><polygon points="40,430 250,280 460,430"/><rect x="560" y="470" width="300" height="280"/><polygon points="540,480 710,350 880,480"/><rect x="1000" y="440" width="520" height="310"/><rect x="1620" y="400" width="260" height="350"/></g>
      <g fill="#fff"><path d="M40 430 L250 280 L460 430 L420 436 L250 320 L80 436 Z"/><path d="M540 480 L710 350 L880 480 L840 486 L710 388 L580 486 Z"/><rect x="1000" y="425" width="520" height="22" rx="8"/><rect x="1620" y="385" width="260" height="22" rx="8"/></g>
      <g fill="#ffe9a8"><rect x="140" y="520" width="60" height="70" rx="6"/><rect x="1060" y="500" width="50" height="60" rx="6"/><rect x="1160" y="500" width="50" height="60" rx="6"/><rect x="1260" y="500" width="50" height="60" rx="6"/><rect x="1060" y="600" width="50" height="60" rx="6"/><rect x="1160" y="600" width="50" height="60" rx="6"/></g>
      <rect x="0" y="750" width="1920" height="330" fill="#f4f7fa"/>
      <ellipse cx="420" cy="880" rx="300" ry="60" fill="#e3eef3"/><ellipse cx="1500" cy="890" rx="320" ry="64" fill="#e3eef3"/>
      ${person({ x: -30, y: 480, s: 1.3, pose: "shovel", coat: "#29445c", hat: "#2F6FE4", face: "happy" })}
      ${person({ x: 360, y: 600, s: 0.9, pose: "shovel", kind: "child", coat: "#9B5DE5", hat: "#ffd27a", face: "happy" })}
      ${person({ x: 620, y: 480, s: 1.3, pose: "blower", coat: "#FF8A3D", hat: "#1e3346", face: "open" })}
      ${person({ x: 1060, y: 500, s: 1.25, pose: "cane", kind: "elder", coat: "#7d4f68", beanie: false, face: "happy", mitt: "#f3d9c6" })}
      ${person({ x: 1290, y: 500, s: 1.25, pose: "cup", kind: "elder", coat: "#c8a7b8", face: "happy" })}
      ${person({ x: 1540, y: 490, s: 1.3, pose: "wave", coat: "#2F6FE4", beanie: false, hair: "#5b3b2a", face: "happy", flip: true })}
      ${bubble(1120, 462, "おはよう", 180)}${bubble(1360, 440, "ありがとう", 200)}${bubble(715, 440, "♪", 70)}
    </svg>
    <div class="abs" id="f1" style="left:0;width:1920px;top:70px;text-align:center;font-size:74px;font-weight:900;color:#29445c;line-height:1.32;text-shadow:0 3px 0 rgba(255,255,255,.7)">近所の人と一緒に雪かきをするのが、<br><span style="color:#b8603a">当たり前の朝に。</span></div>
    <div class="note" style="color:rgba(74,96,118,.75)">※イメージ（見たい未来の朝）</div>`;
  const snow = snowLayer(3, 50, { alpha: 0.8 }); root.append(snow);
  const arms = [...root.querySelectorAll(".arm")], sun = root.querySelector("#sun"), spray = root.querySelector(".spray"), bbs = [...root.querySelectorAll(".bb")];
  const f1 = root.querySelector("#f1");
  return (lt) => {
    snow.update(lt);
    arms.forEach((a, i) => a.setAttribute("transform", `rotate(${-6 + Math.sin(lt * 3.2 + i * 1.3) * 12} 112 90)`));
    sun.setAttribute("cy", 340 - Math.min(lt, 13) * 7);
    if (spray) spray.setAttribute("opacity", 0.7 + 0.3 * Math.sin(lt * 9));
    bbs.forEach((b, i) => b.setAttribute("opacity", pr(lt, 0.8 + i * 0.7, 0.35, Ease.lin)));
    show(f1, lt, H.mid("n44", 0.3), { dy: 20 });
  };
};

// ── 初雪（作者が撮った公園）: 雪かきは、ここから ──
SC.firstsnow = (root, s, H) => {
  root.innerHTML = `
    <div class="full" style="background:url(${A.park}) center/cover;filter:blur(26px) brightness(.5) saturate(.8);transform:scale(1.18)"></div>
    <div class="full" style="background:linear-gradient(270deg,rgba(10,18,28,.2) 0%,rgba(10,18,28,.7) 55%,rgba(10,18,28,.88) 100%)"></div>
    <div class="photo" id="ph" style="left:1040px;top:52px"><img src="${A.park}" width="675" height="900"><div class="cap">2026年11月8日・提出の朝の公園（作者撮影）</div></div>
    <div class="abs h3" id="s0" style="left:130px;top:250px;font-size:46px;color:#dfe8f0">2026年11月8日</div>
    <div class="abs h1" id="s1" style="left:126px;top:320px;font-size:118px;line-height:1.2">札幌に、<span class="lampc">初雪。</span></div>
    <div class="abs h1" id="s2" style="left:130px;top:560px;font-size:76px;line-height:1.35">雪かきは、<br>ここからです。</div>`;
  const snow = snowLayer(61, 80, { alpha: 0.9, size: 9, blur: true }); root.append(snow);
  const q = (x) => root.querySelector(x);
  return (lt) => {
    snow.update(lt);
    q("#ph").style.transform = `rotate(1.6deg) scale(${0.97 + 0.035 * Ease.out(lt / H.dur)})`;
    show(q("#s0"), lt, H.at("n45", -0.2), { dy: 16 });
    show(q("#s1"), lt, H.at("n45", 0.1), { dy: 28 });
    show(q("#s2"), lt, H.at("n46", -0.1), { dy: 28 });
  };
};

// ── 題字（締め）──
SC.end = (root, s, H) => {
  const bird = (sc, size, mood, x, y) => `<div class="abs bd" style="left:${x}px;top:${y}px">${mascot(SCARF[sc], size, mood)}</div>`;
  root.innerHTML = `
    <div class="full bg-paper"></div>
    <div class="abs" style="left:520px;top:286px;width:880px;height:14px;border-radius:8px;background:#6b4a33"></div>
    ${bird("marigold", 230, "happy", 760, 80)}${bird("lupinus", 230, "happy", 880, 70)}${bird("salvia", 290, "happy", 990, 20)}
    <div class="abs" id="tg" style="left:0;width:1920px;top:318px;text-align:center;font-size:104px;font-weight:900;color:var(--lamp-deep);letter-spacing:.02em">寒い冬は、くっついて乗り切る。</div>
    <div class="abs" id="lg" style="left:0;width:1920px;top:462px;text-align:center;font-size:150px;font-weight:900;color:var(--ink);letter-spacing:.02em;text-shadow:0 6px 0 #fff">シマエナ<span style="color:var(--lamp-deep)">GO</span></div>
    <div class="abs" id="url" style="left:0;width:1920px;top:690px;display:flex;justify-content:center;align-items:center;gap:40px">
      <img src="${A.qr}" style="width:190px;height:190px;border-radius:16px;background:#fff;padding:6px;box-shadow:0 10px 24px rgba(41,68,92,.18)">
      <div style="text-align:left"><div style="font-size:34px;font-weight:700;color:#4a6076">登録なしで、いますぐ試せます</div><div style="font-size:66px;font-weight:900;color:var(--ink);letter-spacing:.01em;line-height:1.25">shimaena-go.vercel.app</div><div style="font-size:30px;font-weight:700;color:#4a6076;font-family:var(--sans)">github.com/to4fu321-lab/shimaena.go</div></div>
    </div>
    <div class="abs" id="cr" style="left:0;width:1920px;top:936px;text-align:center;font-family:var(--sans);font-size:22px;font-weight:600;color:#6c8296;line-height:1.6">Built with Claude: Japan 2026 提出作品 ／ 画面の人・家・町は架空です ／ 地図 © OpenStreetMap contributors<br>${TL.credits || ""}</div>`;
  const snow = snowLayer(7, 60, { alpha: 0.9, color: "#bfd3e0" }); root.append(snow);
  const q = (x) => root.querySelector(x);
  const birds = [...root.querySelectorAll(".bd")];
  return (lt) => {
    snow.update(lt);
    birds.forEach((b, i) => { b.style.transform = `translateY(${Math.sin(lt * 2.2 + i * 0.9) * 5}px)`; });
    show(q("#tg"), lt, H.at("n47", -0.2), { dy: 24, scale: 0.96 });
    show(q("#lg"), lt, H.at("n48", -0.25), { dy: 20, scale: 0.92, ease: Ease.back });
    show(q("#url"), lt, H.end("n48", 0.1), { dy: 24 });
    q("#cr").style.opacity = pr(lt, H.end("n48", 0.5), 0.5, Ease.lin);
  };
};
