"use client";
// /admin の「4 を自動で」（11/8 本人の指示）: 1軒ずつ完了にして、少し待ってまた次へ。残りがなくなるか「止める」で止まる。
// 1軒ごとに Claude がカードの絵を描くので、1軒 20〜60 秒かかる（待つあいだも地図は数秒ごとに新しくなる）。
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function AutoComplete({ run, disabled, gapSeconds = 6 }: { run: () => Promise<{ more: boolean }>; disabled?: boolean; gapSeconds?: number }) {
  const router = useRouter();
  const on = useRef(false);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [note, setNote] = useState("");

  const start = async () => {
    on.current = true;
    setRunning(true);
    setDone(0);
    setNote("1軒目を完了にしています…");
    let n = 0;
    try {
      while (on.current) {
        const r = await run();
        n++;
        setDone(n);
        router.refresh();
        if (!r.more) {
          setNote(`${n} 軒を完了にしました。残りは撮影の3人が向かう家だけです。`);
          break;
        }
        setNote(`${n} 軒 完了。${gapSeconds} 秒後に次の家へ…`);
        for (let i = 0; i < gapSeconds * 10 && on.current; i++) await new Promise((ok) => setTimeout(ok, 100));
        if (on.current) setNote(`${n + 1} 軒目を完了にしています…`);
      }
      if (!on.current) setNote(`止めました（${n} 軒 完了）。`);
    } catch (e) {
      setNote(`止まりました: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      on.current = false;
      setRunning(false);
    }
  };

  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={disabled && !running}
        onClick={() => (running ? (on.current = false) : void start())}
        className={`flex w-full items-center gap-3 rounded-2xl px-4 py-2 text-left text-lg font-bold shadow-sm ring-1 disabled:opacity-40 ${running ? "bg-lamp text-white ring-lamp" : "bg-card text-ink ring-ink/10"}`}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink text-sm text-white">4+</span>
        {running ? `止める（${done} 軒 完了）` : "4 を自動で（全部終わるまで順番に）"}
      </button>
      {note && <p className="px-2 text-sm text-ink-soft" role="status">{note}</p>}
    </div>
  );
}
