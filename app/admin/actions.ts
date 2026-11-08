"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { demoEnabled } from "@/lib/env";
import { insertRoadReport } from "@/lib/road/store";
import { TOWN } from "@/lib/town";
import { jstDate } from "@/lib/jst";
import { withStateLock } from "@/lib/ops/lock";
import { clearProblems } from "@/lib/ops/problems";
import { applySchema, seedTown } from "@/lib/db";
import { issueCardsForMission } from "@/lib/cards/issue";
import { completeNextForDemo, fillAnswers, rescueShort, type MorningRecord } from "@/lib/morning/flow";
import { isThanksChoice } from "@/lib/claude/thanks";
import { isCheerChoice } from "@/lib/morning/cheer";
import { latestClear } from "@/lib/morning/clear";
import {
  announce,
  applyCheer,
  applyThanks,
  checkForecastAndAnnounce,
  completeManually,
  escalateHelpIfDue,
  joinMission,
  notifyHelp,
  plan,
  reopenIfStillSnowing,
  ring,
  weeklyRecap,
  writeRecap,
} from "@/lib/morning/ops";
import { loadRoster } from "@/lib/morning/roster";
import { loadMorning, resetToSample, saveMorning } from "@/lib/morning/store";
import { progress } from "@/lib/morning/view";
import { appToday } from "@/lib/morning/today";
import { recordHouseFeathers } from "@/lib/solo/ops";
import { refreshShareTexts } from "@/lib/sns/refresh";
import { writeImprovements } from "@/lib/voice/improve";
import { nudgeInactive } from "@/lib/nudge/ops";
import { seedDemoStory } from "@/lib/kikigaki/ops";
import { seedDemoTalk } from "@/lib/morning/demo-talk";
import { syncWithGithub } from "@/lib/feedback/ops";
import { STAGE_CAST, STAGE_IDS } from "@/lib/demo-cast";
import { DEMO_PREFIX, inboxKeyOf } from "@/lib/inbox/key";
import { clearThread } from "@/lib/inbox/store";
import { push } from "@/lib/line/client";
import { MSG } from "@/lib/line/messages";
import { getTeam, TEAMS } from "@/lib/teams";
import { distanceM } from "@/lib/game/help";
import type { LineMessage } from "@/lib/line/types";

/** 管理の操作の入口: 合言葉のログインを確かめ、今朝の状態の鍵を取ってから動かす */
async function guarded<T>(label: string, fn: () => Promise<T>): Promise<T> {
  await requireAdmin();
  return withStateLock(`admin:${label}`, fn);
}

function refresh() {
  revalidatePath("/");
  revalidatePath("/map");
  revalidatePath("/admin");
}

/** 読む → 書き換える → 保存する、をひとまとめに */
async function update(change: (s: MorningRecord) => void | Promise<void>) {
  const s = await loadMorning();
  await change(s);
  await saveMorning(s);
  refresh();
}

/** 0: デモの日付で予告（予報 12cm）。LINE のある人には予告が届く */
export async function startEmptyMorning() {
  return guarded("startEmptyMorning", async () => {
    // デモの架空の人の隊長トークは空にしてから始める（練習の知らせが撮影に残らないように。本物の人のトークには触れない）
    if (demoEnabled()) {
      for (const p of (await loadRoster()).participants) {
        const k = inboxKeyOf(p);
        if (k?.startsWith(DEMO_PREFIX)) await clearThread(k).catch(() => undefined);
      }
    }
    // 撮影・審査では本当の日付の朝にする（地図やカードの「12月14日」と、トークの日付が混ざらないように。11/8 点検）
    await announce({ date: jstDate(new Date()), forecastCm: 12 });
    refresh();
  });
}

/** 0': 本当の天気を見て、基準（5cm）を超えていれば明朝の予告を出す */
export async function announceByForecast() {
  return guarded("announceByForecast", async () => {
    try {
      await checkForecastAndAnnounce(); // 予告の有無はどちらも記録に残る
    } catch (e) {
      await update((s) => void s.log.push(`天気の取得に失敗: ${e instanceof Error ? e.message : String(e)}`));
      return;
    }
    refresh();
  });
}

export async function ringNow() {
  return guarded("ringNow", async () => {
    await ring();
    // 本番の 6:30（morningAuto）と同じく、続けて作戦を立てて近所に通知する（11/8 本人「1 で通知が来るように」）
    if ((await loadMorning()).morning.rollcall.status === "open") await plan();
    refresh();
  });
}

