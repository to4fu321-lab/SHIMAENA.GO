import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, loadSettings, normalizeSettings, resetSettingsCache, saveSettings } from "./settings";

describe("管理者ダッシュボードの設定", () => {
  beforeEach(() => resetSettingsCache());

  it("変な値は既定か範囲内に直す", () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({ snowThresholdCm: 99 }).snowThresholdCm).toBe(30);
    expect(normalizeSettings({ snowThresholdCm: 0 }).snowThresholdCm).toBe(1);
    expect(normalizeSettings({ snowThresholdCm: "abc" }).snowThresholdCm).toBe(DEFAULT_SETTINGS.snowThresholdCm);
    expect(normalizeSettings({ chatBarText: "  " }).chatBarText).toBe(DEFAULT_SETTINGS.chatBarText);
    expect(normalizeSettings({ chatBarText: "あ".repeat(20) }).chatBarText).toHaveLength(14);
    expect(normalizeSettings({ linePaused: "true" }).linePaused).toBe(false);
  });

  it("保存したものが読める（DB なしはメモリ）", async () => {
    await saveSettings({ linePaused: true, snowThresholdCm: 8 });
    expect(await loadSettings()).toEqual({ ...DEFAULT_SETTINGS, linePaused: true, snowThresholdCm: 8 });
  });
});
