// 第3章 Claude の活用: 作った人と作り方 → ループ・サブエージェント・Skill・定期タスク → 報告箱 → GitHub → Claude Code → 本人 → モデルの使い分け
// 画面に出す指示・コミット・設定は、このリポジトリの本物（docs/devlog.md・git log・.claude/）。

// 本人が Claude Code に送った指示（docs/devlog.md の「本人「…」」から。そのままの文）
const ASKS = [
  "アイコンをもっと分かりやすく。言葉を読まないと分からないのは NG",
  "物足りない。続けて改善",
  "雪かきできなくても、ツルツルで危ない道などの共有で手伝えるのを追加したい",
  "事実の羅列では心は動かない。5年後10年後を考えた、今の人たちへのアプリだと伝えたい",
  "チャット来た時下に自動スクロールしないのがある",
  "PC表示対応にして欲しい",
  "処理が遅い、そしてみんなオレンジになる",
  "半分くらい端に埋めて目が出てるくらいで",
  "もう少し透明感を入れつつ盛り上がる場所も作って",
  "まだまだクオリティ上げて",
];
const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");

// ── 作った人と、作り方 ──
SC.maker = (root, s, H) => {
  root.innerHTML = `<div class="full bg-deep"></div>`;
  const snow = snowLayer(41, 36, { alpha: 0.25, speed: 0.5 }); root.append(snow);
  // 左: スマホの中の Claude Code（本人の指示 → コミット が流れる）
  const commits = [...TL.commits].reverse(); // 古い順
  const pick = (i) => commits[Math.floor((i / 30) * (commits.length - 1))];
  let items = "", ci = 0;
  ASKS.forEach((a, i) => {
    items += `<div class="mk me">${esc(a)}</div>`;
    for (let k = 0; k < 3; k++) { const c = pick(ci++); if (c) items += `<div class="mk cc"><span class="at">${c.at}</span>${esc(c.text.length > 54 ? c.text.slice(0, 53) + "…" : c.text)}</div>`; }
  });
  const w = 590, h = 940;
  const panel = add(root, `<div class="ph" style="left:${PX - 30}px;top:${PY}px;width:${w}px;height:${h}px"><div class="ph-screen" style="background:#f4f7fa">
      <div style="position:absolute;left:0;right:0;top:0;z-index:2;background:#29445c;color:#fff;padding:22px 26px 16px;font-size:27px;font-weight:900">Claude Code<span style="font-size:19px;font-weight:700;color:#b7c7d6;margin-left:12px">スマホの Claude アプリから</span></div>
      <div style="position:absolute;left:0;right:0;top:78px;bottom:0;overflow:hidden"><div id="list" style="padding:16px 18px;display:flex;flex-direction:column;gap:11px;will-change:transform">${items}</div></div>
    </div><div class="ph-label">本人の指示と、コミットの記録（どちらも本物）</div></div>`);
  const list = panel.querySelector("#list");
  const X = RX + 90;
  const t1 = add(root, `<div class="abs h1" style="left:${X}px;top:118px;font-size:74px;line-height:1.3">作ったのは、<span class="lampc">学生服の営業。</span></div>`);
  const t1b = add(root, `<div class="abs h3" style="left:${X + 4}px;top:232px;font-size:42px;color:#fff">プログラミングは、初心者です。</div>`);
  const zero = add(root, `<div class="abs" style="left:${X}px;top:356px;display:flex;align-items:flex-end;gap:26px;line-height:1"><span style="font-size:58px;font-weight:900;padding-bottom:36px">自分で書いたコード</span><span id="z" style="font-size:300px;font-weight:900;color:var(--lamp-light);letter-spacing:-.03em;line-height:.82">0</span><span style="font-size:76px;font-weight:900;padding-bottom:30px">行</span></div>`);
  const t2 = add(root, `<div class="abs h2" style="left:${X}px;top:668px;font-size:54px;line-height:1.4">スマホから <span class="lampc">Claude Code</span> に、<br>日本語で頼んだだけ。</div>`);
  const t3 = add(root, `<div class="abs small" style="left:${X + 4}px;top:838px;font-size:30px">開発環境：ソファーの上のスマホ ／ 本人の役割：判断・鍵の準備・実機の確認</div>`);
  return (lt) => {
    snow.update(lt);
    list.style.transform = `translateY(${-(20 + lt * 86)}px)`;
    show(panel, lt, 0.05, { dy: 30 });
    show(t1, lt, H.at("n32", 0), { dy: 24 });
    show(t1b, lt, H.mid("n32", 0.55), { dy: 16 });
    show(zero, lt, H.at("n33", 0), { dy: 0, scale: 0.9, d: 0.5, ease: Ease.back });
    show(t2, lt, H.mid("n33", 0.4), { dy: 22 });
    show(t3, lt, H.mid("n33", 0.8), { dy: 12 });
  };
};