export async function answerRandomly() {
  return guarded("answerRandomly", async () => {
    const roster = await loadRoster();
    await update((s) => fillAnswers(s, roster, Date.now() % 100000));
  });
}

export async function runCommander() {
  return guarded("runCommander", async () => {
    await plan();
    refresh();
  });
}

/** 降り続く日（v1.8 デモ）: 天気を見ずに、終わった家をもう一度開く（2回目・3回目） */
export async function reopenDemo() {
  return guarded("reopenDemo", async () => {
    await reopenIfStillSnowing(new Date(), { force: true });
    refresh();
  });
}

/** 4: そろった家を1軒、完了にする（デモ）。カードも発行して、LINE のある人には届く。全軒終わったら今朝の実況 */
export async function completeOne() {
  return guarded("completeOne", async () => {
    const roster = await loadRoster();
    let allDone = false;
    const notices: { key: string; messages: LineMessage[] }[] = [];
    await update(async (s) => {
      // 本物の人（LINE でログインした人）と撮影ステージの3人は勝手に動かさない。その人が向かっている家は、本人の写真で終えるので後回し
      const keep = new Set([...roster.participants.filter((p) => p.lineUserId).map((p) => p.id), ...STAGE_IDS]);
      const skip = (id: string) => s.morning.sorties.some((x) => x.missionId === id && x.status === "going" && keep.has(x.participantId));
      const missionId = completeNextForDemo(s, roster, skip, keep);
      const mission = s.morning.missions.find((m) => m.id === missionId);
      if (!mission) return;
      const sorties = s.morning.sorties.filter((x) => x.missionId === mission.id);
      try {
        const issued = await issueCardsForMission(s, roster, mission, sorties);
        s.firstFlights = [...new Set([...(s.firstFlights ?? []), ...issued.firstFlightIds])];
      } catch (e) {
        s.log.push(`カードの発行に失敗: ${e instanceof Error ? e.message : String(e)}`);
      }
      // 来た人の個人の記録（羽）。チーム得点は completeNext のまま
      const base = roster.bases.find((b) => b.id === mission.baseId);
      const requester = base && roster.participants.find((p) => p.id === base.requesterId);
      const people = sorties.flatMap((x) => roster.participants.filter((p) => p.id === x.participantId));
      const now = new Date();
      await recordHouseFeathers(people, { missionId: mission.id, baseLocation: requester?.location, today: appToday(s, now), now });
      allDone = progress(s.morning).allDone;
      // 隊長トークにも完了を届ける（来た人へ・お願いした人へ）。地図と隊長トークの話をそろえる
      const number = base?.number ?? "?";
      const by = people[0]?.nickname ?? "仲間";
      const pointsOf = (teamId: string) => s.morning.scores.filter((e) => e.teamId === teamId).reduce((a, e) => a + e.points, 0);
      for (const x of sorties) {
        const k = inboxKeyOf(roster.participants.find((p) => p.id === x.participantId));
        if (k) notices.push({ key: k, messages: MSG.doneByOther(number, by, getTeam(x.teamId).name, pointsOf(x.teamId)) });
      }
      const rk = inboxKeyOf(requester);
      if (rk) notices.push({ key: rk, messages: MSG.requesterDoneNotice(people.map((p) => p.nickname), mission.id) });
    });
    for (const n of notices) await push(n.key, n.messages);
    revalidatePath("/chat");
    if (allDone) await writeRecapNow();
    else await refreshShareTexts().catch((e) => console.error("[share]", e));
  });
}

/**
 * 4 を自動で（11/8 本人「完了にするボタンを自動で順番に完了にしていってほしい」）: 1軒終えて、まだ終えられる家が残っているかを返す。
 * 撮影ステージの3人とログインした本物の人が向かっている家は、本人の写真で終えるので数えない（4 と同じ）。
 */
export async function completeOneAuto(): Promise<{ more: boolean }> {
  await completeOne();
  return guarded("completeOneAuto", async () => {
    const [s, roster] = await Promise.all([loadMorning(), loadRoster()]);
    if (s.morning.rollcall.status !== "planned") return { more: false };
    const keep = new Set([...roster.participants.filter((p) => p.lineUserId).map((p) => p.id), ...STAGE_IDS]);
    const kept = (id: string) => s.morning.sorties.some((x) => x.missionId === id && x.status === "going" && keep.has(x.participantId));
    const more = s.morning.missions.some((m) => (m.status === "assigned" || m.status === "in_progress" || m.status === "short") && !kept(m.id));
    refresh();
    return { more };
  });
}

