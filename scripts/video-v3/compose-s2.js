// 第2章 デモ: 登録 → 6:30 に届く → Claude が割り振る → 行く・地図 → 写真で完了 → カード → 声のありがとう → AI は段取り → ほかの入口
// スマホの中は、本番ビルドを録画した本物の画面（record.cjs）。押した所には指の印が出る。
const PX = 150, PY = 62, PHH = 940; // 左の大きいスマホ
const RX = 730; // 右の文字の左端
const demoBg = (root, seed) => {
  root.innerHTML = `<div class="full bg-night"></div>`;
  const snow = snowLayer(seed, 46, { alpha: 0.32, speed: 0.6 });
  root.append(snow);
  return snow;
};
const add = (root, html) => { const el = $(html); root.append(el); return el; };
const tagHtml = (label, sub, cls = "") => `<div class="tag ${cls}">${SPARK()}<span>${label}</span>${sub ? `<small>${sub}</small>` : ""}</div>`;

// ── お願いする家: 冬の初めに一度だけ登録 ──
SC.ask = (root, s, H) => {
  const snow = demoBg(root, 11);
  const ph = Phone(root, { x: PX, y: PY, h: PHH, label: "頼む家の画面（小林さん・架空）", clips: EDIT.clips.ask.c });
  const tg = add(root, `<div class="abs" style="left:${RX}px;top:110px"><div class="tag blue"><span>🏠 雪かきを頼みたい家</span></div></div>`);
  const t1 = add(root, `<div class="abs h1" style="left:${RX}px;top:230px;font-size:80px">冬の初めに、<br>一度だけ登録。</div>`);
  const t2 = add(root, `<div class="abs h1 lampc" style="left:${RX}px;top:500px;font-size:96px">雪の朝に、<br>頼まなくていい。</div>`);
  const t3 = add(root, `<div class="abs small" style="left:${RX + 4}px;top:790px;font-size:32px">「頼みにくさ」は、雪より重いから。<br>離れて暮らす家族が、代わりに登録もできます。</div>`);
  return (lt) => {
    snow.update(lt); ph.update(lt);
    show(tg, lt, 0.2, { dy: 14 });
    show(t1, lt, H.at("n14", 0.1), { dy: 28 });
    show(t2, lt, H.at("n15", -0.05), { dy: 30, scale: 0.96 });
    show(t3, lt, H.mid("n15", 0.6), { dy: 14 });
  };
};

// ── 6:30 近所のスマホに同時に届く ──
SC.ring = (root, s, H) => {
  const snow = demoBg(root, 12);
  const h = 690, w = (h - 22) * 390 / 844 + 22, gap = 110, x0 = 960 - (w * 3 + gap * 2) / 2, y0 = 206;
  const labels = ["手伝う人（田中さん）", "手伝う人（そうたさん）", "頼んだ家（小林さん）"];
  const rings = [0, 1, 2].map((i) => add(root, `<div class="abs" style="left:${x0 + i * (w + gap) + w / 2 - 260}px;top:${y0 + h / 2 - 260}px;width:520px;height:520px;border-radius:50%;border:6px solid var(--lamp-light);opacity:0"></div>`));
  const phones = ["a", "b", "c"].map((k, i) => Phone(root, { x: x0 + i * (w + gap), y: y0, h, label: labels[i], clips: EDIT.clips.ring[k], taps: false }));
  const clock = add(root, `<div class="abs" style="left:0;width:1920px;top:40px;text-align:center;line-height:1"><span style="font-size:136px;font-weight:900;letter-spacing:.02em">6:30</span><span style="font-size:44px;font-weight:700;color:#dfe8f0;margin-left:36px">12月14日（月）・積雪 <b class="lampc" style="font-size:64px">12</b>cm</span></div>`);
  const bells = [0, 1, 2].map((i) => add(root, `<div class="abs" style="left:${x0 + i * (w + gap) + w - 46}px;top:${y0 - 34}px;width:78px;height:78px;border-radius:50%;background:var(--lamp);display:grid;place-items:center;font-size:42px;box-shadow:0 10px 24px rgba(217,130,91,.5);opacity:0">🔔</div>`));
  const note = add(root, `<div class="abs small" style="left:0;width:1920px;top:1040px;text-align:center;font-size:22px;color:#8ea4b6;font-family:var(--sans)">※ 画面の人・家・町は架空です（デモ）。10cm 以上積もった朝だけ、自動でお知らせします。</div>`);
  const tA = H.g("ring");
  return (lt) => {
    snow.update(lt);
    show(clock, lt, 0.1, { dy: -20 });
    note.style.opacity = pr(lt, 0.6, 0.4, Ease.lin);
    phones.forEach((p, i) => {
      p.update(lt);
      const k = pr(lt, 0.1 + i * 0.1, 0.5);
      const t0 = tA + i * 0.3, d = lt - t0;
      const shake = d > 0 && d < 0.5 ? Math.sin(d * 50) * 5 * (1 - d / 0.5) : 0;
      p.el.style.opacity = k; p.el.style.transform = `translate(${shake}px, ${(1 - k) * 40}px)`;
      const r = clamp(d / 0.9); rings[i].style.opacity = d > 0 ? (1 - r) * 0.9 : 0; rings[i].style.transform = `scale(${0.75 + Ease.out(r) * 0.9})`;
      const kb = pr(lt, t0, 0.35, Ease.back); bells[i].style.opacity = d > 0 ? 1 : 0; bells[i].style.transform = `scale(${kb}) rotate(${d > 0 && d < 0.8 ? Math.sin(d * 28) * 16 * (1 - d / 0.8) : 0}deg)`;
    });
  };
};