// ── ループで自走・企画役（サブエージェント）・点検ループ（Skill ＋ 定期タスク）──
SC.loop = (root, s, H) => {
  root.innerHTML = `<div class="full bg-deep"></div>`;
  const snow = snowLayer(42, 36, { alpha: 0.25, speed: 0.5 }); root.append(snow);
  const CX = 440, CY = 590, R = 262;
  const nodes = [["仕様を決める", "docs/spec.md"], ["タスクを1つ", "docs/tasks.md"], ["実装する", ""], ["確かめる", "npm run check"], ["自分の目で見る", "画面のスクショ"], ["コミットと記録", "devlog.md"]];
  const ring = add(root, `<svg class="abs" style="left:0;top:0" width="900" height="1080" viewBox="0 0 900 1080">
    <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="5" stroke-dasharray="4 14" stroke-linecap="round"/>
    <circle id="arc" cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="#d9825b" stroke-width="7" stroke-linecap="round" stroke-dasharray="${2 * Math.PI * R}" transform="rotate(-90 ${CX} ${CY})"/>
    <circle id="dot" r="15" fill="#ffd0b5"/><circle id="dot2" r="26" fill="#ffd0b5" opacity=".25"/></svg>`);
  const center = add(root, `<div class="abs" style="left:${CX - 200}px;top:${CY - 92}px;width:400px;text-align:center"><div class="mono" style="font-size:86px;font-weight:800;color:#fff">/loop</div><div style="font-size:30px;font-weight:700;color:#c4d3e0;margin-top:2px">CLAUDE.md の手順で自走</div></div>`);
  const els = nodes.map(([a, b], i) => {
    const ang = (-90 + i * 60) * Math.PI / 180, x = CX + Math.cos(ang) * R, y = CY + Math.sin(ang) * R;
    return add(root, `<div class="abs nd" style="left:${x - 135}px;top:${y - 44}px;width:270px;height:88px;border-radius:44px;background:#fff;color:#29445c;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 12px 26px rgba(0,0,0,.3)"><div style="font-size:31px;font-weight:900;line-height:1.15">${a}</div>${b ? `<div class="mono" style="font-size:19px;font-weight:600;color:#6d8497">${b}</div>` : ""}</div>`);
  });
  const hd = add(root, `<div class="abs h1" style="left:110px;top:92px;font-size:66px">仕様を先に決めて、<span class="lampc">ループで自走。</span></div>`);
  const cardHtml = (top, hgt, head, sub, code, body) => `<div class="card" style="left:930px;top:${top}px;width:900px;height:${hgt}px;background:rgba(8,16,25,.5)"><div style="padding:26px 36px">
      <div style="display:flex;align-items:center;gap:16px"><div class="tag" style="font-size:30px;padding:8px 22px 8px 16px">${SPARK()}<span>${head}</span></div><span style="font-size:28px;font-weight:700;color:#c4d3e0">${sub}</span></div>
      <div style="display:flex;gap:30px;margin-top:20px;align-items:flex-start"><div class="code" style="font-size:23px;line-height:1.48;flex:none">${code}</div><div style="font-size:31px;font-weight:700;line-height:1.5">${body}</div></div></div></div>`;
  const k1 = add(root, cardHtml(236, 318, "企画役 kikaku", "サブエージェント",
    `<span class="c">.claude/agents/kikaku.md</span>\n<span class="k">model</span>: <span class="s">fable</span>\n<span class="k">effort</span>: <span class="s">max</span>\n<span class="k">tools</span>: <span class="s">WebSearch,\n  WebFetch, Write…</span>`,
    `Web で<b class="lampc">事例と数字</b>を調べ、<br>出典つきの提案書を書く。<br><span style="font-size:27px;color:#c4d3e0">docs/ideas/ に 7本。採るかは本人が決める</span>`));
  const k2 = add(root, cardHtml(586, 372, "点検ループ /tenken", "Skill ＋ 定期タスク ＋ サブエージェント",
    `<span class="c">.claude/skills/tenken</span>\n<span class="k">every</span>: <span class="s">4 hours</span>\n<span class="k">look</span>: <span class="s">全画面 × 2サイズ</span>\n<span class="c">.claude/agents/tenken.md</span>\n<span class="k">role</span>: <span class="s">見つけるだけ</span>`,
    `<b class="lampc">4時間ごと</b>に自動で起動。<br>点検役が画面を見て見つけ、<br>小さいものは直してコミット。<br><span style="font-size:27px;color:#c4d3e0">大きいものは積み、提案は人が決める（11回）</span>`));
  const arc = ring.querySelector("#arc"), dot = ring.querySelector("#dot"), dot2 = ring.querySelector("#dot2");
  const C = 2 * Math.PI * R;
  return (lt) => {
    snow.update(lt);
    show(hd, lt, H.at("n34", 0), { dy: 22 });
    const turn = (lt * 0.26) % 1; // 1周 約3.8秒
    arc.setAttribute("stroke-dashoffset", C * (1 - turn));
    const ang = (-90 + turn * 360) * Math.PI / 180, x = CX + Math.cos(ang) * R, y = CY + Math.sin(ang) * R;
    dot.setAttribute("cx", x); dot.setAttribute("cy", y); dot2.setAttribute("cx", x); dot2.setAttribute("cy", y);
    els.forEach((el, i) => {
      const k = pr(lt, 0.15 + i * 0.09, 0.45, Ease.back);
      const d = Math.abs(((turn * 6 - i + 6.5) % 6) - 0.5); // その節を通るとき明るく
      const hot = clamp(1 - d * 2.2);
      el.style.opacity = clamp((lt - 0.15 - i * 0.09) / 0.2); el.style.transform = `scale(${(0.7 + 0.3 * k) * (1 + hot * 0.08)})`;
      el.style.background = hot > 0.3 ? "#ffd0b5" : "#fff";
    });
    show(center, lt, 0.4, { dy: 0, scale: 0.9, ease: Ease.back });
    show(k1, lt, H.at("n35", -0.05), { dx: 40, dy: 0 });
    show(k2, lt, H.at("n36", -0.05), { dx: 40, dy: 0 });
  };
};

