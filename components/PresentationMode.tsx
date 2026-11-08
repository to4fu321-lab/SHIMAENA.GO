"use client";
// /admin の「発表モード」（11/8 本人「終わりましたや助けに行くなども勝手に動くように。録画時間を3分ほどで」）:
// 撮影ステージの4台を録画しているあいだ、予告 → 6:30 の通知 → A・B が拠点7へ「行く」→ ほかの家が完了 → A が「終わりました」
// → 家族の応援 → 残りの家を順に完了、を約3分で自動で進める。中身は画面のボタンと同じ処理（Claude の作戦・カードも本物）。
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Run = () => Promise<unknown>;
export interface PresentationActions {
  announce: Run;
  ring: Run;
  goA: Run;
  goB: Run;
  completeOther: () => Promise<{ more: boolean }>;
  finishA: Run;
  cheer: Run;
}

/** 全体の目安（秒）。これを過ぎたら、残りの家の完了はやめて終わる */
const BUDGET = 175;

export default function PresentationMode({ actions }: { actions: PresentationActions }) {
  const router = useRouter();
  const on = useRef(false);
  const [running, setRunning] = useState(false);
  const [now, setNow] = useState("");
  const [sec, setSec] = useState(0);

  const start = async () => {
    on.current = true;
    setRunning(true);
    const t0 = Date.now();
    const tick = setInterval(() => setSec(Math.round((Date.now() - t0) / 1000)), 500);
    const wait = async (s: number) => {
      for (let i = 0; i < s * 10 && on.current; i++) await new Promise((ok) => setTimeout(ok, 100));
    };
    const step = async (label: string, run: Run, after: number) => {
      if (!on.current) return;
      setNow(label);
      await run();
      router.refresh();
      await wait(after);
    };
    try {
      await step("0 前夜の予告", actions.announce, 10);
      await step("1 6:30 積もった → 作戦・近所に通知（Claude が考えるので少しかかります）", actions.ring, 12);
      await step("A 田中さんが拠点7へ「行く」", actions.goA, 10);
      await step("B そうたさんが拠点7へ「行く」", actions.goB, 10);
      await step("ほかの家を1軒完了（Claude がカードを描きます）", actions.completeOther, 8);
      await step("A 田中さんが拠点7で「終わりました」", actions.finishA, 12);
      await step("拠点7の家族が「あったかくして」", actions.cheer, 10);
      let more = true;
      while (on.current && more && (Date.now() - t0) / 1000 < BUDGET - 30) {
        setNow("残りの家を順に完了");
        more = (await actions.completeOther()).more;
        router.refresh();
        await wait(6);
      }
      setNow(on.current ? "おわり。録画を止めてください" : "止めました");
    } catch (e) {
      setNow(`止まりました: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      clearInterval(tick);
      on.current = false;
      setRunning(false);
    }
  };

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => (running ? (on.current = false) : void start())}
        className={`flex w-full items-center gap-3 rounded-2xl px-4 py-2 text-left text-lg font-bold shadow-sm ring-1 ${running ? "bg-lamp text-white ring-lamp" : "bg-ink text-white ring-ink"}`}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-sm text-ink">▶</span>
        {running ? `止める（${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}）` : "発表モード（約3分・全部自動）"}
      </button>
      {now && <p className="px-2 text-sm text-ink-soft" role="status">{now}</p>}
    </div>
  );
}