// ── 隊長（Claude）が、家ごとの人数と理由を決める ──
SC.commander = (root, s, H) => {
  const snow = demoBg(root, 13);
  const ph = Phone(root, { x: PX, y: PY, h: PHH, label: "手伝う人の画面・町の地図", clips: EDIT.clips.commander.a, taps: false });
  const tg = add(root, `<div class="abs" style="left:${RX}px;top:96px">${tagHtml("Claude Opus 5.5", "司令官（割り振り）")}</div>`);
  const t1 = add(root, `<div class="abs h1" style="left:${RX}px;top:196px;font-size:66px">どの家に、何人。<span class="lampc">理由も1行で。</span></div>`);
  // 拡大: 地図の下の「シマエナ隊長から」
  const lens = Lens(root, ph, { x: RX, y: 322, w: 1060, h: 250, sx: 14, sy: 548, sw: 362 });
  const cap = add(root, `<div class="abs small" style="left:${RX + 6}px;top:584px;font-size:26px">↑ 地図に出る、隊長の理由（上は画面の拡大）</div>`);
  const code = add(root, `<div class="card" style="left:${RX}px;top:640px;width:1060px;height:262px;background:rgba(8,16,25,.55)"><div class="code" style="padding:24px 34px"><span class="c">// 答えは JSON（構造化出力）。プログラムが点検してから使う</span>
{ <span class="k">"baseId"</span>: <span class="s">"base7"</span>, <span class="k">"requiredPeople"</span>: <span class="n">3</span>, <span class="k">"status"</span>: <span class="s">"short"</span>,
  <span class="k">"assignedHelperIds"</span>: [ … ],
  <span class="k">"reason"</span>: <span class="s">"出られない・レベル3→3人。あと3人、近所に声かけ"</span> }</div></div>`);
  const chips = ["予報と積雪", "頼み方（おまかせ／一緒に）", "家までの距離", "手伝える人"].map((t, i) => add(root, `<div class="abs chip" style="left:${RX + [0, 222, 590, 824][i]}px;top:${PY - 6}px;font-size:24px;display:none">${t}</div>`));
  return (lt) => {
    snow.update(lt); ph.update(lt); lens.update();
    show(tg, lt, 0.15, { dy: 14 });
    show(t1, lt, H.at("n18", 0), { dy: 24 });
    show(lens.el, lt, H.at("n18", 0.7), { dy: 30, scale: 0.94 });
    cap.style.opacity = pr(lt, H.at("n18", 1.1), 0.4, Ease.lin);
    show(code, lt, H.mid("n18", 0.55), { dy: 30 });
    void chips;
  };
};