// ── 報告箱 → GitHub Issue → Claude Code が直す → 本人に「直しました」──
SC.feedback = (root, s, H) => {
  root.innerHTML = `<div class="full bg-deep"></div>`;
  const snow = snowLayer(43, 36, { alpha: 0.25, speed: 0.5 }); root.append(snow);
  const hd = add(root, `<div class="abs h1" style="left:110px;top:92px;font-size:68px">使う人の「分かりにくい」が、<span class="lampc">そのまま直る。</span></div>`);
  const N = [["📮", "隊長に伝える", "アプリの報告箱<br>（声でも送れる）"], [`<svg width="70" height="70" viewBox="0 0 70 70"><circle cx="35" cy="35" r="27" fill="none" stroke="#29445c" stroke-width="7"/><circle cx="35" cy="35" r="9" fill="#29445c"/></svg>`, "GitHub Issue", "名前と住所を<br>除いて届く"], ["", "Claude Code", "点検ループが読む<br>（GitHub MCP）"], ["✅", "直してコミット", "テストが通って<br>から本番へ"], ["💬", "「直しました」", "報告した本人の<br>隊長トークに届く"]];
  const W = 310, G = 44, X0 = (1920 - (W * 5 + G * 4)) / 2, Y = 300, Hh = 380;
  const cards = N.map(([ic, a, b], i) => add(root, `<div class="card" style="left:${X0 + i * (W + G)}px;top:${Y}px;width:${W}px;height:${Hh}px;background:rgba(8,16,25,.5);text-align:center">
      <div style="margin:40px auto 0;width:124px;height:124px;border-radius:50%;background:${i === 2 ? "var(--lamp)" : "#fff"};display:grid;place-items:center;font-size:64px">${i === 2 ? SPARK().replace('class="spark"', 'width="74" height="74"') : ic}</div>
      <div style="font-size:39px;font-weight:900;margin-top:26px;white-space:nowrap">${a}</div><div style="font-size:27px;font-weight:700;color:#c4d3e0;line-height:1.45;margin-top:10px">${b}</div></div>`));
  const arrows = [0, 1, 2, 3].map((i) => add(root, `<svg class="abs" style="left:${X0 + i * (W + G) + W - 4}px;top:${Y + Hh / 2 - 26}px" width="${G + 8}" height="52" viewBox="0 0 52 52"><path d="M4 26 H40 M28 12 L42 26 L28 40" fill="none" stroke="#ffd0b5" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>`));
  const pkt = add(root, `<div class="abs" style="left:0;top:${Y - 30}px;width:60px;height:60px;border-radius:50%;background:radial-gradient(circle,#fff 0%,#ffd0b5 45%,rgba(255,208,181,0) 72%)"></div>`);
  const foot = add(root, `<div class="abs h3" style="left:0;width:1920px;top:742px;text-align:center;font-size:40px;color:#fff">小さな不具合は、人が寝ているあいだに直る。<span style="color:#c4d3e0">大きな変更は、人が決める。</span></div>`);
  const ta = H.at("n37", 0.3), tb = H.end("n38", -0.4);
  return (lt) => {
    snow.update(lt);
    show(hd, lt, 0.2, { dy: 22 });
    const p = clamp((lt - ta) / (tb - ta)) * 4; // 0〜4（節の番号）
    cards.forEach((c, i) => {
      show(c, lt, 0.3 + i * 0.1, { dy: 36 });
      const on = p >= i - 0.15;
      c.style.borderColor = on ? "#ffd0b5" : "rgba(255,255,255,.16)";
      c.style.background = on ? "rgba(217,130,91,.22)" : "rgba(8,16,25,.5)";
    });
    arrows.forEach((a, i) => { a.style.opacity = pr(lt, 0.5 + i * 0.1, 0.3, Ease.lin) * (p >= i + 0.5 ? 1 : 0.35); });
    pkt.style.opacity = lt > ta - 0.2 && p < 4 ? 1 : 1 - pr(lt, tb, 0.3, Ease.lin);
    pkt.style.left = X0 + W / 2 - 30 + Ease.io(p / 4) * 0 + p * (W + G) + "px";
    pkt.style.transform = `scale(${1 + 0.25 * Math.sin(lt * 9)})`;
    show(foot, lt, H.at("n38", 0.6), { dy: 16 });
  };
};

