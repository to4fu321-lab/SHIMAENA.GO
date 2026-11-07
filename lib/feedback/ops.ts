// 報告箱（spec v1.33）の操作。入口はここ1つ。
//   submitFeedback … 町の人が送る → 保存 → Claude が整える → 声に貯める → 隊長の返事 → （鍵があれば）Issue を立てる
//   pendingForBridge / attachIssue … GitHub Actions の橋わたし（/api/feedback）
//   syncWithGithub … 閉じた Issue を見つけて、本人の隊長トークに「直しました」を届ける
import { triageFeedback } from "../claude/feedback";
import { inboxKeyOf } from "../inbox/key";
import { jstDate, jstIso } from "../jst";
import { deliver, reply } from "../line/client";
import { recordProblem } from "../ops/problems";
import { repo } from "../repo";
import type { Participant } from "../types";
import { addVoice } from "../voice/store";
import { createIssue, fetchIssue, hasGithubToken } from "./github";
import { DAILY_CAP, issueBody, issueTitle, outcomeMessages, outcomeOf, replyMessages, SYNC_MINUTES, TEXT_MAX, voiceCategoryOf, type FeedbackKind, type FeedbackReport } from "./rules";
import { countToday, getFeedback, insertFeedback, listFeedbackByStatus, markChecked, markIssued, markOutcome, saveTriage } from "./store";

export type SubmitResult = { ok: true; report: FeedbackReport; reply: string[] } | { ok: false; text: string };

/** 町の人が「隊長に伝える」で送った */
export async function submitFeedback(p: Participant, input: { kind: FeedbackKind; text: string; page: string }, now = new Date()): Promise<SubmitResult> {
  const text = input.text.replace(/\s+/g, " ").trim().slice(0, TEXT_MAX);
  if (text.length < 2) return { ok: false, text: "何があったか、ひとことだけでも書いてください。" };
  const key = inboxKeyOf(p);
  if (!key) return { ok: false, text: "この画面の人には隊長トークがないので、送れません。" };
  if ((await countToday(p.id, jstIso(jstDate(now), 0))) >= DAILY_CAP) return { ok: false, text: `今日はもう ${DAILY_CAP} 件届いています。続きは明日お願いします。` };

  const page = input.page.replace(/[^\w/?=&.-]/g, "").slice(0, 60) || "/";
  const report = await insertFeedback({ participantId: p.id, kind: input.kind, text, page }, now);
  const t = await triageFeedback({ kind: input.kind, text, page });
  await saveTriage(report.id, t, now);
  Object.assign(report, { triagedKind: t.kind, title: t.title, summary: t.summary, safeText: t.safe });

  // 声（spec v1.17）にも貯める: 日曜の改善提案の材料になる（要約だけ）
  const cat = voiceCategoryOf(t.kind);
  if (cat) await addVoice({ participantId: p.id, date: jstDate(now), category: cat, summary: t.summary, motives: [] }, now).catch((e) => recordProblem("feedback/voice", e));

  await reply(key, replyMessages(t));

  // 鍵があれば、その場で Issue を立てる。なければ open のまま置き、Actions の橋わたし（/api/feedback）が拾う
  if (hasGithubToken()) {
    try {
      const { number, url } = await createIssue(report);
      await markIssued(report.id, number, url, now);
      Object.assign(report, { status: "issued", issueNumber: number, issueUrl: url });
    } catch (e) {
      await recordProblem("feedback/issue", e);
    }
  }
  return { ok: true, report, reply: t.reply };
}

/** まだ Issue のない報告を、橋わたし（GitHub Actions）に渡す形で */
export async function pendingForBridge(): Promise<{ id: string; title: string; body: string }[]> {
  const open = await listFeedbackByStatus(["open"]);
  return open.map((r) => ({ id: r.id, title: issueTitle(r), body: issueBody(r) }));
}

/** 橋わたしが Issue を立てたと知らせてきた */
export async function attachIssue(id: string, number: number, url: string): Promise<boolean> {
  const r = await getFeedback(id);
  if (!r || r.status !== "open") return false;
  if (!Number.isInteger(number) || number <= 0 || !/^https:\/\/github\.com\//.test(url)) return false;
  await markIssued(id, number, url);
  return true;
}

/**
 * Issue が立っている報告の様子を GitHub で見て、閉じていたら本人に知らせる。
 * 見るのは 30 分に1回まで（公開 API の回数制限）。force なら全部見る（/admin のボタン）
 */
export async function syncWithGithub(opts: { force?: boolean } = {}, now = new Date()): Promise<{ checked: number; told: number }> {
  const issued = await listFeedbackByStatus(["issued"]);
  const due = issued.filter((r) => r.issueNumber && (opts.force || !r.checkedAt || now.getTime() - Date.parse(r.checkedAt) > SYNC_MINUTES * 60_000));
  let told = 0;
  for (const r of due) {
    try {
      const { issue, comments } = await fetchIssue(r.issueNumber!);
      const out = outcomeOf(issue, comments);
      if (!out) {
        await markChecked(r.id, now);
        continue;
      }
      if (!(await markOutcome(r.id, out.status, out.note, now))) continue;
      const p = await repo().findParticipant(r.participantId);
      const key = inboxKeyOf(p);
      if (key && (await deliver(key, outcomeMessages({ ...r, status: out.status, note: out.note })))) told++;
    } catch (e) {
      await recordProblem("feedback/sync", e);
      await markChecked(r.id, now).catch(() => undefined);
    }
  }
  return { checked: due.length, told };
}

// 同じサーバーで何度も /chat を開いても、GitHub を見に行くのは SYNC_MINUTES に1回
const g = globalThis as { __shimaenaFeedbackSyncAt?: number };
/** 画面を開いたついでに（返事を返したあとに動かす: Next の after() から呼ぶ。失敗しても画面は出す） */
export async function syncIfDue(now = new Date()): Promise<void> {
  if (g.__shimaenaFeedbackSyncAt && now.getTime() - g.__shimaenaFeedbackSyncAt < SYNC_MINUTES * 60_000) return;
  g.__shimaenaFeedbackSyncAt = now.getTime();
  await syncWithGithub({}, now).catch((e) => recordProblem("feedback/sync", e));
}
