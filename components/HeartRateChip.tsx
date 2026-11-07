"use client";

// 心拍の表示（spec v1.31 スマートウォッチ）: Bluetooth の標準の心拍を流す時計・バンド（Garmin・Polar・COROS・胸バンド など）を、
// Chrome（Android）の Web Bluetooth でつないで、いまの心拍を出すだけ。**保存しない。体調の判断はしない**（約束ごと）。
// iPhone の Safari と Apple Watch では使えない（この部品は出ない）。
import { useCallback, useEffect, useRef, useState } from "react";
import { bluetoothSupported, HEART_RATE_MEASUREMENT, HEART_RATE_SERVICE, parseHeartRate, type BleCharacteristic, type BleDevice, type BluetoothLike } from "@/lib/watch/heart-rate";
import { useClientValue } from "./useClientValue";

type State = "off" | "connecting" | "on" | "error";
const readSupported = () => bluetoothSupported();

export default function HeartRateChip({ big = false }: { big?: boolean }) {
  const supported = useClientValue(false, readSupported);
  const [state, setState] = useState<State>("off");
  const [bpm, setBpm] = useState<number>();
  const [name, setName] = useState<string>();
  const dev = useRef<BleDevice | null>(null);
  const ch = useRef<BleCharacteristic | null>(null);
  const onValue = useRef<(e: Event) => void>(() => undefined);

  const disconnect = useCallback(() => {
    try {
      ch.current?.removeEventListener("characteristicvaluechanged", onValue.current);
      void ch.current?.stopNotifications().catch(() => undefined);
      dev.current?.gatt?.disconnect();
    } catch {}
    ch.current = null;
    dev.current = null;
    setBpm(undefined);
    setState("off");
  }, []);
  useEffect(() => disconnect, [disconnect]); // 画面を離れたら外す

  const connect = async () => {
    const bt = (navigator as { bluetooth?: BluetoothLike }).bluetooth;
    if (!bt) return;
    setState("connecting");
    try {
      const device = await bt.requestDevice({ filters: [{ services: [HEART_RATE_SERVICE] }] });
      dev.current = device;
      setName(device.name);
      device.addEventListener("gattserverdisconnected", () => {
        setBpm(undefined);
        setState("off");
      });
      const server = await device.gatt!.connect();
      const service = await server.getPrimaryService(HEART_RATE_SERVICE);
      const c = await service.getCharacteristic(HEART_RATE_MEASUREMENT);
      onValue.current = (e: Event) => {
        const v = (e.target as { value?: DataView | null } | null)?.value;
        if (v) setBpm(parseHeartRate(v));
      };
      c.addEventListener("characteristicvaluechanged", onValue.current);
      await c.startNotifications();
      ch.current = c;
      setState("on");
    } catch {
      // 選ばなかった・つながらなかった
      setState(dev.current ? "error" : "off");
      dev.current = null;
    }
  };

  if (!supported) return null;
  if (state === "on") {
    return (
      <button
        type="button"
        onClick={disconnect}
        aria-label={`心拍 ${bpm ?? "計測中"}。押すと時計を外す`}
        className={`flex shrink-0 items-center gap-1 rounded-full bg-card px-3 font-bold ring-1 ring-camellia ${big ? "min-h-12 text-lg" : "min-h-9 text-sm"}`}
      >
        <span className="heart-beat text-camellia-deep" aria-hidden="true">♥</span>
        <span className="tabular-nums">{bpm ?? "…"}</span>
        {name && <span className="text-xs text-ink-soft" aria-hidden="true">⌚</span>}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => void connect()}
      disabled={state === "connecting"}
      className={`shrink-0 whitespace-nowrap rounded-full bg-card px-3 font-bold ring-1 ring-ink/15 disabled:opacity-50 ${big ? "min-h-12 text-base" : "min-h-9 text-sm"}`}
    >
      {state === "connecting" ? "⌚ さがしています…" : state === "error" ? "⌚ もう一度" : "⌚ 心拍をつなぐ"}
    </button>
  );
}
