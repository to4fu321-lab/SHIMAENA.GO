// 編集の割り付け: どの録画（.video/v3/rec）を、どの場面の、どのスマホに、何秒目から、どの速さで置くか。
// 合成ページ（ブラウザ）と、音を作る score.cjs（Node）の両方が読む（押した瞬間に、アプリと同じ効果音を鳴らすため）。
// buildEdit(TL) → { clips: { 場面: { スマホ: [{ t0, scene, phone, from, rate, to }] } }, sfx: [{ name, at, gain }], cue: { 名前: 秒 } }
(function (root) {
  function buildEdit(TL) {
    const sc = Object.fromEntries(TL.scenes.map((s) => [s.id, s]));
    const line = {};
    for (const s of TL.scenes) for (const l of s.lines) line[l.id] = { at: l.at, end: l.at + l.dur, dur: l.dur, local: l.at - s.start };
    const R = TL.rec || {};
    const mk = (scene, name) => (R[scene] && R[scene].marks && R[scene].marks[name] ? R[scene].marks[name].t : null);
    const clips = {}, sfx = [], cue = {};
    const add = (name, at, gain) => { if (at != null && isFinite(at)) sfx.push({ name, at: +at.toFixed(3), gain: gain == null ? 1 : gain }); };
    /** 録画の中の秒 → 動画の秒 */
    const toGlobal = (s, c, recT) => s.start + c.t0 + (recT - c.from) / (c.rate || 1);

    // ── お願いする家の登録 ──
    if (sc.ask && R.ask) {
      const s = sc.ask, c = { t0: 0, scene: "ask", phone: "c", from: mk("ask", "omakase") - 1.3, rate: 1 };
      clips.ask = { c: [c] };
      add("tap", toGlobal(s, c, mk("ask", "omakase")), 0.9);
      add("confirm", toGlobal(s, c, mk("ask", "genkan")), 0.8);
    }
    // ── 6:30 3台に届く（届く瞬間を「届きます」に合わせ、少しずつずらす）──
    if (sc.ring && R.ring) {
      const s = sc.ring, arrive = line.n16.local + line.n16.dur * 0.55;
      clips.ring = {};
      [["a", 0], ["b", 0.3], ["c", 0.6]].forEach(([k, d]) => {
        const c = { t0: 0, scene: "ring", phone: k, from: mk("ring", "arrive-" + k) - (arrive + d) - 0.12, rate: 1 };
        clips.ring[k] = [c];
        add("message", s.start + arrive + d, 0.9);
      });
      cue.ring = s.start + arrive;
    }
    // ── 隊長（Claude）の割り振りの理由 ──
    if (sc.commander && R.reason) clips.commander = { a: [{ t0: 0, scene: "reason", phone: "a", from: mk("reason", "scroll") - 0.7, rate: 1 }] };
    // ── 行く → 町の地図が色に染まる ──
    if (sc.go && R.go && R.map) {
      const s = sc.go, dur = s.end - s.start;
      const c1 = { t0: 0, scene: "go", phone: "a", from: mk("go", "go") - 0.95, rate: 1 };
      const c1c = { t0: 0, scene: "go", phone: "c", from: mk("go", "go") - 0.95, rate: 1 };
      const tMap = Math.max(2.5, line.n21.local - 0.25);
      const dones = Object.keys(R.map.marks).filter((k) => /^done/.test(k)).map((k) => R.map.marks[k].t).sort((a, b) => a - b);
      const from = dones[0] - 2.2, to = dones[dones.length - 1] + 1.6;
      const c2 = { t0: tMap, scene: "map", phone: "a", from, rate: (to - from) / (dur - tMap), to };
      clips.go = { a: [c1], c: [c1c], m: [c2] };
      cue.goTap = toGlobal(s, c1, mk("go", "go"));
      cue.map = s.start + tMap;
      add("go", cue.goTap, 0.9);
      add("message", toGlobal(s, c1c, mk("go", "coming")), 0.7);
      dones.forEach((d, i) => add("lamp", toGlobal(s, c2, d), 0.5 + i * 0.04));
    }
    // ── 終わりました → 写真 → 完了 ──
    if (sc.finish && R.finish) {
      const s = sc.finish;
      const c = { t0: 0, scene: "finish", phone: "a", from: mk("finish", "finish") - 1.0, rate: 1 };
      clips.finish = { a: [c] };
      cue.finishTap = toGlobal(s, c, mk("finish", "finish"));
      cue.shutter = cue.finishTap + 0.95;
      cue.clear = toGlobal(s, c, mk("finish", "clear"));
      add("tap", cue.finishTap, 0.9);
      add("shutter", cue.shutter, 1);
      add("missionClear", cue.clear + 0.05, 0.9);
      add("lamp", cue.clear + 0.95, 0.8);
    }
    // ── カード ──
    if (sc.card && R.finish) {
      const s = sc.card;
      const c = { t0: 0, scene: "finish", phone: "a", from: mk("finish", "card") - 0.7, rate: 1 };
      clips.card = { a: [c] };
      const t = toGlobal(s, c, mk("finish", "card"));
      cue.cardTap = t;
      add("tap", t, 0.8);
      add("cardRise", t + 0.15, 1); add("cardFlip", t + 0.5, 1); add("cardSparkle", t + 1.55, 0.9); add("cardStamp", t + 2.05, 0.8); add("cardChime", t + 2.45, 0.9); add("cardHolo", t + 2.55, 0.8);
    }
    // ── 声のありがとう（押して話す、の瞬間で場面を終える。ページの読み込み中の白い画面は切る）──
    if (sc.thanks && R.thanks) {
      const s = sc.thanks, dur = s.end - s.start;
      const t2 = dur - 0.2 - 1.5; // ここから「声のありがとう」のページ（押して話す、の 1.5 秒前）
      const c1 = { t0: 0, scene: "thanks", phone: "c", from: mk("thanks", "mic") - (t2 - 0.4), rate: 1 };
      const c2 = { t0: t2, scene: "thanks", phone: "c", from: mk("thanks", "talk") - 1.5, rate: 1 };
      clips.thanks = { c: [c1, c2] };
      add("tap", toGlobal(s, c1, mk("thanks", "mic")), 0.8);
      add("confirm", toGlobal(s, c2, mk("thanks", "talk")), 0.7);
    }
    // ── 声（録っている画面 → とめる → 届ける → 手伝った人に届く）──
    if (sc.voice && R.thanks && R.listen) {
      const s = sc.voice, d = line.d01;
      const talk = mk("thanks", "talk"), stop = mk("thanks", "stop"), send = mk("thanks", "send");
      const tEnd = d.local + d.dur + 0.2; // 声が終わったら止める
      const c1 = { t0: 0, scene: "thanks", phone: "c", from: talk + 0.2, rate: (stop - 0.55 - (talk + 0.2)) / tEnd, to: stop - 0.55 };
      // とめる → 届ける は、間の待ち時間を切って続けて見せる
      const c2 = { t0: tEnd, scene: "thanks", phone: "c", from: stop - 0.4, rate: 1, to: stop + 0.3 };
      const c3 = { t0: tEnd + 0.65, scene: "thanks", phone: "c", from: send - 0.4, rate: 1 };
      clips.voice = { c: [c1, c2, c3], a: [{ t0: 0, scene: "listen", phone: "a", from: mk("listen", "play") + 0.3, rate: 0.35 }] };
      cue.voiceStart = d.at; cue.voiceEnd = d.at + d.dur;
      cue.voiceSent = toGlobal(s, c3, send);
      add("tap", toGlobal(s, c2, stop), 0.6);
      add("thanks", cue.voiceSent, 1);
    }
    // ── そのほかの入口: 道の危険・聞き書きと絵本 ──
    if (sc.more) {
      const s = sc.more, dur = s.end - s.start, c = {};
      if (R.road) {
        const from = mk("road", "tile") - 0.5, to = (mk("road", "sent") || mk("road", "send") + 2) + 2.6;
        const tHalf = line.n31.local - 0.1;
        c.a = [{ t0: 0, scene: "road", phone: "a", from, rate: (to - from) / Math.max(2, tHalf + 0.6), to }];
        add("shutter", toGlobal(s, c.a[0], mk("road", "photo") || from), 0.7);
      }
      if (R.book) c.b = [{ t0: 0, scene: "book", phone: "a", from: 0.3, rate: (R.book.seconds - 0.6) / dur }];
      clips.more = c;
    }
    sfx.sort((a, b) => a.at - b.at);
    return { clips, sfx, cue, line, scene: sc };
  }
  if (typeof module !== "undefined" && module.exports) module.exports = buildEdit;
  else root.buildEdit = buildEdit;
})(typeof window !== "undefined" ? window : globalThis);
