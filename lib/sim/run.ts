// テストモード: AI 参加者 20 人と頼む家 10 軒で、雪の朝を最初から最後まで動かす。
// 画面のボタンと同じ入口（lib/morning/ops.ts の answerRollcall・setGoing・joinMission・completeWithPhoto など）を、
// 人の代わりに AI 参加者が性格どおりに押す。保存はメモリだけ（本番の DB と隊長トークは汚さない）。
import { repo, resetMemoryRoster } from "../repo";
import { listThread } from "../inbox/store";
import type { LineMessage } from "../line/types";
import { textOf } from "../line/flex";
import { DEMO_DATE } from "../morning/flow";
import { announce, answerRollcall, completeManually, completeWithPhoto, joinMission, plan, ring, setGoing } from "../morning/ops";
import { loadMorning } from "../morning/store";
import { getTeam } from "../teams";
import type { Card, TeamId } from "../types";
import { PERSONA_LABEL, simBases, simHelpers, simRequesters, type SimHelper } from "./town";

export interface SimStep {
  at: string; // 7:05 など（テストの朝の時刻）
  who: string;
  what: string;
  result: string;
}

export interface SimCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface SimCard {
  card: Card;
  recipient: string;
  svg: string;
  backSvg: string;
  /** その人の隊長トークに表・裏の画像が届いたか */
  delivered: boolean;
}

export interface SimReport {
  date: string;
  helpers: { id: string; nickname: string; team: string; persona: string }[];
  requesters: { id: string; nickname: string; level: number; area: string; style: string }[];
  steps: SimStep[];
  missions: { number: number; requester: string; status: string; required: number; members: string[]; reason: string }[];
  cards: SimCard[];
  teamTotals: Record<TeamId, number>;
  checks: SimCheck[];
  log: string[];
}

/** 吹き出しの文を1行に（長いものは切る） */
const say = (m: LineMessage[]) => {
  const t = m.map(textOf).join(" ").replace(/\s+/g, " ").trim();
  return t.length > 90 ? `${t.slice(0, 90)}…` : t;
};

/** テストの朝の時刻（JST）。夜は「よその家に行かない」決まりがあるので、朝の時刻で押す */
const atJst = (hm: string) => new Date(`${DEMO_DATE}T${hm}:00+09:00`);

/** 写真のかわり（1枚ずつ中身を変える。同じ写真の使い回しチェックに引っかからないように） */
function fakePhoto(seed: number): { bytes: Uint8Array; mediaType: "image/jpeg" } {
  const bytes = new Uint8Array(64);
  bytes.set([0xff, 0xd8, 0xff, 0xe0]);
  for (let i = 4; i < 62; i++) bytes[i] = (seed * 31 + i * 7) & 0xff;
  bytes.set([0xff, 0xd9], 62);
  return { bytes, mediaType: "image/jpeg" };
}

