"use client";

// 「通知を受け取る」（spec v1.17）。雪の朝の点呼を届けるために、端末の通知（Web Push）を許可してもらう。
// 1. なぜ要るかを1枚はさんでから、許可を求める（うっかり「許可しない」を防ぐ。一度だめにすると設定の奥からしか戻せない）
// 2. iPhone は「ホーム画面に追加」してからでないと通知が使えない → 3ステップを絵で
// 3. 鍵がない（公開鍵なし）・この端末で使えない → 何も出さない。「あとで」は端末に覚えて、しばらく出さない
import { useEffect, useState } from "react";
import { removePushSubscriptionAction, savePushSubscriptionAction } from "@/app/chat/push-actions";

type State = "hidden" | "ios-install" | "ask" | "busy" | "on" | "denied" | "error";
const LATER_KEY = "shimaena-push-later";
const LATER_DAYS = 3;

function b64ToBytes(b64: string): Uint8Array {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
const isIos = () => /iP(hone|ad|od)/.test(navigator.userAgent);
/** 「あとで」を押してから LATER_DAYS たったか（押していなければ true） */
function laterOk(): boolean {
  try {
    const t = Number(localStorage.getItem(LATER_KEY) ?? 0);
    return Date.now() - t > LATER_DAYS * 86400000;
  } catch {
    return true;
  }
}
function rememberLater(): void {
  try {
    localStorage.setItem(LATER_KEY, String(Date.now()));
  } catch {}
}
const standalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;

export default function PushSetup({ viewerId, publicKey, compact = false }: { viewerId: string; publicKey?: string; compact?: boolean }) {
  const [state, setState] = useState<State>("hidden");
  const [msg, setMsg] = useState<string>();

  useEffect(() => {
    if (!publicKey) return;
    (async () => {
      try {
        const supported = Boolean(navigator.serviceWorker && typeof navigator.serviceWorker.register === "function") && "PushManager" in window && "Notification" in window;
        if (!supported) {
          if (isIos() && !standalone()) setState(laterOk() ? "ios-install" : "hidden");
          return;
        }
        const reg = await navigator.serviceWorker.register("/sw.js");
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          setState("on");
          void savePushSubscriptionAction(viewerId, sub.toJSON()); // 端末が変わっていないか、鍵を取り直す
          return;
        }
        if (Notification.permission === "denied") return setState(laterOk() ? "denied" : "hidden");
        setState(laterOk() ? "ask" : "hidden");
      } catch {
        setState("hidden");
      }
    })();
  }, [publicKey, viewerId]);

  const later = () => {
    rememberLater();
    setState("hidden");
  };

  const turnOn = async () => {
    if (!publicKey) return;
    setState("busy");
    setMsg(undefined);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setState(perm === "denied" ? "denied" : "ask");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) as BufferSource });
      const r = await savePushSubscriptionAction(viewerId, sub.toJSON());
      if (!r.ok) throw new Error(r.text);
      setState("on");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "通知をオンにできませんでした。");
      setState("error");
    }
  };
  const turnOff = async () => {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await removePushSubscriptionAction(viewerId, sub.endpoint);
      await sub.unsubscribe();
    }
    setState("ask");
  };

  if (state === "hidden") return null;
  if (state === "on") {
    return compact ? (
      <button onClick={turnOff} className="text-sm text-ink-soft underline">
        🔔 通知オン
      </button>
    ) : (
      <p className="flex items-center justify-between rounded-2xl bg-ice-soft px-3 py-2 text-base">
        <span>🔔 この端末に通知が届きます</span>
        <button onClick={turnOff} className="text-sm underline">
          止める
        </button>
      </p>
    );
  }
  const box = "space-y-2 rounded-2xl bg-warm px-3 py-3 ring-1 ring-lamp/40";
  if (state === "ios-install") {
    return (
      <section className={box} aria-label="ホーム画面に追加">
        <p className="text-base font-bold">雪の朝のお知らせを届けるには、ホーム画面に追加してください</p>
        <ol className="list-decimal space-y-1 pl-5 text-base leading-snug">
          <li>
            下の <span className="rounded bg-card px-1">共有</span>（□に↑）を押す
          </li>
          <li>「ホーム画面に追加」を押す</li>
          <li>ホーム画面のシマエナGO から開く → 「通知を受け取る」</li>
        </ol>
        <button onClick={later} className="text-sm underline">
          あとで
        </button>
      </section>
    );
  }
  if (state === "denied") {
    return (
      <section className={box}>
        <p className="text-base leading-snug">通知が「許可しない」になっています。スマホの設定 → 通知 → シマエナGO（またはブラウザ）でオンにできます。</p>
        <button onClick={later} className="text-sm underline">
          閉じる
        </button>
      </section>
    );
  }
  return (
    <section className={box} aria-label="通知を受け取る">
      <p className="text-base font-bold leading-snug">雪の朝の雪かき応援と、来てくれる人のお知らせを、この端末に届けます。</p>
      <p className="text-sm text-ink-soft">次の画面で「許可」を押してください。雪のない日は何も届きません。</p>
      {msg && <p className="text-sm text-alert">{msg}</p>}
      <div className="flex gap-2">
        <button onClick={turnOn} disabled={state === "busy"} className="btn btn-lamp min-h-12 flex-1 text-base">
          {state === "busy" ? "準備しています…" : "🔔 通知を受け取る"}
        </button>
        <button onClick={later} className="btn btn-white min-h-12 px-3 text-base">
          あとで
        </button>
      </div>
    </section>
  );
}
