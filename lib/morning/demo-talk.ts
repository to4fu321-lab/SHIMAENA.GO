// デモの隊長トークを、地図の朝とそろえる（11/6 本人の了承「デモの一貫性」）。
// /admin の「7:10 の見本の状態に戻す」で、見本の朝（12/14・予報 12cm）に出てくる架空の人（h1〜・r1〜）の隊長トークを、
// その朝の流れ（おはよう → 今朝の作戦 → 完了）で入れ直す。こうすると地図・公開ページ・隊長トークを行き来しても話がつながる。
// さわるのは demo:<ID> の鍵だけ（本物の人の隊長トークには触れない）。
import { DEMO_PREFIX, inboxKeyOf } from "../inbox/key";
import { appendOut, clearThread } from "../inbox/store";
import { MSG } from "../line/messages";
import type { LineMessage } from "../line/types";
import { getTeam } from "../teams";
import type { Participant } from "../types";
import type { MorningRecord } from "./flow";
import type { Roster } from "./roster";

/** 見本の朝の時刻（JST）を Date に */
const atJst = (date: string, hm: string) => new Date(`${date}T${hm}:00+09:00`);

export interface DemoTalk {
  key: string;
  at: Date;
  messages: LineMessage[];
}

/** 見本の朝から、架空の人ごとの「届いたはずの文面」を作る（純粋な関数） */
export function demoTalks(record: MorningRecord, roster: Roster): DemoTalk[] {
  const { rollcall, missions, sorties, scores } = record.morning;
  const date = rollcall.date;
  const byId = new Map(roster.participants.map((p) => [p.id, p]));
  const demoKey = (p: Participant | undefined) => {
    const k = inboxKeyOf(p);
    return k && k.startsWith(DEMO_PREFIX) ? k : undefined;
  };
  const hello = MSG.morningHello(rollcall.forecastCm, rollcall.snowName);
  const pointsOf = (teamId: string) => scores.filter((e) => e.teamId === teamId).reduce((a, e) => a + e.points, 0);
  const out: DemoTalk[] = [];
  const baseNo = (baseId: string) => roster.bases.find((b) => b.id === baseId)?.number ?? "?";

  // 手伝う側: おはよう＋今朝の作戦（6:40）→ 終わった家なら完了（7:05）
  for (const x of sorties) {
    const p = byId.get(x.participantId);
    const key = demoKey(p);
    const m = missions.find((y) => y.id === x.missionId);
    if (!key || !m) continue;
    const n = baseNo(m.baseId);
    out.push({ key, at: atJst(date, "06:40"), messages: [...hello, ...MSG.planForHelper(`今朝は拠点${n}へ。${m.reason ?? ""}`.trim())] });
    if (m.status === "done") {
      const first = sorties.find((y) => y.missionId === m.id);
      const by = (first && byId.get(first.participantId)?.nickname) || "仲間";
      out.push({ key, at: atJst(date, "07:05"), messages: MSG.doneByOther(n, by, getTeam(x.teamId).name, pointsOf(x.teamId)) });
    }
  }
  // お願いした家の人: おはよう（6:40）→ 終わったら完了の知らせ（7:05、ありがとうの3ボタンつき）
  for (const m of missions) {
    if (m.status === "no_answer") continue;
    const base = roster.bases.find((b) => b.id === m.baseId);
    const requester = base && byId.get(base.requesterId);
    const key = demoKey(requester);
    if (!key) continue;
    out.push({ key, at: atJst(date, "06:40"), messages: hello });
    if (m.status === "done") {
      const names = sorties.filter((y) => y.missionId === m.id).flatMap((y) => byId.get(y.participantId)?.nickname ?? []);
      out.push({ key, at: atJst(date, "07:05"), messages: MSG.requesterDoneNotice(names, m.id) });
    }
  }
  return out;
}

/** 架空の人の隊長トークを空にしてから、見本の朝の文面を入れる。入れた人数を返す */
export async function seedDemoTalk(record: MorningRecord, roster: Roster): Promise<number> {
  const talks = demoTalks(record, roster);
  const keys = [...new Set(talks.map((t) => t.key))];
  for (const k of keys) await clearThread(k);
  for (const t of talks.sort((a, b) => a.at.getTime() - b.at.getTime())) await appendOut(t.key, t.messages, t.at);
  return keys.length;
}