export async function runSimulation(): Promise<SimReport> {
  const helpers = simHelpers();
  const requesters = simRequesters();
  const bases = simBases(requesters);
  resetMemoryRoster([...helpers, ...requesters], bases);
  const persona = new Map(helpers.map((h) => [h.id, h.persona]));
  const name = new Map([...helpers, ...requesters].map((p) => [p.id, p.nickname]));
  const steps: SimStep[] = [];
  const step = (at: string, who: string, what: string, result: string) => steps.push({ at, who, what, result });

  // 1. 前夜の予告
  const a = await announce({ date: DEMO_DATE, forecastCm: 14 });
  step("21:00", "隊長", "前夜の予告", a.briefing);

  // 2. 6:30 雪かき応援のお知らせ（頼む家は登録どおり自動で「雪かき待ち」）
  await ring();
  step("6:30", "隊長", "雪かき応援のお知らせ", (await loadMorning()).log.at(-1) ?? "");

  // 3. AI 参加者が点呼に答える（隊長トークのボタンと同じ答え）
  for (const h of helpers) {
    const data = h.persona === "late" ? "rc:ans=noon" : "rc:ans=am";
    const reply = await answerRollcall(`demo:${h.id}`, data, atJst("06:33"));
    step("6:33", h.nickname, data === "rc:ans=am" ? "点呼に「朝（〜9時）」" : "点呼に「お昼（〜13時）」", say(reply));
  }

  // 4. 6:40 作戦（司令官。キーがなければ決まった手順）
  const planned = await plan();
  step("6:40", "司令官", "作戦を配信", planned.record.briefing);

  // 5. 割り当てられた人が「行く」／急用の人は「今朝は行けない」
  let s = await loadMorning();
  for (const so of [...s.morning.sorties]) {
    const p = persona.get(so.participantId);
    const go = p !== "busy";
    const reply = await setGoing(so.participantId, go, atJst("06:50"));
    step("6:50", name.get(so.participantId) ?? so.participantId, go ? "「行く」" : "「今朝は行けない」", say(reply));
  }

  // 6. 足りない家へ、手の空いた駆けつけ役（いなければ朝に動ける人）が加わる
  for (let round = 0; round < 10; round++) {
    s = await loadMorning();
    const short = s.morning.missions.find((m) => m.status === "short");
    if (!short) break;
    const busy = new Set(s.morning.sorties.filter((x) => x.status === "going").map((x) => x.participantId));
    const free = helpers.filter((h) => !busy.has(h.id) && h.persona !== "busy" && h.persona !== "late");
    const pick = free.find((h) => h.persona === "rescuer") ?? free[0];
    if (!pick) break;
    const reply = await joinMission(pick.id, short.id, atJst("07:00"));
    step("7:00", pick.nickname, `足りない家（拠点${bases.find((b) => b.id === short.baseId)?.number}）へ駆けつけ`, say(reply));
  }

  // 7. 各家で1人が写真を送って完了（写真が苦手な人は「それでも完了にする」）→ カード発行
  s = await loadMorning();
  const order = [...s.morning.missions].sort((x, y) => y.importance - x.importance);
  let minute = 5;
  for (const m of order) {
    const cur = await loadMorning();
    const mm = cur.morning.missions.find((x) => x.id === m.id);
    if (!mm || mm.status === "done") continue;
    const members = cur.morning.sorties.filter((x) => x.missionId === m.id && x.status === "going");
    if (members.length === 0) continue;
    const reporter = members[0].participantId;
    const hm = `07:${String(minute).padStart(2, "0")}`;
    minute += 4;
    const shy = persona.get(reporter) === "photoShy";
    const res = shy ? await completeManually(reporter, atJst(hm)) : await completeWithPhoto(reporter, fakePhoto(minute), atJst(hm));
    const num = bases.find((b) => b.id === m.baseId)?.number;
    step(hm.replace(/^0/, ""), name.get(reporter) ?? reporter, shy ? `拠点${num}を報告で完了（写真なし）` : `拠点${num}の完了写真を送る`, res.done ? `完了 → カード「${res.clear?.card?.designName ?? "?"}」` : `まだ: ${say(res.messages)}`);
  }

  // 8. 結果を集める
  s = await loadMorning();
  const r = repo();
  const cards: SimCard[] = [];
  for (const p of helpers) {
    for (const c of await r.listCardsByRecipient(p.id)) {
      const full = await r.getCard(c.id);
      const thread = await listThread(`demo:${p.id}`);
      const delivered = thread.some((x) => x.dir === "out" && "type" in x.body && x.body.type === "image" && x.body.originalContentUrl.includes(c.id));
      cards.push({ card: c, recipient: p.nickname, svg: full?.svg ?? "", backSvg: full?.backSvg ?? "", delivered });
    }
  }
  cards.sort((x, y) => x.card.serial - y.card.serial);

  const missions = s.morning.missions
    .map((m) => {
      const b = bases.find((x) => x.id === m.baseId);
      return {
        number: b?.number ?? 0,
        requester: name.get(b?.requesterId ?? "") ?? "?",
        status: m.status,
        required: m.requiredPeople,
        members: s.morning.sorties.filter((x) => x.missionId === m.id).map((x) => name.get(x.participantId) ?? x.participantId),
        reason: m.reason ?? "",
      };
    })
    .sort((x, y) => x.number - y.number);

  const teamTotals: Record<TeamId, number> = { salvia: 0, marigold: 0, lupinus: 0 };
  for (const e of s.morning.scores) teamTotals[e.teamId] += e.points;

  const doneSorties = s.morning.sorties.filter((x) => x.status === "done");
  const serials = cards.map((c) => c.card.serial);
  const workers = new Set(doneSorties.map((x) => x.participantId));
  const checks: SimCheck[] = [
    { name: "参加者 20 人・依頼 10 件で始まった", ok: helpers.length === 20 && bases.length === 10, detail: `手伝う ${helpers.length} 人・頼む家 ${bases.length} 軒` },
    { name: "10 軒すべてが雪かきの家（ミッション）になった", ok: s.morning.missions.length === 10, detail: `${s.morning.missions.length} 軒` },
    { name: "10 軒すべてクリア（完了）", ok: s.morning.missions.every((m) => m.status === "done"), detail: `完了 ${s.morning.missions.filter((m) => m.status === "done").length} / ${s.morning.missions.length} 軒` },
    { name: "来た人の数だけカードが出た", ok: cards.length === doneSorties.length && cards.length > 0, detail: `出動 ${doneSorties.length} 件 → カード ${cards.length} 枚` },
    { name: "カードの表・裏の絵（SVG）がある", ok: cards.every((c) => c.svg.startsWith("<svg") && c.backSvg.startsWith("<svg")), detail: `${cards.filter((c) => c.svg.startsWith("<svg")).length} 枚に表、${cards.filter((c) => c.backSvg.startsWith("<svg")).length} 枚に裏` },
    { name: "通し番号が重ならない（No.1 から順に）", ok: new Set(serials).size === serials.length && serials.every((n, i) => n === i + 1), detail: `No.${serials[0]} 〜 No.${serials.at(-1)}` },
    { name: "同じ家のカードは同じ絵の名前", ok: s.morning.missions.every((m) => new Set(cards.filter((c) => c.card.missionId === m.id).map((c) => c.card.designName)).size === 1), detail: `${new Set(cards.map((c) => c.card.designName)).size} 種類の名前` },
    { name: "カードがその人の隊長トークに届いた", ok: cards.every((c) => c.delivered), detail: `${cards.filter((c) => c.delivered).length} / ${cards.length} 枚` },
    { name: "急用の人は外れ、駆けつけで埋まった", ok: !s.morning.sorties.some((x) => persona.get(x.participantId) === "busy"), detail: `急用 ${helpers.filter((h) => h.persona === "busy").length} 人・駆けつけ ${steps.filter((x) => x.what.includes("駆けつけ")).length} 件` },
    { name: "初出撃（はじめての1枚）が記録された", ok: (s.firstFlights ?? []).length === workers.size, detail: `${(s.firstFlights ?? []).length} 人` },
    { name: "チームに点が入った", ok: Object.values(teamTotals).every((v) => v > 0), detail: (Object.keys(teamTotals) as TeamId[]).map((t) => `${getTeam(t).name} ${teamTotals[t]}点`).join("・") },
  ];

  return {
    date: DEMO_DATE,
    helpers: helpers.map((h: SimHelper) => ({ id: h.id, nickname: h.nickname, team: getTeam(h.teamId!).name, persona: PERSONA_LABEL[h.persona] })),
    requesters: requesters.map((p) => ({ id: p.id, nickname: p.nickname, level: p.level ?? 2, area: p.clearArea ?? "entrance", style: p.helpStyle === "together" ? "一緒に" : "おまかせ" })),
    steps,
    missions,
    cards,
    teamTotals,
    checks,
    log: s.log,
  };
}