// ── 行く → 家の人に合言葉 → 町の地図がチームの色に ──
SC.go = (root, s, H) => {
  const snow = demoBg(root, 14);
  const C = EDIT.clips.go;
  const tMap = C.m[0].t0;
  const ph = Phone(root, { x: PX, y: PY, h: PHH, label: "手伝う人の画面（田中さん）", clips: [...C.a, ...C.m] });
  const hc = 700, wc = (hc - 22) * 390 / 844 + 22;
  const pc = Phone(root, { x: 1440, y: 190, h: hc, label: "頼んだ家（小林さん）", clips: C.c, taps: false });
  const t1 = add(root, `<div class="abs h1" style="left:${RX}px;top:150px;font-size:84px">「行く」を、<br>1タップ。</div>`);
  const t1b = add(root, `<div class="abs h3" style="left:${RX + 4}px;top:420px;font-size:38px;width:640px">家の人には「向かっています」と<br><b class="lampc">今日の合言葉</b>が届く（防犯）。<br>玄関を開けなくていい。お金はかからない。</div>`);
  // 地図の拡大（家の印がある上のほう）
  const lens = Lens(root, ph, { x: RX, y: 300, w: 1090, h: 590, sx: 30, sy: 188, sw: 330 });
  const t2 = add(root, `<div class="abs h1" style="left:${RX}px;top:76px;font-size:66px">チームは、<span class="lampc">毎週シャッフル。</span></div>`);
  const teams = add(root, `<div class="abs" style="left:${RX}px;top:190px;display:flex;gap:18px;align-items:center">
    ${[["サルビア", "#2F6FE4"], ["マリーゴールド", "#FF8A3D"], ["ルピナス", "#9B5DE5"]].map(([n, c]) => `<div style="display:flex;align-items:center;gap:10px;padding:8px 22px 8px 12px;border-radius:999px;background:#fff;color:#29445c;font-size:30px;font-weight:900"><i style="display:block;width:30px;height:30px;border-radius:50%;background:${c}"></i>${n}</div>`).join("")}
    <div class="small" style="font-size:28px;margin-left:10px">個人の順位なし・お金なし</div></div>`);
  const cap = add(root, `<div class="abs small" style="left:${RX + 6}px;top:900px;font-size:26px;display:none"></div>`);
  return (lt) => {
    snow.update(lt); ph.update(lt); pc.update(lt); lens.update();
    const k2 = pr(lt, tMap, 0.45, Ease.io);
    show(t1, lt, H.at("n20", 0), { dy: 26, out: tMap - 0.25, dOut: 0.25 });
    show(t1b, lt, H.g("goTap") + 0.5, { dy: 18, out: tMap - 0.25, dOut: 0.25 });
    pc.el.style.opacity = pr(lt, 0.1, 0.4, Ease.lin) * (1 - pr(lt, tMap - 0.3, 0.3, Ease.lin));
    pc.el.style.transform = `translateY(${(1 - pr(lt, 0.1, 0.5)) * 30}px)`;
    lens.el.style.opacity = k2; lens.el.style.transform = `scale(${0.94 + 0.06 * k2})`;
    // 地図をゆっくり寄せる
    const z = Ease.io((lt - tMap) / (H.dur - tMap));
    lens.set({ sx: lerp(22, 46, z), sy: lerp(188, 196, z), sw: lerp(346, 300, z) });
    show(t2, lt, tMap + 0.15, { dy: 22 });
    show(teams, lt, tMap + 0.5, { dy: 16 });
    void cap; void wc;
  };
};