// ---- 発表モード（11/8 本人「admin に発表モードで、終わりましたや助けに行くなども勝手に動くように。録画時間を3分ほどで」）----
// 撮影ステージの3人（A 田中さん・B そうたさん・C 小林さん）を、画面のボタンの代わりにここから動かす。中身は画面で押したときと同じ処理。

/** 撮影ステージの C の家（拠点7）の、今朝のミッション */
async function stageMission() {
  const [s, roster] = await Promise.all([loadMorning(), loadRoster()]);
  const base = roster.bases.find((b) => b.requesterId === STAGE_CAST.c);
  return { s, roster, mission: base ? s.morning.missions.find((m) => m.baseId === base.id) : undefined };
}

/** 発表モード: A か B が、拠点7の「行く（10分でも）」を押したのと同じ */
export async function presentGo(who: "a" | "b"): Promise<string> {
  return guarded("presentGo", async () => {
    const { roster, mission } = await stageMission();
    if (!mission) return "拠点7のミッションがありません（先に 1 を）";
    const p = roster.participants.find((x) => x.id === STAGE_CAST[who]);
    const messages = await joinMission(STAGE_CAST[who], mission.id, new Date(), { extra: true });
    const k = inboxKeyOf(p);
    if (k) await push(k, messages);
    refresh();
    revalidatePath("/chat");
    return `${p?.nickname ?? who}さんが拠点7へ`;
  });
}

/** 発表モード: 拠点7にまだ来ていないチームから、いちばん近い架空の人を1人ずつ呼ぶ（3チームそろう。11/8 本人「3チーム全てが参加してるように」） */
export async function presentAllTeams(): Promise<string> {
  return guarded("presentAllTeams", async () => {
    const { s, roster, mission } = await stageMission();
    if (!mission) return "拠点7のミッションがありません（先に 1 を）";
    const home = roster.participants.find((p) => p.id === STAGE_CAST.c)?.location;
    const here = new Set(s.morning.sorties.filter((x) => x.missionId === mission.id).map((x) => x.teamId));
    const busy = new Set(s.morning.sorties.filter((x) => x.status === "going").map((x) => x.participantId));
    const names: string[] = [];
    for (const t of TEAMS) {
      if (here.has(t.id)) continue;
      const pick = roster.participants
        .filter((p) => p.role === "helper" && p.teamId === t.id && !p.lineUserId && !STAGE_IDS.has(p.id) && !busy.has(p.id))
        .sort((a, b) => (home ? distanceM(a.location, home) - distanceM(b.location, home) : 0))[0];
      if (!pick) continue;
      await joinMission(pick.id, mission.id, new Date(), { extra: true });
      names.push(`${pick.nickname}さん（${t.name}）`);
    }
    refresh();
    revalidatePath("/chat");
    return names.length > 0 ? `${names.join("・")}も拠点7へ` : "拠点7には、もう3チームそろっています";
  });
}

/** 発表モード: A が拠点7で「終わりました」（写真なし・本人の報告として。写真の確認はスマホで撮る場面で見せる） */
export async function presentFinish(): Promise<string> {
  return guarded("presentFinish", async () => {
    const r = await completeManually(STAGE_CAST.a);
    const roster = await loadRoster();
    const k = inboxKeyOf(roster.participants.find((x) => x.id === STAGE_CAST.a));
    if (k) await push(k, r.messages);
    refresh();
    revalidatePath("/chat");
    return r.done ? "拠点7 完了" : "拠点7 はまだ完了にできませんでした";
  });
}

/** 発表モード: 拠点7の家族が「あったかくして」 */
export async function presentCheer(): Promise<string> {
  return guarded("presentCheer", async () => {
    const { mission } = await stageMission();
    if (!mission || mission.status !== "done") return "拠点7 がまだ終わっていません";
    await applyCheer(mission.id, "2");
    refresh();
    revalidatePath("/chat");
    return "家族の応援「あったかくして」";
  });
}

/** 町の週刊絵本（spec v1.27）: 今週の記録から文と絵を作る。絵は返事のあとで Claude が描いて差しかえる */
export async function makeBookNow() {
  return guarded("makeBookNow", async () => {
    const { currentWeekStart, makeBook } = await import("@/lib/book/make");
    try {
      const b = await makeBook(await currentWeekStart());
      await update((s) => void s.log.push(`今週の絵本「${b.title}」を作りました（文: ${b.by === "claude" ? "Claude" : "定型"}・絵: ${b.status === "drawing" ? "Claude が描いています" : "プログラム"}）`));
    } catch (e) {
      await update((s) => void s.log.push(`今週の絵本に失敗: ${e instanceof Error ? e.message : String(e)}`));
    }
    revalidatePath("/book");
  });
}

