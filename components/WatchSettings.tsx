"use client";

// 設定の「時計」タブ（spec v1.31 スマートウォッチ）: この端末で何が使えるかを見せて、その場でためせる。
// 1. 手首に届く通知（スマホの通知が時計に映る。Android は通知のボタンで答えられる）
// 2. 動きを数える（スマホのセンサー。時計の動きは Web からは読めない）
// 3. 心拍（Chrome の Android ＋ Bluetooth の心拍を流す時計・バンド。表示だけ）
import { bluetoothSupported } from "@/lib/watch/heart-rate";
import HeartRateChip from "./HeartRateChip";
import ShovelMeter from "./ShovelMeter";
import { useClientValue } from "./useClientValue";

interface Env {
  ios: boolean;
  motion: boolean;
  ble: boolean;
  actions: boolean;
}
/** この端末で何が使えるか（画面が出たあとに読む） */
function readEnv(): Env {
  return {
    ios: /iP(hone|ad|od)/.test(navigator.userAgent),
    motion: typeof DeviceMotionEvent !== "undefined",
    ble: bluetoothSupported(),
    actions: typeof Notification !== "undefined" && ((Notification as unknown as { maxActions?: number }).maxActions ?? 0) > 0,
  };
}

export default function WatchSettings() {
  const env = useClientValue<Env | undefined>(undefined, readEnv);
  const yes = (ok: boolean | undefined, okText: string, noText: string) =>
    ok === undefined ? <span className="text-ink-soft">確かめています…</span> : ok ? <span className="font-bold text-lamp-deep">✓ {okText}</span> : <span className="text-ink-soft">— {noText}</span>;

  return (
    <section className="space-y-1.5 rounded-3xl bg-card p-4 shadow-sm ring-1 ring-ink/10 short:p-3" aria-label="スマートウォッチ">
      <h2 className="text-lg font-bold">⌚ スマートウォッチと使う</h2>
      <p className="text-sm text-ink-soft short:hidden">アプリは時計には入りません。スマホの通知とセンサーを、時計と組み合わせて使います。</p>
      <dl className="space-y-1.5 text-base">
        <div className="rounded-2xl bg-paper px-3 py-1.5">
          <dt className="font-bold">🔔 手首に届く点呼</dt>
          <dd className="text-sm leading-snug">
            スマホの通知は Apple Watch・Wear OS にも映ります。
            {yes(env?.actions, "通知のボタン（朝／休む・行く／無理）で、開かずに答えられます", env?.ios ? "iPhone はボタンが出ないので、通知を開いて答えます" : "この端末は通知のボタンが出ません")}
          </dd>
        </div>
        <div className="rounded-2xl bg-paper px-3 py-1.5">
          <dt className="font-bold">⛏ スコップカウンター</dt>
          <dd className="text-sm leading-snug">
            {yes(env?.motion, "スマホのセンサーで、雪かき中の「ザクッ」を数えられます", "この端末にはセンサーがありません")}
            <span className="block short:hidden">雪かき中の画面でオンにして、ポケットか腕に。</span>
          </dd>
          {env?.motion && (
            <div className="mt-1">
              <ShovelMeter storageKey="shimaena-strokes-test" startedAt={0} label="ためしに数える" />
            </div>
          )}
        </div>
        <div className="rounded-2xl bg-paper px-3 py-1.5">
          <dt className="flex items-center justify-between gap-2 font-bold">
            <span>♥ 心拍を見る</span>
            {env?.ble && <HeartRateChip />}
          </dt>
          <dd className="text-sm leading-snug">
            {yes(env?.ble, "心拍を流す時計・バンド（Garmin・Polar など）をつなげます", env?.ios ? "iPhone・Apple Watch では使えません" : "この端末では使えません（Android の Chrome で）")}
            <span className="block">表示だけ。保存せず、体調の判断もしません。</span>
          </dd>
        </div>
      </dl>
    </section>
  );
}
