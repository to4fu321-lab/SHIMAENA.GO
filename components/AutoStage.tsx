"use client";
// 撮影ステージ（自動・1画面）: 11/8 本人「admin の発表ボタンを押したら自動ですべて進むように」「発表時は一画面でよい」。
// 田中さん（A・サルビア）のスマホ1台を大きく出し、ホーム → 通知 → 隊長トーク → 行く → 町の地図 → 完了写真 → 手伝う → 終了 を、
// 画面の中のボタンを本当に押しながら進める（同じサイトの画面なので、外から押せる）。朝を進める操作は /admin と同じ処理。
import { useEffect, useRef, useState } from "react";

type Run = () => Promise<unknown>;
export interface StageActions {
  announce: Run;
  ring: Run;
  goA: Run;
  goB: Run;
  allTeams: Run;
  gather: Run;
  completeOther: () => Promise<{ more: boolean }>;
  finishA: Run;
  cheer: Run;
}

const AS = "h1";
const W = 390;
const H = 844;
const sleep = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

export default function AutoStage({ actions }: { actions: StageActions }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const on = useRef(false);
  const [scale, setScale] = useState(0.8);
  const [running, setRunning] = useState(false);
  const [caption, setCaption] = useState("");
  const [showCaption, setShowCaption] = useState(true);
  const [banner, setBanner] = useState<string>();
  const [tapAt, setTapAt] = useState<{ x: number; y: number; n: number }>();
  const [sec, setSec] = useState(0);
  const [log, setLog] = useState("");

  // 画面の高さに合わせて、スマホ1台をできるだけ大きく
  useEffect(() => {
    const fit = () => setScale(Math.min(1.2, Math.max(0.5, (window.innerHeight - 40) / (H + 20))));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const doc = () => frame.current?.contentDocument ?? undefined;

  /** 画面を開いて、読み込みが終わるまで待つ */
  const open = async (path: string, settle = 2500) => {
    const f = frame.current;
    if (!f) return;
    const loaded = new Promise<void>((ok) => {
      const done = () => {
        f.removeEventListener("load", done);
        ok();
      };
      f.addEventListener("load", done);
      setTimeout(done, 15000);
    });
    f.src = `${path}${path.includes("?") ? "&" : "?"}as=${AS}`;
    await loaded;
    await sleep(settle);
  };

  /** 止めるボタンを押したら、待っている途中でも抜ける */
  const wait = async (s: number) => {
    for (let i = 0; i < s * 10 && on.current; i++) await sleep(100);
  };

  /** 条件に合う要素が出るまで待つ（出なければ undefined） */
  const until = async <T,>(find: () => T | undefined, s = 20): Promise<T | undefined> => {
    for (let i = 0; i < s * 5 && on.current; i++) {
      const v = find();
      if (v) return v;
      await sleep(200);
    }
    return undefined;
  };

  /** 押す位置に丸を出してから押す（指は録画に映らないので） */
  const tap = async (el: Element, click = true) => {
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    await sleep(700);
    const r = el.getBoundingClientRect();
    setTapAt({ x: r.left + r.width / 2, y: r.top + r.height / 2, n: Date.now() });
    await sleep(600);
    if (click) (el as HTMLElement).click();
    await sleep(500);
    setTapAt(undefined);
  };

  const buttons = (re: RegExp) => [...(doc()?.querySelectorAll("button, a") ?? [])].filter((b) => re.test((b.textContent ?? "").replace(/\s+/g, "")));

  /** 「拠点7」の誘いの中の「行く（10分でも）」（ほかの家の誘いと間違えない） */
  const goButtonFor7 = () => {
    const d = doc();
    if (!d) return undefined;
    const leaves = [...d.querySelectorAll("p, span, div")].filter((e) => e.children.length === 0 && /拠点\d+/.test(e.textContent ?? ""));
    const gos = buttons(/^.*行く（10分でも）$/);
    const ok = gos.filter((b) => {
      const before = leaves.filter((l) => l.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      return /拠点7[^0-9]/.test(`${before.at(-1)?.textContent ?? ""} `);
    });
    return ok.at(-1);
  };

  /** 玄関前の写真（毎回1点だけ変えて、同じ写真として断られないように） */
  const photo = async (): Promise<File> => {
    const img = await createImageBitmap(await (await fetch("/demo/entrance.jpg")).blob());
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext("2d")!;
    g.drawImage(img, 0, 0);
    g.fillStyle = `rgb(${Math.floor(Math.random() * 255)},${Math.floor(Math.random() * 255)},${Math.floor(Math.random() * 255)})`;
    g.fillRect(Math.floor(Math.random() * c.width), Math.floor(Math.random() * c.height), 2, 2);
    const blob = await new Promise<Blob>((ok) => c.toBlob((b) => ok(b!), "image/jpeg", 0.9));
    return new File([blob], `entrance-${Date.now()}.jpg`, { type: "image/jpeg" });
  };

  const say = (t: string) => {
    setCaption(t);
    setLog((l) => `${l}${l ? "\n" : ""}${t}`);
  };

  const start = async () => {
    on.current = true;
    setRunning(true);
    setLog("");
    const t0 = Date.now();
    const tick = setInterval(() => setSec(Math.round((Date.now() - t0) / 1000)), 500);
    try {
      // 1. 前夜
      say("前の夜。隊長から予告が届く");
      await actions.announce();
      await open("/chat", 3000);
      await wait(4);

      // 2. ホーム → 6:30 の通知
      if (!on.current) return;
      say("朝 6:30。10cm 積もった");
      await open("/", 1500);
      await wait(2);
      await actions.ring(); // Claude が作戦を考えて、近所に知らせる（少しかかる）
      setBanner("助けてほしい家があります。🙏 拠点7、あと3人です。10分でもOK");
      await wait(3);

      // 3. 通知を押す → 隊長トーク
      say("通知を押すと、隊長トーク");
      const b = document.getElementById("stage-banner");
      if (b) await tap(b, false);
      setBanner(undefined);
      await open("/chat", 3000);
      await wait(2);

      // 4. 行く（拠点7）
      say("「行く（10分でも）」");
      const go = await until(goButtonFor7, 10);
      if (go) await tap(go);
      else await actions.goA();
      await wait(4);

      // 5. ほかのチームも集まる
      say("ほかのチームの人も、同じ家へ");
      await actions.goB();
      await actions.allTeams();
      await actions.gather();
      await wait(1);

      // 6. 町の地図
      say("町の地図。近所の人が一斉に動き出す");
      const toMap = await until(() => buttons(/町の地図を開く|^マップ$/).at(-1), 3);
      if (toMap) await tap(toMap);
      await open("/map", 3500);
      await wait(4);
      await actions.completeOther();
      await open("/map", 3000);
      await wait(3);

      // 7. 終わりました → 写真
      say("終わったら、写真を1枚");
      const done = await until(() => buttons(/^終わりました$/)[0], 10);
      if (done) await tap(done, false); // 本物のカメラは開かない（下で写真を渡す）
      const input = doc()?.querySelector<HTMLInputElement>('input[type="file"][capture]');
      if (input && frame.current?.contentWindow) {
        const dt = new (frame.current.contentWindow as typeof window).DataTransfer();
        dt.items.add(await photo());
        input.files = dt.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
      say("Claude が写真を確かめる");
      const result = await until(() => buttons(/町の地図へ戻る|それでも完了にする/)[0], 60);
      if (result && /それでも完了にする/.test(result.textContent ?? "")) {
        await tap(result);
        await until(() => buttons(/町の地図へ戻る/)[0], 30);
      }
      say("1軒、灯りがともった");
      await wait(8);

      // 8. 家族から応援
      await actions.cheer();
      const back = buttons(/町の地図へ戻る/)[0];
      if (back) await tap(back);
      await wait(2);

      // 9. 手伝う（近くの家へ 10分だけ）
      say("まだ時間がある。近くの家を手伝う");
      await open("/map", 3000);
      const help = await until(() => buttons(/10分だけ(助けに行く|参加する)/)[0], 5);
      if (help) {
        await tap(help);
        await wait(4);
      }

      // 10. 町じゅうの家が終わる
      say("町じゅうの玄関が、ひらいていく");
      for (let i = 0; i < 12 && on.current && (Date.now() - t0) / 1000 < 170; i++) {
        const r = await actions.completeOther();
        await open("/map", 2000);
        if (!r.more) break;
      }
      await actions.finishA();
      await open("/map", 3000);
      say("今朝の雪かき、ぜんぶ完了");
      await wait(6);
      say(on.current ? "おわり。録画を止めてください" : "止めました");
    } catch (e) {
      say(`止まりました: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      clearInterval(tick);
      on.current = false;
      setRunning(false);
    }
  };

  // キー: Enter で開始・止める、T でテロップを出す／消す
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "t" || e.key === "T") setShowCaption((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="auto-stage flex min-h-dvh items-center justify-center gap-10 bg-[#1e3346] p-4 text-white">
      <div ref={box} className="relative shrink-0 overflow-hidden rounded-[44px] border-[8px] border-[#0d1620] bg-white shadow-2xl" style={{ width: W * scale + 16, height: H * scale + 16 }}>
        <iframe ref={frame} title="田中さんのスマホ" src={`/?as=${AS}`} allow="microphone; camera; geolocation; autoplay" style={{ width: W, height: H, border: 0, transform: `scale(${scale})`, transformOrigin: "0 0" }} />
        {banner && (
          <div id="stage-banner" className="absolute inset-x-2 top-2 flex items-start gap-2 rounded-2xl bg-white/95 p-3 text-[#29445c] shadow-lg ring-1 ring-black/10" style={{ fontSize: 15 * scale + 2 }}>
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#d9825b] text-base text-white">🐦</span>
            <span className="min-w-0">
              <b className="block">シマエナGO</b>
              {banner}
            </span>
          </div>
        )}
        {tapAt && (
          <span
            key={tapAt.n}
            className="pointer-events-none absolute size-14 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-[#d9825b]/60 ring-4 ring-[#d9825b]"
            style={{ left: tapAt.x * scale, top: tapAt.y * scale }}
          />
        )}
      </div>
      <div className="w-80 space-y-4">
        {showCaption && caption && <p className="text-3xl font-bold leading-snug">{caption}</p>}
        {!running ? (
          <button type="button" onClick={() => void start()} className="w-full rounded-2xl bg-[#d9825b] px-4 py-3 text-xl font-bold text-white">
            ▶ 発表（約3分・全部自動）
          </button>
        ) : (
          <button type="button" onClick={() => (on.current = false)} className="w-full rounded-2xl bg-white/15 px-4 py-2 text-base">
            止める（{Math.floor(sec / 60)}:{String(sec % 60).padStart(2, "0")}）
          </button>
        )}
        {!running && log && <pre className="whitespace-pre-wrap text-xs text-white/60">{log}</pre>}
        <p className="text-xs text-white/50">録画の範囲はスマホ1台と右の文字。T で右の文字を出す／消す。</p>
      </div>
    </div>
  );
}