// ── 終わったら写真1枚 → Claude が確かめる → 完了 ──
SC.finish = (root, s, H) => {
  const snow = demoBg(root, 15);
  const ph = Phone(root, { x: PX, y: PY, h: PHH, label: "手伝う人の画面（田中さん）", clips: EDIT.clips.finish.a });
  const tTap = H.g("finishTap"), tShut = H.g("shutter"), tClear = H.g("clear");
  const W = 1040, Hh = 567; // 1408:768
  const frame = add(root, `<div class="abs" style="left:${RX}px;top:210px;width:${W}px;height:${Hh}px;border-radius:26px;overflow:hidden;box-shadow:0 30px 60px rgba(0,0,0,.45),0 0 0 5px rgba(255,255,255,.92)">
    <img src="${A.before}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">
    <div id="aft" style="position:absolute;inset:0;overflow:hidden"><img src="${A.after}" style="position:absolute;left:0;top:0;width:${W}px;height:${Hh}px;object-fit:cover"></div>
    <div id="wl" style="position:absolute;top:0;bottom:0;width:6px;background:#fff;box-shadow:0 0 18px rgba(255,255,255,.9)"></div>
    <div id="lb" style="position:absolute;left:22px;top:18px;padding:6px 18px;border-radius:999px;background:rgba(8,16,25,.7);font-size:28px;font-weight:900">雪かきの前</div>
    <div id="flash" style="position:absolute;inset:0;background:#fff;opacity:0"></div>
    <div id="vf" style="position:absolute;inset:26px;border:4px solid rgba(255,255,255,.9);border-radius:14px;opacity:0"></div>
    <div style="position:absolute;right:18px;bottom:12px;font-size:20px;font-weight:700;color:rgba(255,255,255,.85);font-family:var(--sans);text-shadow:0 1px 4px rgba(0,0,0,.6)">※イメージ</div></div>`);
  const t1 = add(root, `<div class="abs h1" style="left:${RX}px;top:84px;font-size:76px">終わったら、<span class="lampc">写真を1枚。</span></div>`);
  const tg = add(root, `<div class="abs" style="left:${RX}px;top:796px">${tagHtml("Claude Opus 5.5", "写真を見て確かめる（画像入力）")}</div>`);
  const checks = ["通れる幅がある？", "凍っていない？", "残った雪の深さは？"].map((t, i) => add(root, `<div class="abs chip" style="left:${RX + i * 340}px;top:874px;font-size:30px;background:rgba(255,255,255,.14)"><b style="color:#9be0b0;margin-right:8px">✓</b>${t}</div>`));
  const q = (x) => frame.querySelector(x);
  return (lt) => {
    snow.update(lt); ph.update(lt);
    show(t1, lt, H.at("n22", 0), { dy: 24 });
    show(frame, lt, 0.2, { dy: 30, scale: 0.96 });
    // 雪かき前 → 後 へワイプ（押す前に終わる）→ カメラの枠 → シャッター
    const w = pr(lt, 0.7, Math.max(0.6, tTap - 0.9), Ease.io);
    q("#aft").style.width = w * W + "px"; q("#wl").style.left = w * W - 3 + "px"; q("#wl").style.opacity = w > 0.01 && w < 0.99 ? 1 : 0;
    q("#lb").textContent = w > 0.5 ? "雪かきのあと" : "雪かきの前";
    q("#vf").style.opacity = pr(lt, tTap, 0.2, Ease.lin) * (1 - pr(lt, tShut + 0.25, 0.3, Ease.lin));
    const f = lt - tShut; q("#flash").style.opacity = f > 0 && f < 0.5 ? 0.95 * (1 - f / 0.5) : 0;
    show(tg, lt, H.at("n23", 0), { dy: 18 });
    checks.forEach((c, i) => show(c, lt, H.mid("n23", 0.3 + i * 0.22), { dy: 14, scale: 0.92, d: 0.35, ease: Ease.back }));
    void tClear;
  };
};

