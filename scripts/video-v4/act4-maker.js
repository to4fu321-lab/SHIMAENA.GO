// 第4幕「作った人と、作り方」: 初心者がスマホから日本語で頼んだ7日間 → 夜の点検ループ → 隊長の決まり → この動画のこと。
ACTS.push({ from: "maker", to: "motto", make(root) {
  // 本人が実際に送った指示（docs/devlog.md の「本人「…」」から）
  const ASKS = ["隊長の言葉がずっと同じ", "アイコンをもっと分かりやすく。言葉を読まないと分からないのは NG", "仲間を増やす仕掛けに進めて", "物足りない。続けて改善", "README 長すぎる", "事実の羅列では心は動かない", "雪かきできなくても、ツルツルで危ない道の共有で手伝えるようにしたい", "もっと可愛い形で", "チャット来た時、下に自動スクロールしないのがある", "PC表示対応にして欲しい"];
  const C = TL.commits;
  root.innerHTML = `
    <div class="full" style="background:linear-gradient(160deg,#122033 0%,#1a2d44 55%,#101b2a 100%)"></div>
    <div class="full" id="a4a">
      <div class="abs" id="a4ph" style="left:130px;top:96px;width:440px;height:800px;border-radius:56px;background:#0b131c;box-shadow:0 30px 70px rgba(0,0,0,.5),0 0 0 2px rgba(255,255,255,.14) inset">
        <div class="abs" style="inset:11px;border-radius:46px;overflow:hidden;background:#f6f3ee">
          <div style="height:74px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:12px;gap:10px;font-family:var(--sans);font-weight:800;font-size:24px;color:#1e3346;border-bottom:2px solid #e6dfd4">${SPARK("#d97757", 28)} Claude Code</div>
          <div class="abs" id="a4chat" style="left:0;right:0;top:76px;bottom:0;overflow:hidden"><div id="a4list" style="position:absolute;left:14px;right:14px;top:0;display:flex;flex-direction:column;gap:12px;padding-top:14px"></div></div>
        </div></div>
      <div class="abs" id="a4who" style="left:680px;top:150px;width:1160px">
        <div class="kick" style="color:#ffb37f">ぼくを作った人</div>
        <div id="a4w1" style="font-size:104px;font-weight:900;line-height:1.2;margin-top:6px">学生服の営業。</div>
        <div id="a4w2" class="body" style="color:#c9d7e4;font-size:40px;margin-top:8px">札幌に来て15年。毎年、雪かきで腰を痛める。</div>
        <div id="a4w3" style="font-size:84px;font-weight:900;line-height:1.25;margin-top:56px;color:#ffd59a">プログラミングは、初めて。</div>
        <div id="a4w4" class="body" style="color:#c9d7e4;font-size:40px;margin-top:8px">スマホから、日本語で、Claude Code に頼んだ。</div>
      </div>
      <div class="abs" id="a4wk" style="left:680px;top:110px;width:1180px">
        <div style="display:flex;gap:26px">${[["7", "日間", "#fff"], ["354", "コミット", "#ffcfae"], ["572", "本のテスト", "#a9d3e6"]].map(([n, u, c], i) => `<div class="glass a4n" style="position:relative;flex:${i ? 1.25 : 0.8};padding:20px 0 24px;text-align:center"><div style="font-size:132px;font-weight:900;line-height:1.05;color:${c}"><span class="a4v" data-n="${n}">0</span></div><div style="font-family:var(--sans);font-size:32px;font-weight:800;color:#c9d7e4">${u}</div></div>`).join("")}</div>
        <div class="glass" id="a4log" style="position:relative;margin-top:26px;height:330px;overflow:hidden;padding:0 26px"><div id="a4lines" class="mono" style="position:absolute;left:26px;right:26px;top:0;font-size:23px;line-height:44px;color:#b9cbdb;white-space:nowrap"></div></div>
        <div class="card" id="a4loop" style="left:0;top:262px;width:1180px;height:390px;background:#f6f3ee">
          <svg class="abs" style="left:44px;top:45px" width="300" height="300" viewBox="0 0 300 300"><circle cx="150" cy="150" r="118" fill="#1a2d44"/><circle cx="150" cy="150" r="118" fill="none" stroke="#e8834f" stroke-width="10" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" id="a4ring" transform="rotate(-90 150 150)" stroke-linecap="round"/>
            ${[2, 6, 10, 14, 18, 22].map((h, i) => { const a = (h / 24) * 6.2832 - 1.5708, x = 150 + Math.cos(a) * 118, y = 150 + Math.sin(a) * 118; return `<circle class="a4tick" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="15" fill="#fff" stroke="#e8834f" stroke-width="6"/>`; }).join("")}
            <text x="150" y="150" text-anchor="middle" font-size="56">🌙</text><text x="150" y="200" text-anchor="middle" font-family="JetBrains Mono" font-size="24" font-weight="700" fill="#b9cbdb">24h</text></svg>
          <div class="abs" style="left:384px;top:44px;right:36px"><div class="kick" style="font-size:28px;letter-spacing:.06em">点検ループ <span class="mono">/tenken</span> ─ 定期タスクで4時間おき</div>
            <div style="display:flex;flex-wrap:wrap;gap:12px 10px;margin-top:22px;align-items:center;font-family:var(--sans);font-weight:800;font-size:31px;color:#1e3346">${["全部の画面を開く", "見つける", "直す", "確かめる", "コミット"].map((w, i) => `<span class="a4st chip" style="background:#1e3346;color:#fff;font-size:27px;padding:8px 18px">${w}</span>${i < 4 ? '<span class="a4st" style="color:#e8834f;font-size:34px">→</span>' : ""}`).join("")}</div>
            <div class="body" style="margin-top:22px;font-size:28px;line-height:1.5;color:#4a637a">人が寝ているあいだも、自分で見て、自分で直す。<br>町の人の「分かりにくい」も、アプリからここに届く。</div></div>
        </div>
      </div>
    </div>
    <div class="full" id="a4r">
      <div class="abs kick" id="a4rk" style="left:0;right:0;top:120px;text-align:center;color:#ffb37f;font-size:38px">隊長の決まり</div>
      ${[["点数・安全", "ぼくが決めない", "プログラムが計算する"], ["体のこと", "判断しない", "段取りと作業の話だけ"], ["ありがとう", "人が伝える", "AI は書かない・要約しない"]].map(([a, b, c], i) => `<div class="glass a4rule" style="left:${150 + i * 560}px;top:222px;width:500px;height:500px;text-align:center">
        <div style="margin-top:44px;font-family:var(--sans);font-size:38px;font-weight:800;color:#c9d7e4">${a}</div>
        <div style="margin:26px auto 0;width:150px;height:150px;border-radius:50%;border:10px solid ${i === 2 ? "#ffd59a" : "#ff9c8a"};display:grid;place-items:center;font-size:96px;font-weight:900;color:${i === 2 ? "#ffd59a" : "#ff9c8a"};line-height:1">${i === 2 ? "♥" : "✕"}</div>
        <div style="margin-top:26px;font-size:60px;font-weight:900">${b}</div><div style="margin-top:10px;font-family:var(--sans);font-size:30px;font-weight:700;color:#a9d3e6">→ ${c}</div></div>`).join("")}
    </div>
    <div class="full" id="a4m"><div class="abs" style="left:0;right:0;top:250px;text-align:center"><div id="a4m1" style="font-size:136px;font-weight:900;line-height:1.3">${SPARK("#e8834f", 110)} AI は、段取りを。</div><div id="a4m2" style="font-size:136px;font-weight:900;line-height:1.3;color:#ffd59a;text-shadow:0 0 70px rgba(255,170,90,.4)">人は、会いに行く。</div></div></div>
    <div class="full" id="a4x">
      <div class="abs kick" style="left:170px;top:150px;color:#ffb37f">この動画の、頼まれ方（原文）</div>
      <div class="abs" id="a4x1" style="left:170px;top:214px;width:960px;padding:36px 44px;border-radius:44px 44px 10px 44px;background:#e8834f;font-family:var(--sans);font-size:47px;font-weight:800;line-height:1.55;box-shadow:0 24px 60px rgba(0,0,0,.4)">元の台本などは無視して、<br>表現方法や伝え方など<span style="background:#fff;color:#c96a3a;padding:2px 12px;border-radius:12px;margin:0 6px">全てClaudeの自由</span>に<br>して良いので1から作成して。</div>
      <div class="abs" id="a4x2" style="left:1240px;top:300px;width:560px;text-align:center"></div>
      <div class="abs" id="a4x3" style="left:170px;top:650px;right:120px;display:flex;gap:16px;align-items:center;flex-wrap:wrap">${["構成", "台本", "絵", "音楽", "声", "編集"].map((w) => `<span class="chip a4tag" style="background:rgba(255,255,255,.12);border:2px solid rgba(255,255,255,.22);font-size:36px;padding:10px 30px">${w}</span>`).join("")}<span class="a4tag" style="font-size:40px;font-weight:700;margin-left:10px">＝ ぜんぶ、Claude がコードで作りました。</span></div>
    </div>`;
  const q = (s) => root.querySelector(s), qa = (s) => [...root.querySelectorAll(s)];
  const A = q("#a4a"), who = q("#a4who"), wk = q("#a4wk"), list = q("#a4list"), lines = q("#a4lines"), logEl = q("#a4log"), loop = q("#a4loop"), ring = q("#a4ring");
  const R = q("#a4r"), M = q("#a4m"), X = q("#a4x");
  // スマホの中のやりとり（本人の指示 → コミット）
  list.innerHTML = ASKS.map((a, i) => `<div class="a4b" style="align-self:flex-end;max-width:330px;padding:12px 18px;border-radius:22px 22px 6px 22px;background:#e8834f;color:#fff;font-family:var(--sans);font-size:23px;font-weight:700;line-height:1.4">${a}</div><div class="a4b" style="align-self:flex-start;padding:8px 14px;border-radius:14px;background:#fff;color:#4a637a;font-family:var(--mono);font-size:17px;font-weight:600;box-shadow:0 2px 6px rgba(0,0,0,.08)">✓ commit ${C[(i * 5 + 3) % C.length].h}</div>`).join("");
  const bubs = qa(".a4b");
  lines.innerHTML = C.map((c) => `<div><span style="color:#ffb37f">${c.h}</span>  <span style="color:#7f96ab">${c.d}</span>  ${c.s.replace(/</g, "&lt;")}</div>`).join("");
  const cap = captain(260); q("#a4x2").append(cap); cap.style.position = "relative"; cap.style.margin = "0 auto"; cap.mood("happy");
  q("#a4x2").append($(`<div style="margin-top:20px;display:inline-block;padding:16px 34px;border-radius:30px;background:#fff;color:#1e3346;font-size:44px;font-weight:900">では、ぼくが話します。</div>`));
  const vs = qa(".a4v"), ns = qa(".a4n"), ticks = qa(".a4tick"), sts = qa(".a4st"), rules = qa(".a4rule"), tags = qa(".a4tag");
  const sn = snow(41, 70, { size: 3 }); root.insertBefore(sn, A);
  const t0 = T("maker"), tw = T("week"), tr = T("rules"), tm = T("motto"), tx = E("motto") + 9;
  const c29 = L("c29"), c31 = L("c31"), c32 = L("c32"), c33 = L("c33"), c36 = L("c36"), d36 = LE("c36") - c36, c37 = L("c37"), c38 = 1e9;
  return (t) => {
    sn.update(t, 0.35);
    A.style.opacity = win(t, t0 - 1, t0, tr - 0.1, tr + 0.4);
    // スマホの中: 指示が次々に流れる
    const n = (t - t0 - 0.3) / 1.05;
    let h = 14;
    bubs.forEach((b, i) => { const k = pr(t, t0 + 0.3 + (i / 2) * 1.05 + (i % 2) * 0.45, 0.35); b.style.opacity = k; b.style.transform = `translateY(${(1 - k) * 16}px) scale(${0.9 + k * 0.1})`; if (k > 0) h += (b.offsetHeight + 12) * k; });
    list.style.transform = `translateY(${Math.min(0, 690 - h)}px)`;
    // 作った人
    who.style.opacity = win(t, t0, t0 + 0.3, tw - 0.2, tw + 0.2);
    show(q("#a4w1"), t, c29 + 0.9, { dx: 40, dy: 0 }); show(q("#a4w2"), t, c29 + (LE("c29") - c29) * 0.5, { dx: 40, dy: 0 });
    show(q("#a4w3"), t, c31, { dx: 40, dy: 0 }); show(q("#a4w4"), t, c31 + (LE("c31") - c31) * 0.4, { dx: 40, dy: 0 });
    // 7日間の数字と、本物のコミットの記録
    wk.style.opacity = win(t, tw, tw + 0.4);
    const d32 = LE("c32") - c32;
    [c32, c32 + d32 * 0.3, c32 + d32 * 0.66].forEach((at, i) => { show(ns[i], t, at, { scale: 0.85, ease: Ease.back }); vs[i].textContent = Math.round(+vs[i].dataset.n * pr(t, at, 1.0, Ease.out5)); });
    lines.style.transform = `translateY(${-(t - tw) * 62}px)`;
    logEl.style.opacity = win(t, tw + 0.3, tw + 0.8, c33 - 0.2, c33 + 0.3);
    // 夜の点検ループ
    show(loop, t, c33 - 0.1, { dy: 40 });
    const lk = clamp((t - c33) / (tr - c33 - 0.3));
    ring.setAttribute("stroke-dashoffset", (1 - lk).toFixed(3));
    ticks.forEach((c, i) => { const on = lk > (i * 4 + 2) / 24 - 0.01; c.setAttribute("fill", on ? "#e8834f" : "#fff"); c.setAttribute("r", on ? 15 + Math.max(0, 1 - (lk - (i * 4 + 2) / 24) * 14) * 9 : 15); });
    sts.forEach((s, i) => show(s, t, c33 + 0.9 + i * 0.22, { dy: 10 }));
    // 決まり
    R.style.opacity = win(t, tr, tr + 0.4, tm - 0.15, tm + 0.3);
    rules.forEach((r, i) => show(r, t, c36 + d36 * [0, 0.38, 0.68][i] - 0.1, { dy: 40, scale: 0.92 }));
    // 一言
    M.style.opacity = win(t, tm, tm + 0.3, tx - 0.1, tx + 0.35);
    show(q("#a4m1"), t, c37 - 0.1, { dy: 30 }); show(q("#a4m2"), t, c37 + (LE("c37") - c37) * 0.5, { dy: 30 });
    // この動画のこと
    X.style.opacity = win(t, tx, tx + 0.35);
    show(q("#a4x1"), t, tx + 0.2, { scale: 0.9, ease: Ease.back, d: 0.6 });
    show(q("#a4x2"), t, c38 + 0 * 0.62, { scale: 0.8, ease: Ease.back });
    const f = Math.round(t * FPS), env = TL.env[f] || 0;
    cap.style.transform = `translateY(${-env * 10}px) rotate(${Math.sin(t * 7) * env * 4}deg)`;
    tags.forEach((g, i) => show(g, t, c38 + 1.2 + i * 0.16, { dy: 16 }));
    return { note: t >= tw && t < tr ? "※ コミットとテストの数は、このリポジトリの実数（11/2〜11/8 のコミット・npm test）" : "" };
  };
} });