/** SNS の投稿文を Claude に書いてもらう（数字が変わっていなくても作り直す）。キーがなければ定型のまま */
export async function writeShareTextsNow() {
  return guarded("writeShareTextsNow", async () => {
    try {
      const n = await refreshShareTexts(new Date(), { force: true });
      await update((s) => void s.log.push(n > 0 ? `SNS の投稿文を Claude が ${n} 種類書いた` : "SNS の投稿文: Claude のキーがないので定型のまま"));
    } catch (e) {
      await update((s) => void s.log.push(`SNS の投稿文に失敗: ${e instanceof Error ? e.message : String(e)}`));
    }
    revalidatePath("/public/town");
  });
}

/** ありがとう点呼を、いちばん最近に終わった家の依頼者の代わりに押す（デモ用。本番は依頼者の LINE のボタン） */
export async function thanksDemo(formData: FormData) {
  return guarded("thanksDemo", async () => {
    const choice = String(formData.get("choice") ?? "1");
    if (!isThanksChoice(choice)) return;
    const s = await loadMorning();
    const roster = await loadRoster();
    const latest = latestClear(s.morning, roster);
    if (!latest) return;
    await applyThanks(latest.missionId, choice);
    refresh();
  });
}

/** 家族の応援スタンプを、いちばん最近に終わった家の家族の代わりに押す（デモ用。本番は家族の LINE のボタン） */
export async function cheerDemo(formData: FormData) {
  return guarded("cheerDemo", async () => {
    const choice = String(formData.get("choice") ?? "1");
    if (!isCheerChoice(choice)) return;
    const s = await loadMorning();
    const roster = await loadRoster();
    const latest = latestClear(s.morning, roster);
    if (!latest) return;
    await applyCheer(latest.missionId, choice);
    refresh();
  });
}

/** 今朝の実況を書く（Claude。キーがなければ定型）。全軒完了では自動で呼ばれる */
export async function writeRecapNow() {
  return guarded("writeRecapNow", async () => {
    try {
      await writeRecap();
    } catch (e) {
      await update((s) => void s.log.push(`今朝の実況に失敗: ${e instanceof Error ? e.message : String(e)}`));
      return;
    }
    refresh();
  });
}

export async function rescue() {
  return guarded("rescue", async () => {
    const roster = await loadRoster();
    await update((s) => void rescueShort(s, roster, undefined, STAGE_IDS)); // 撮影ステージの3人は勝手に動かさない
  });
}

/** 人手不足の家のヘルプ通知を次の輪へ（300m → 600m → 1km → サポーター）。5分待たずに進める */
export async function helpNextRing() {
  return guarded("helpNextRing", async () => {
    const s = await loadMorning();
    let n = 0;
    for (const m of s.morning.missions) if (m.status === "short" && (await notifyHelp(m.id)) !== null) n++;
    if (n === 0) await escalateHelpIfDue();
    refresh();
  });
}

/** 日曜の「今週の群れ」: 実況・称号・週の目標・翌週のシャッフル */
export async function runWeekly() {
  return guarded("runWeekly", async () => {
    try {
      await weeklyRecap();
    } catch (e) {
      await update((s) => void s.log.push(`今週のまとめに失敗: ${e instanceof Error ? e.message : String(e)}`));
      return;
    }
    refresh();
  });
}

export async function backToSample() {
  return guarded("backToSample", async () => {
    if (!demoEnabled()) return; // 本当にエリアで使っているときは、見本の状態に戻さない
    await resetToSample();
    // 架空の人の隊長トークも、見本の朝（おはよう → 作戦 → 完了）に入れ直す（地図と話をそろえる）
    try {
      await seedDemoTalk(await loadMorning(), await loadRoster());
    } catch (e) {
      await update((s) => void s.log.push(`デモの隊長トークを入れられませんでした: ${e instanceof Error ? e.message : String(e)}`));
    }
    revalidatePath("/chat");
    refresh();
  });
}

export async function setViewer(formData: FormData) {
  return guarded("setViewer", async () => {
    const id = String(formData.get("viewerId") ?? "");
    if (/^h\d+$/.test(id)) await update((s) => void (s.morning.viewerId = id));
  });
}