// ── その朝だけのカード（Claude が毎回ゼロから描く）──
SC.card = (root, s, H) => {
  const snow = demoBg(root, 16);
  const ph = Phone(root, { x: PX, y: PY, h: PHH, label: "手伝う人の画面（田中さん）", clips: EDIT.clips.card.a });
  const tTap = H.g("cardTap");
  const lens = Lens(root, ph, { x: RX, y: 150, w: 520, h: 696, sx: 62, sy: 128, sw: 266, radius: 26 });
  const cx = RX + 580;
  const t1 = add(root, `<div class="abs h1" style="left:${cx}px;top:136px;font-size:64px;line-height:1.3">その朝だけの、<br><span class="lampc">1枚。</span></div>`);
  const tg = add(root, `<div class="abs" style="left:${cx}px;top:350px">${tagHtml("Claude", "カードの絵")}</div>`);
  const steps = [["1", "その朝の事実を渡す", "空・雪・人数・チームの色"], ["2", "SVG でゼロから描く", "画像生成 AI は使わない"], ["3", "自分の絵を見て、描き直す", "はみ出し・重なりを直す"]]
    .map(([n, a, b], i) => add(root, `<div class="abs" style="left:${cx}px;top:${452 + i * 124}px;display:flex;gap:18px;align-items:center"><div style="width:62px;height:62px;border-radius:50%;background:#fff;color:#29445c;font-size:36px;font-weight:900;display:grid;place-items:center;flex:none">${n}</div><div><div style="font-size:40px;font-weight:900;line-height:1.2">${a}</div><div class="small" style="font-size:27px">${b}</div></div></div>`));
  return (lt) => {
    snow.update(lt); ph.update(lt); lens.update();
    show(t1, lt, H.at("n24", 0), { dy: 24 });
    const kl = pr(lt, tTap + 2.0, 0.6, Ease.back);
    lens.el.style.opacity = clamp((lt - (tTap + 2.0)) / 0.3); lens.el.style.transform = `scale(${0.8 + 0.2 * kl}) rotate(${-4 + 3 * kl}deg)`;
    show(tg, lt, H.mid("n24", 0.3), { dy: 16 });
    steps.forEach((el, i) => show(el, lt, H.mid("n24", 0.42) + i * 0.5, { dx: 30, dy: 0 }));
  };
};

// ── そして、ありがとう。ここだけは AI に書かせない ──
SC.thanks = (root, s, H) => {
  root.innerHTML = `<div class="full" style="background:radial-gradient(120% 90% at 50% 0%,#3b3550 0%,#221f33 62%,#17141f 100%)"></div>`;
  const snow = snowLayer(17, 40, { alpha: 0.28, speed: 0.5 }); root.append(snow);
  const ph = Phone(root, { x: PX, y: PY, h: PHH, label: "頼んだ家の画面（小林さんの家族）", clips: EDIT.clips.thanks.c });
  const t1 = add(root, `<div class="abs h1" style="left:${RX}px;top:170px;font-size:92px">そして、ありがとう。</div>`);
  const t2 = add(root, `<div class="abs h1" style="left:${RX}px;top:340px;font-size:84px;line-height:1.3;color:#f4c9d6">ここだけは、<br>AI に書かせない。</div>`);
  const chips = ["文字にしない", "要約しない", "AI に渡さない", "聞けるのは手伝った人だけ", "7日で消える"].map((t, i) => add(root, `<div class="abs chip" style="left:${RX + [0, 232, 430, 0, 420][i]}px;top:${i < 3 ? 640 : 716}px;font-size:32px;border-color:rgba(244,201,214,.5)">${t}</div>`));
  return (lt) => {
    snow.update(lt); ph.update(lt);
    show(t1, lt, H.at("n26", -0.05), { dy: 26 });
    show(t2, lt, H.at("n27", -0.05), { dy: 26 });
    chips.forEach((c, i) => show(c, lt, H.mid("n27", 0.35) + i * 0.16, { dy: 14, scale: 0.9, d: 0.35, ease: Ease.back }));
  };
};

