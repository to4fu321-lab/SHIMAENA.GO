// 心拍（spec v1.31）: 対応の時計・バンドが流す Bluetooth の標準の心拍（Heart Rate Service 0x180D）を、
// Chrome（Android）の Web Bluetooth で受けて表示する。**表示だけ。保存しない。体調の判断はしない**（約束ごと）。
// ここは純粋な読み取りだけ（つなぐ操作は components/HeartRateChip.tsx）。

export const HEART_RATE_SERVICE = "heart_rate";
export const HEART_RATE_MEASUREMENT = "heart_rate_measurement";

/** Bluetooth の Heart Rate Measurement（flags の bit0 が 1 なら 16bit、0 なら 8bit）から bpm を読む */
export function parseHeartRate(view: DataView): number | undefined {
  if (view.byteLength < 2) return undefined;
  const flags = view.getUint8(0);
  const wide = (flags & 0x01) === 0x01;
  if (wide && view.byteLength < 3) return undefined;
  const bpm = wide ? view.getUint16(1, true) : view.getUint8(1);
  return bpm > 0 && bpm < 300 ? bpm : undefined;
}

/** 使える端末か（Chrome の Android など。iPhone の Safari では使えない） */
export function bluetoothSupported(nav: { bluetooth?: unknown } = typeof navigator === "undefined" ? {} : (navigator as { bluetooth?: unknown })): boolean {
  return Boolean(nav.bluetooth);
}

// Web Bluetooth の最小限の型（TypeScript の標準の型に入っていないため）
export interface BleCharacteristic {
  value: DataView | null;
  startNotifications(): Promise<BleCharacteristic>;
  stopNotifications(): Promise<BleCharacteristic>;
  addEventListener(type: "characteristicvaluechanged", h: (e: Event) => void): void;
  removeEventListener(type: "characteristicvaluechanged", h: (e: Event) => void): void;
}
export interface BleDevice {
  name?: string;
  gatt?: {
    connected: boolean;
    connect(): Promise<{ getPrimaryService(s: string): Promise<{ getCharacteristic(c: string): Promise<BleCharacteristic> }> }>;
    disconnect(): void;
  };
  addEventListener(type: "gattserverdisconnected", h: () => void): void;
}
export interface BluetoothLike {
  requestDevice(opts: { filters: { services: string[] }[] }): Promise<BleDevice>;
}