/** Neon に表を作り、架空のエリアデータを入れる（何度押しても安全） */
export async function prepareDatabase() {
  return guarded("prepareDatabase", async () => {
    const statements = await applySchema();
    const seeded = await seedTown();
    await update((s) => {
      s.log.push(`DB を準備しました（SQL ${statements} 文・参加者 ${seeded.participants} 人・拠点 ${seeded.bases} 軒）`);
    });
  });
}

/** しばらく活動のない人へ、隊長の声かけ（spec v1.18。16:30 の自動と同じ） */
export async function nudgeNow() {
  return guarded("nudgeNow", async () => {
    try {
      const r = await nudgeInactive();
      await update((s) => void s.log.push(`隊長の声かけ: ${r.checked} 人を見て ${r.sent} 人に${r.names.length ? `（${r.names.join("・")}）` : ""}`));
    } catch (e) {
      await update((s) => void s.log.push(`隊長の声かけに失敗: ${e instanceof Error ? e.message : String(e)}`));
    }
    revalidatePath("/admin");
  });
}

/** 1週間の声から、改善の提案を書く（spec v1.17。日曜の自動と同じ） */
export async function writeImprovementsNow() {
  return guarded("writeImprovements", async () => {
    try {
      const imp = await writeImprovements();
      await update((s) => void s.log.push(`改善の提案を書きました（声 ${imp.total} 件 → 提案 ${imp.proposals.length} 件${imp.byClaude ? "・Claude" : "・定型"}）`));
    } catch (e) {
      await update((s) => void s.log.push(`改善の提案に失敗: ${e instanceof Error ? e.message : String(e)}`));
    }
    revalidatePath("/admin");
  });
}

/** 報告箱（spec v1.33）: GitHub の Issue が閉じていないか今すぐ見て、直った報告を本人に知らせる */
export async function syncFeedbackNow() {
  return guarded("syncFeedback", async () => {
    try {
      const r = await syncWithGithub({ force: true });
      await update((s) => void s.log.push(`報告箱: GitHub を ${r.checked} 件見て、${r.told} 人に「直しました」を届けました`));
    } catch (e) {
      await update((s) => void s.log.push(`報告箱の確認に失敗: ${e instanceof Error ? e.message : String(e)}`));
    }
    revalidatePath("/admin");
  });
}

/** /admin の「問題」の記録を空にする */
export async function clearProblemsAction() {
  return guarded("clearProblems", async () => {
    await clearProblems();
    revalidatePath("/admin");
  });
}

/** デモ用: 道の報告（滑る・細い）を町の中に2件入れる（写真なし。道の報告の地図の確認用） */
export async function seedRoadReportsDemo() {
  return guarded("seedRoadReportsDemo", async () => {
    const now = new Date();
    const [lat, lng] = TOWN.center;
    const items = [
      { hazard: "ice" as const, dLat: 0.0012, dLng: -0.0015, note: "交差点の角がつるつる", minAgo: 25 },
      { hazard: "narrow" as const, dLat: -0.0009, dLng: 0.0013, note: "", minAgo: 140 },
    ];
    for (const it of items) {
      const at = new Date(now.getTime() - it.minAgo * 60000);
      await insertRoadReport({
        id: `demo-road-${it.hazard}-${now.getTime()}`,
        participantId: "h2",
        hazard: it.hazard,
        location: [lat + it.dLat, lng + it.dLng],
        ...(it.note ? { note: it.note } : {}),
        at: at.toISOString(),
        date: jstDate(at),
        notifiedAt: at.toISOString(),
      });
    }
    await update((s) => void s.log.push("デモの道の報告を2件入れました（つるつる・道が細い）"));
    revalidatePath("/admin");
    revalidatePath("/map");
  });
}

/** デモ用（spec v1.26）: 次に完了しそうな家の人の「雪の聞き書き」を1件入れる（届ける、を選んだ状態）。その家が終わると、来た人の隊長トークに届く */
export async function seedKikigakiDemo() {
  return guarded("seedKikigakiDemo", async () => {
    const s = await loadMorning();
    const roster = await loadRoster();
    const next = s.morning.missions.filter((m) => m.status !== "done").sort((a, b) => b.importance - a.importance)[0];
    const base = roster.bases.find((b) => b.id === next?.baseId) ?? roster.bases[0];
    if (!base) return;
    const story = await seedDemoStory(base.requesterId);
    await update((x) => void x.log.push(`デモの雪の聞き書き「${story.title}」を拠点${base.number}の家に入れました（${base.requesterId}・届ける）`));
  });
}