// ── 声（音楽を止める）: 孫が吹き込み、手伝った人に届く ──
SC.voice = (root, s, H) => {
  root.innerHTML = `<div class="full" style="background:radial-gradient(110% 100% at 50% 20%,#2b2740 0%,#17141f 70%)"></div>`;
  const ph = Phone(root, { x: PX, y: PY, h: PHH, label: "頼んだ家の画面（東京の孫が吹き込む）", clips: EDIT.clips.voice.c });
  const L = s.lines[0];
  const t0 = L.at - s.start, t1 = t0 + L.dur;
  const env = (TL.env && TL.env[L.id]) || null;
  const who = add(root, `<div class="abs" style="left:${RX}px;top:118px;font-size:36px;font-weight:700;color:#e8c5d2">🎤 東京で暮らす孫から、手伝ってくれた人へ</div>`);
  const NB = 64, bw = 11, bg = 5.6;
  const wave = add(root, `<div class="abs" style="left:${RX}px;top:210px;width:1070px;height:220px;display:flex;align-items:center;gap:${bg}px">${Array.from({ length: NB }, () => `<i style="display:block;width:${bw}px;height:8px;border-radius:6px;background:#f4c9d6"></i>`).join("")}</div>`);
  const bars = [...wave.querySelectorAll("i")];
  const parts = ["おばあちゃんの家の雪かき、", "ありがとうございます。", "東京にいて、何もできなかったので、", "本当に助かりました。"];
  const quote = add(root, `<div class="abs" style="left:${RX}px;top:466px;width:1120px;font-size:62px;font-weight:900;line-height:1.5;color:#fff;white-space:nowrap">${parts.map((p, i) => `<span class="q${i}">${i === 0 ? "「" : "　"}${p}${i === 3 ? "」" : ""}</span>`).join("<br>")}</div>`);
  const spans = parts.map((_, i) => quote.querySelector(".q" + i));
  const total = parts.join("").length + parts.length;
  const hA = 660;
  const pa = Phone(root, { x: 1440, y: 190, h: hA, label: "手伝った人の画面（田中さん）", clips: EDIT.clips.voice.a, taps: false });
  const fin = add(root, `<div class="abs h1" style="left:${RX}px;top:380px;font-size:104px;line-height:1.3">声は、<br><span style="color:#f4c9d6">声のまま届く。</span></div>`);
  const note = add(root, `<div class="abs" style="left:${RX}px;top:1040px;font-family:var(--sans);font-size:21px;font-weight:600;color:#8d86a3">${TL.voiceNote || ""}</div>`);
  const r = rng(5); const seedv = Array.from({ length: NB }, () => r());
  const tSent = H.g("voiceSent");
  return (lt) => {
    ph.update(lt); pa.update(lt);
    show(who, lt, 0.2, { dy: 12 });
    // 声の大きさに合わせて波が動く（声がないときは小さく息をする）
    const speaking = lt >= t0 && lt <= t1;
    const amp = env ? (env[clamp(Math.round((lt - t0) * FPS), 0, env.length - 1)] || 0) : speaking ? 0.6 + 0.4 * Math.sin(lt * 9) : 0;
    bars.forEach((b, i) => { const c = 1 - Math.abs(i - NB / 2) / (NB / 2); const v = speaking ? amp * (0.35 + 0.65 * Math.abs(Math.sin(lt * (5 + seedv[i] * 9) + i * 0.7))) * (0.45 + 0.55 * c) : 0.03 + 0.02 * Math.sin(lt * 2 + i * 0.4); b.style.height = 8 + v * 200 + "px"; b.style.opacity = speaking ? 0.95 : 0.4; });
    // ことばは、話したところまで明るく
    const said = clamp((lt - t0) / (t1 - t0)) * total;
    let acc = 0;
    spans.forEach((sp, i) => { const n = parts[i].length + 1; const k = clamp((said - acc) / n); sp.style.background = `linear-gradient(90deg,#fff ${k * 100}%,rgba(255,255,255,.28) ${k * 100}%)`; sp.style.webkitBackgroundClip = "text"; sp.style.backgroundClip = "text"; sp.style.color = "transparent"; acc += n; });
    const gone = pr(lt, tSent - 0.25, 0.4, Ease.lin);
    quote.style.opacity = pr(lt, t0 - 0.3, 0.4, Ease.lin) * (1 - gone);
    wave.style.opacity = 1 - gone; who.style.opacity = Math.min(+who.style.opacity, 1 - gone);
    show(fin, lt, tSent + 0.05, { dy: 26 });
    // 届ける → 手伝った人のスマホが出る
    const k = pr(lt, tSent + 0.1, 0.6, Ease.back);
    pa.el.style.opacity = clamp((lt - tSent - 0.1) / 0.25); pa.el.style.transform = `translateY(${(1 - k) * 80}px) rotate(${3 - 3 * k}deg)`;
    note.style.opacity = pr(lt, 0.5, 0.4, Ease.lin);
  };
};

