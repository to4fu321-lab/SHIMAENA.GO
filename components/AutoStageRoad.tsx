"use client";
// 撮影ステージ（道の危険・自動・1画面）: 11/8 本人「危険な箇所を知らせる部分を自動で見せるのを admin から。雪かきのサンプル動画と同じように」。
// 田中さん（A）のスマホで 道の報告の地図 → 種類 → 写真 → AI のぼかし → ひとこと → 報告 → ピン、
// 続けて近所の そうたさん（B）のスマホに知らせが届き、隊長トーク → 地図で場所を見る、まで画面のボタンを押しながら進める。
// 見せ方（スマホの枠・指の印・テロップ）は AutoStage（雪かき）と同じ。
import { useEffect, useRef, useState } from "react";
import { STAGE_CAST } from "@/lib/demo-cast";

export interface RoadStageActions {
  reset: () => Promise<unknown>;
  alert: () => Promise<{ id: string; distance: number } | undefined>;
}

const A = STAGE_CAST.a; // 報告する人（田中さん）
const B = STAGE_CAST.b; // 近所の人（そうたさん。A の報告の場所から約160m）
const NAMES: Record<string, string> = { [A]: "田中さんのスマホ", [B]: "近所の そうたさんのスマホ" };
/** 報告する場所（A と B の家のあいだの道。B の家から 300m 以内） */
const SPOT: [number, number] = [43.0409, 141.3731];
const HAZARD_LABEL = "除雪が来ていない";
const NOTE = "坂の下、車が通れません";
const W = 390;
const H = 844;
const sleep = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

