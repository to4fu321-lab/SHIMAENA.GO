// 管理者ダッシュボード（/admin/settings）で変えられる設定。
// 保存先は morning_state の1行（key = admin_settings）。DB がない間はメモリ。
// 鍵（API キー・トークン）はここに入れない。鍵は Vercel の環境変数だけ。
import { hasDb, query } from "../db";
import { SNOW_THRESHOLD_CM } from "../weather";

export interface AdminSettings {
  /** LINE への送信を一時停止する（LINE_DRY_RUN=1 と同じ。送らずに記録だけ） */
  linePaused: boolean;
  /** 前夜の予告を出す基準（翌朝 6:00 までの降雪 cm） */
  snowThresholdCm: number;
  /** リッチメニューを閉じたときにトーク画面の下に出る文字（14字まで） */
  chatBarText: string;
}

export const DEFAULT_SETTINGS: AdminSettings = {
  linePaused: false,
  snowThresholdCm: SNOW_THRESHOLD_CM,
  chatBarText: "メニュー（町・相談）",
};

export const THRESHOLD_RANGE = { min: 1, max: 30 } as const;
export const CHAT_BAR_MAX = 14; // LINE の決まり

const KEY = "admin_settings";
const g = globalThis as { __shimaenaSettings?: AdminSettings };

/** 入ってきた値を、使える形に直す（変な値は既定に戻す） */
export function normalizeSettings(raw: Partial<Record<keyof AdminSettings, unknown>> | null | undefined): AdminSettings {
  const r = raw ?? {};
  const cm = Number(r.snowThresholdCm);
  const bar = typeof r.chatBarText === "string" ? r.chatBarText.trim().slice(0, CHAT_BAR_MAX) : "";
  return {
    linePaused: r.linePaused === true,
    snowThresholdCm: Number.isFinite(cm) ? Math.min(THRESHOLD_RANGE.max, Math.max(THRESHOLD_RANGE.min, Math.round(cm))) : DEFAULT_SETTINGS.snowThresholdCm,
    chatBarText: bar || DEFAULT_SETTINGS.chatBarText,
  };
}

export async function loadSettings(): Promise<AdminSettings> {
  if (!hasDb()) return g.__shimaenaSettings ?? DEFAULT_SETTINGS;
  try {
    const rows = await query<{ state: Partial<AdminSettings> }>("select state from morning_state where key = $1", [KEY]);
    return normalizeSettings(rows[0]?.state);
  } catch {
    return DEFAULT_SETTINGS; // 読めないときは既定（送信は止めない）
  }
}

export async function saveSettings(next: Partial<AdminSettings>): Promise<AdminSettings> {
  const merged = normalizeSettings({ ...(await loadSettings()), ...next });
  g.__shimaenaSettings = merged;
  if (hasDb()) {
    await query(
      `insert into morning_state (key, state, updated_at) values ($1, $2::jsonb, now())
       on conflict (key) do update set state = excluded.state, updated_at = now()`,
      [KEY, JSON.stringify(merged)],
    );
  }
  return merged;
}

/** テスト用 */
export function resetSettingsCache(): void {
  g.__shimaenaSettings = undefined;
}