// ── AI は段取りを。人は、会いに行く ──
SC.principle = (root, s, H) => {
  root.innerHTML = `<div class="full bg-deep"></div>`;
  const snow = snowLayer(18, 40, { alpha: 0.3, speed: 0.5 }); root.append(snow);
  const t1 = add(root, `<div class="abs" style="left:0;width:960px;top:120px;text-align:center;font-size:104px;font-weight:900">AI は、<span style="color:#bfe0ee">段取り</span>を。</div>`);
  const t2 = add(root, `<div class="abs" style="left:960px;width:960px;top:120px;text-align:center;font-size:104px;font-weight:900">人は、<span class="lampc">会いに行く。</span></div>`);
  const col = (x, cls, title, items) => add(root, `<div class="card" style="left:${x}px;top:330px;width:820px;height:560px;border-color:${cls === "ai" ? "#8fb8c9" : "#d9825b"}"><div style="padding:36px 50px"><div style="font-size:40px;font-weight:900;color:${cls === "ai" ? "#bfe0ee" : "#ffd0b5"}">${title}</div><ul style="list-style:none;padding:0;margin:22px 0 0">${items.map((t) => `<li style="font-size:38px;font-weight:700;line-height:1.5;margin-top:14px">${t}</li>`).join("")}</ul></div></div>`);
  const c1 = col(110, "ai", "Claude に任せる", ["🧭 家ごとの人数・担当・理由", "📷 写真で「通れるか」を確かめる", "🎴 カードを描く・雪に名前をつける", "💬 相談にのる・5つのことばに訳す"]);
  const c2 = col(990, "human", "AI に任せない（人とプログラム）", ["🎤 「ありがとう」は、本人の声で", "🔢 点数・雪の重さは、計算で", "🌙 夜は行かせない。決めるのは時計", "🩺 体調や医療は、判断しない"]);
  return (lt) => {
    snow.update(lt);
    show(t1, lt, H.at("n28", -0.1), { dy: 24, scale: 0.95 });
    show(t2, lt, H.at("n29", -0.1), { dy: 24, scale: 0.95 });
    show(c1, lt, H.at("n28", 0.25), { dy: 40 });
    show(c2, lt, H.at("n29", 0.2), { dy: 40 });
  };
};

// ── 雪かきができなくても手伝える／お年寄りは教える側に ──
SC.more = (root, s, H) => {
  const snow = demoBg(root, 19);
  const C = EDIT.clips.more;
  const h = 800;
  const p1 = Phone(root, { x: 110, y: 104, h, clips: C.a, taps: true });
  const p2 = Phone(root, { x: 1430, y: 104, h, clips: C.b, taps: true });
  const b1 = add(root, `<div class="abs" style="left:560px;top:130px;width:820px"><div class="tag blue" style="font-size:34px"><span>🧊 道の危険を知らせる</span></div>
    <div class="h1" style="font-size:60px;margin-top:22px;line-height:1.3">雪かきができなくても、<br><span class="lampc">写真1枚で手伝える。</span></div>
    <div class="small" style="font-size:29px;margin-top:14px">つるつる・除雪まだ・道が細い… 近くの人のスマホに届く。<br>顔・表札・ナンバーは、AI がぼかしてから。</div></div>`);
  const b2 = add(root, `<div class="abs" style="left:560px;top:540px;width:820px;text-align:right"><div class="tag blue" style="font-size:34px"><span>📖 雪の聞き書き・町の週刊絵本</span></div>
    <div class="h1" style="font-size:60px;margin-top:22px;line-height:1.3">お年寄りは、<br><span class="lampc">教える側・語る側に。</span></div>
    <div class="small" style="font-size:29px;margin-top:14px">隊長が1問ずつ聞いて、語りのまま絵本の1ページに。<br>印刷して、スマホのない人にも。</div></div>`);
  return (lt) => {
    snow.update(lt); p1.update(lt); p2.update(lt);
    const k1 = pr(lt, 0.05, 0.5), k2 = pr(lt, H.at("n31", -0.5), 0.5);
    p1.el.style.opacity = k1; p1.el.style.transform = `translateY(${(1 - k1) * 30}px)`;
    p2.el.style.opacity = 0.35 + 0.65 * k2; p2.el.style.transform = `translateY(${(1 - k2) * 20}px)`;
    show(b1, lt, H.at("n30", 0), { dx: -30, dy: 0 });
    show(b2, lt, H.at("n31", -0.1), { dx: 30, dy: 0 });
  };
};
