// 公開ページ・SNS カード用に、保存先から集計を組み立てる（サーバー側）。表がまだない・DB の不調でも画面を止めない。
import { weekStart } from "../game/week";
import { loadRoster } from "../morning/roster";
import { listMornings, loadMorning } from "../morning/store";
import { appToday } from "../morning/today";
import { repo } from "../repo";
import { buildPublicStats, type PublicStats } from "./stats";
import { appNow } from "@/lib/clock";

export async function loadPublicStats(now: Date = appNow()): Promise<PublicStats> {
  const [record, roster] = await Promise.all([loadMorning(), loadRoster()]);
  const today = appToday(record, now);
  const from = weekStart(today);
  const [soloWeek, weekRecords, cheers] = await Promise.all([
    repo().listSoloLogsBetween(from, today).catch(() => []),
    listMornings(from, today).catch(() => [record]),
    repo().getCheer(today).catch(() => 0),
  ]);
  return buildPublicStats({ record, roster, today, soloWeek, weekRecords, cheers });
}
