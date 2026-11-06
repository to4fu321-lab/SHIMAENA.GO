"use client";
// 音のオン・オフ（spec v1.19）。
// - compact: ホームの見出しの 🔊／🔇（BGM を一発で止める・戻す）
// - それ以外: 設定の「音」タブ（効果音・BGM の大きな切りかえ＋ためしに鳴らす）
import { play, setSoundPrefs, soundSupported, unlock, useSoundPrefs } from "@/lib/sound/engine";

function Switch({ on, label, note, onChange }: { on: boolean; label: string; note: string; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      data-sound={on ? "toggleOff" : "toggleOn"}
      onClick={() => onChange(!on)}
      className="flex min-h-16 w-full items-center justify-between gap-3 rounded-2xl bg-paper px-4 py-2 text-left ring-1 ring-ink/10"
    >
      <span className="min-w-0">
        <span className="block text-lg font-bold">{label}</span>
        <span className="block text-sm text-ink-soft">{note}</span>
      </span>
      <span className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${on ? "bg-lamp" : "bg-ink/20"}`} aria-hidden="true">
        <span className={`absolute top-1 size-6 rounded-full bg-white shadow transition-[left] ${on ? "left-7" : "left-1"}`} />
      </span>
      <span className="sr-only">{on ? "オン" : "オフ"}</span>
    </button>
  );
}

export default function SoundToggle({ compact = false }: { compact?: boolean }) {
  const prefs = useSoundPrefs();
  if (compact) {
    const on = prefs.bgm;
    return (
      <button
        type="button"
        onClick={() => {
          void unlock();
          setSoundPrefs({ bgm: !on });
        }}
        aria-label={on ? "BGM を止める" : "BGM を鳴らす"}
        aria-pressed={on}
        data-sound="tap"
        className="flex min-h-12 min-w-11 shrink-0 flex-col items-center justify-center px-1 text-xs font-bold"
      >
        <span className="text-2xl leading-none" aria-hidden="true">
          {on ? "🔊" : "🔇"}
        </span>
        BGM
      </button>
    );
  }
  return (
    <section className="space-y-2 rounded-3xl bg-card p-4 shadow-sm ring-1 ring-ink/10" aria-label="音">
      <h2 className="text-lg font-bold">音</h2>
      <Switch on={prefs.sfx} label="効果音" note="ボタン・出撃・カードの音と、Android の振動" onChange={(v) => setSoundPrefs({ sfx: v })} />
      <Switch on={prefs.bgm} label="BGM" note="場面で変わる3曲。ホームの 🔊 でも止められます" onChange={(v) => setSoundPrefs({ bgm: v })} />
      <button
        type="button"
        data-sound="none"
        onClick={() => {
          void unlock().then(() => play("missionClear"));
        }}
        className="btn btn-white min-h-12 w-full text-base"
      >
        🎵 ためしに鳴らす
      </button>
      <p className="text-sm text-ink-soft">{soundSupported() ? "この設定はこの端末にだけ保存されます。スマホの消音スイッチが入っていると鳴りません。" : "この端末では音が使えません。"}</p>
    </section>
  );
}