export default function AutoStageRoad({ actions }: { actions: RoadStageActions }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const on = useRef(false);
  const [who, setWho] = useState<string>(A);
  const [scale, setScale] = useState(0.8);
  const [running, setRunning] = useState(false);
  const [caption, setCaption] = useState("");
  const [showCaption, setShowCaption] = useState(true);
  const [banner, setBanner] = useState<string>();
  const [finger, setFinger] = useState<{ x: number; y: number }>();
  const [press, setPress] = useState(0);
  const [sec, setSec] = useState(0);
  const [log, setLog] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const fit = () => setScale(Math.min(1.2, Math.max(0.5, (window.innerHeight - 70) / (H + 20))));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const doc = () => frame.current?.contentDocument ?? undefined;
  const win = () => (frame.current?.contentWindow ?? undefined) as (Window & typeof globalThis) | undefined;

  /** 画面を開いて、読み込みが終わるまで待つ（as: だれのスマホか） */
  const open = async (path: string, settle = 2500, as: string = A) => {
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
    setWho(as);
    f.src = `${path}${path.includes("?") ? "&" : "?"}as=${as}`;
    await loaded;
    await sleep(settle);
  };

  const wait = async (s: number) => {
    for (let i = 0; i < s * 10 && on.current; i++) await sleep(100);
  };

  const until = async <T,>(find: () => T | undefined, s = 20): Promise<T | undefined> => {
    for (let i = 0; i < s * 5 && on.current; i++) {
      const v = find();
      if (v) return v;
      await sleep(200);
    }
    return undefined;
  };

  /** 押す所へ指の印を出して、波紋のあとに押す（雪かきのステージと同じ動き） */
  const tap = async (el: Element, click = true, outer = false) => {
    if (!outer) {
      const r0 = el.getBoundingClientRect();
      if (r0.bottom > H || r0.top < 0) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        await sleep(850);
      }
    }
    const r = el.getBoundingClientRect();
    const o = box.current?.getBoundingClientRect();
    const pos = outer && o ? { x: (r.left - o.left + r.width / 2) / scale, y: (r.top - o.top + r.height / 2) / scale } : { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    setFinger({ x: pos.x + 18, y: pos.y + 36 });
    await sleep(60);
    setFinger(pos);
    await sleep(650);
    setPress(Date.now());
    await sleep(350);
    if (click) (el as HTMLElement).click();
    await sleep(350);
    setFinger(undefined);
  };

  const buttons = (re: RegExp) => [...(doc()?.querySelectorAll("button, a") ?? [])].filter((b) => re.test((b.textContent ?? "").replace(/\s+/g, "")));

  /** 撮影用: スマホの位置を「報告する場所」にする（本物の位置情報は使わない） */
  const fakeLocation = () => {
    const w = win();
    if (!w) return;
    const pos = { coords: { latitude: SPOT[0], longitude: SPOT[1], accuracy: 8 }, timestamp: Date.now() };
    Object.defineProperty(w.navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (ok: (p: unknown) => void) => setTimeout(() => ok(pos), 400),
        watchPosition: (ok: (p: unknown) => void) => {
          setTimeout(() => ok(pos), 400);
          return 1;
        },
        clearWatch: () => undefined,
      },
    });
  };

  /** 文字を1字ずつ入れる（React の入力欄にも届くように） */
  const typeInto = async (el: HTMLInputElement, text: string) => {
    const w = win();
    if (!w) return;
    const set = Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, "value")?.set;
    for (let i = 1; i <= text.length && on.current; i++) {
      set?.call(el, text.slice(0, i));
      el.dispatchEvent(new w.Event("input", { bubbles: true }));
      await sleep(110);
    }
  };

  /** 雪で埋まった道の写真（毎回1点だけ変えて、同じ写真として断られないように） */
  const photo = async (): Promise<File> => {
    const img = await createImageBitmap(await (await fetch("/demo/entrance-before.jpg")).blob());
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext("2d")!;
    g.drawImage(img, 0, 0);
    g.fillStyle = `rgb(${Math.floor(Math.random() * 255)},${Math.floor(Math.random() * 255)},${Math.floor(Math.random() * 255)})`;
    g.fillRect(Math.floor(Math.random() * c.width), Math.floor(Math.random() * c.height), 2, 2);
    const blob = await new Promise<Blob>((ok) => c.toBlob((b) => ok(b!), "image/jpeg", 0.9));
    return new File([blob], `road-${Date.now()}.jpg`, { type: "image/jpeg" });
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
      // 1. 道の報告の地図
      say("通りがかりに、除雪が来ていない道");
      await open("/map?view=road", 2000);
      fakeLocation();
      await wait(1);
      const openBtn = await until(() => buttons(/道の危険を知らせる/)[0], 5);
      if (!openBtn) throw new Error("「道の危険を知らせる」が見つかりません");
      await tap(openBtn);
      await sleep(800);

      // 2. 種類をえらぶ
      say("どんな危険？ タイルを押すだけ");
      const tile = await until(() => doc()?.querySelector(`[role="radio"][aria-label="${HAZARD_LABEL}"]`) ?? undefined, 5);
      if (tile) await tap(tile);
      await wait(1);

      // 3. 写真
      say("その場で写真を1枚。場所は自動");
      const cam = doc()?.querySelector('button[aria-label="写真を撮る"]');
      if (cam) await tap(cam, false); // 本物のカメラは開かない（下で写真を渡す）
      const input = doc()?.querySelector<HTMLInputElement>('input[type="file"][capture]');
      const w = win();
      if (input && w) {
        const dt = new w.DataTransfer();
        dt.items.add(await photo());
        input.files = dt.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }

      // 4. AI のぼかし
      say("Claude がナンバー・表札・顔をぼかす");
      const send = await until(() => buttons(/^報告する$/).find((b) => !(b as HTMLButtonElement).disabled), 60);
      await wait(1.5);

      // 5. ひとこと
      say("ひとこと（なくてもよい）");
      const note = doc()?.querySelector<HTMLInputElement>('input[aria-label="補足（任意）"]');
      if (note) {
        await tap(note, false);
        note.focus();
        await typeInto(note, NOTE);
        note.blur();
      }
      await wait(1);

      // 6. 報告する
      say("報告する。地図にピンが立つ（名前は出ない）");
      if (send) await tap(send);
      const res = await until(() => (/報告しました|を出しました|うまくいきません|できませんでした/.test(doc()?.body.textContent ?? "") ? true : undefined), 90);
      if (!res) throw new Error("報告の返事が来ませんでした");
      await wait(5);

      // 7. 近所の人に知らせが届く
      if (!on.current) return;
      say("300m 以内の近所の人に、知らせが届く");
      const a = await actions.alert();
      await open("/", 1500, B);
      await wait(1);
      setBanner(`🚧 近くの道の報告（約${a?.distance ?? 160}m・いま）「${HAZARD_LABEL}」`);
      await wait(2.5);
      const b = document.getElementById("stage-banner");
      if (b) await tap(b, false, true);
      setBanner(undefined);
      await open("/chat", 2500, B);
      say("隊長トークに、写真と場所");
      await wait(3);

      // 8. 地図で場所を見る
      say("地図で場所を見る");
      const look = await until(() => buttons(/地図で場所を見る/).at(-1), 5);
      if (look) await tap(look, false);
      await open(a ? `/map?road=${a.id}` : "/map?view=road", 3000, B);
      await wait(4);
      say("気をつけて通れる。町の目が、みんなを守る");
      await wait(4);
      say(on.current ? "おわり。録画を止めてください" : "止めました");
    } catch (e) {
      say(`止まりました: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      clearInterval(tick);
      setBanner(undefined);
      setFinger(undefined);
      on.current = false;
      setRunning(false);
      setReady(true);
    }
  };

  // 開いたら、前の撮影の報告と近所の人のトークを消してから地図を出す
  const reset = async () => {
    setReady(false);
    setCaption("");
    await actions.reset();
    await open("/map?view=road", 1500);
    setReady(true);
  };
  useEffect(() => {
    const t = setTimeout(() => void reset(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // T でテロップを出す／消す
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "t" || e.key === "T") setShowCaption((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="auto-stage flex min-h-dvh items-center justify-center gap-10 bg-[#1e3346] p-4 text-white">
      <div className="flex shrink-0 flex-col items-center gap-2">
        <p className="text-lg font-bold text-white/90">{NAMES[who]}</p>
        <div ref={box} className="relative shrink-0 overflow-hidden rounded-[44px] border-[8px] border-[#0d1620] bg-white shadow-2xl" style={{ width: W * scale + 16, height: H * scale + 16 }}>
          <iframe ref={frame} title={NAMES[who]} src={`/map?view=road&as=${A}`} allow="microphone; camera; geolocation; autoplay" style={{ width: W, height: H, border: 0, transform: `scale(${scale})`, transformOrigin: "0 0" }} />
          {banner && (
            <div id="stage-banner" className="absolute inset-x-2 top-2 flex items-start gap-2 rounded-2xl bg-white/95 p-3 text-[#29445c] shadow-lg ring-1 ring-black/10" style={{ fontSize: 15 * scale + 2 }}>
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#d9825b] text-base text-white">🐦</span>
              <span className="min-w-0">
                <b className="block">シマエナGO</b>
                {banner}
              </span>
            </div>
          )}
          {finger && (
            <span
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-700 ease-in-out"
              style={{ left: finger.x * scale, top: finger.y * scale }}
              aria-hidden="true"
            >
              {press > 0 && <span key={press} className="absolute left-1/2 top-1/2 size-16 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-[#d9825b]/50" />}
              <span className="relative block size-11 rounded-full border-4 border-white bg-[#d9825b]/70 shadow-[0_0_0_3px_rgba(41,68,92,0.6),0_6px_14px_rgba(0,0,0,0.35)]" />
            </span>
          )}
        </div>
      </div>
      <div className="w-80 space-y-4">
        {showCaption && caption && <p className="text-3xl font-bold leading-snug">{caption}</p>}
        {!running ? (
          <>
            <button type="button" disabled={!ready} onClick={() => void start()} className="w-full rounded-2xl bg-[#d9825b] px-4 py-3 text-xl font-bold text-white disabled:opacity-50">
              {ready ? "▶ 道の危険（全部自動）" : "前の撮影の報告を消しています…"}
            </button>
            <button type="button" disabled={!ready} onClick={() => void reset()} className="w-full rounded-2xl bg-white/15 px-4 py-2 text-base disabled:opacity-50">
              ↺ リセット（報告を消す）
            </button>
          </>
        ) : (
          <button type="button" onClick={() => (on.current = false)} className="w-full rounded-2xl bg-white/15 px-4 py-2 text-base">
            止める（{Math.floor(sec / 60)}:{String(sec % 60).padStart(2, "0")}）
          </button>
        )}
        {!running && log && <pre className="whitespace-pre-wrap text-xs text-white/60">{log}</pre>}
        <p className="text-xs text-white/50">録画の範囲はスマホ1台と右の文字。T で右の文字を出す／消す。</p>
        <a href="/admin/stage" className="block text-xs text-white/50 underline">
          雪かきの撮影ステージへ
        </a>
      </div>
    </div>
  );
}