// ── モデルの使い分けと、AI に決めさせないこと ──
SC.models = (root, s, H) => {
  root.innerHTML = `<div class="full bg-deep"></div>`;
  const snow = snowLayer(44, 36, { alpha: 0.25, speed: 0.5 }); root.append(snow);
  const hd = add(root, `<div class="abs h1" style="left:110px;top:92px;font-size:66px">目的に合わせて、<span class="lampc">モデルを使い分ける。</span></div>`);
  const col = (x, color, head, sub, items, w = 540) => add(root, `<div class="card" style="left:${x}px;top:236px;width:${w}px;height:560px;border-color:${color};background:rgba(8,16,25,.5)"><div style="padding:32px 38px">
      <div style="font-size:44px;font-weight:900;color:${color};white-space:nowrap">${head}</div><div style="font-size:30px;font-weight:700;color:#c4d3e0;margin-top:2px">${sub}</div>
      <ul style="list-style:none;padding:0;margin:24px 0 0">${items.map((t) => `<li style="font-size:35px;font-weight:700;line-height:1.36;margin-top:17px">${t}</li>`).join("")}</ul></div></div>`);
  const c1 = col(110, "#ffd0b5", "Claude Opus 5.5", "重い判断・目で見る・絵を描く", ["🧭 割り振り（司令官）", "📷 写真の確認（画像入力）", "🎴 カードの絵（SVG）", "🎵 今朝の雪の歌を作曲"]);
  const c2 = col(690, "#bfe0ee", "Claude Haiku 5.5", "短い文・速さがほしい所", ["❄ 雪の名前と前夜の予告", "💬 相談の返事（道具で調べる）", "🌐 5つのことばに翻訳", "✍ プロフィール・誘いの文"]);
  const c3 = col(1270, "#f4c9d6", "AI に決めさせない", "プログラムと、人が決める", ["🔢 点数・雪の重さ（kg）", "🌙 夜は行かせない（19〜6時）", "🩺 体調・医療の判断", "🎤 「ありがとう」のことば"]);
  const foot = add(root, `<div class="abs" style="left:0;width:1920px;top:828px;display:flex;justify-content:center;gap:18px">${["採点表 rubric.json を毎回渡す", "答えは JSON（構造化出力）", "プログラムが点検してから使う", "鍵がなくても同じ形で動く"].map((t) => `<div class="chip" style="font-size:29px">${t}</div>`).join("")}</div>`);
  return (lt) => {
    snow.update(lt);
    show(hd, lt, 0.15, { dy: 22 });
    show(c1, lt, H.at("n39", 0), { dy: 40 });
    show(c2, lt, H.mid("n39", 0.5), { dy: 40 });
    show(c3, lt, H.at("n40", -0.1), { dy: 40 });
    show(foot, lt, H.mid("n40", 0.5), { dy: 14 });
  };
};
