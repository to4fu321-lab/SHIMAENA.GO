// Webhook のイベントを1つ受け取り、登録の会話を進めて返信する。
// 会話のルールは registration.ts（純粋な関数）。ここは保存・レベル判定・チーム配属・返信という「副作用」だけ。
import { randomBytes } from "node:crypto";
import { judgeLevel } from "../claude/level";
import { assignTeam, makeLinkCode } from "../game/team";
import { sniffImageType } from "../image";
import {
  answerByWords,
  answerRollcall,
  completeManually,
  completeWithPhoto,
  escalateHelpIfDue,
  joinMission,
  helpOpenFor,
  offerTaskNow,
  planIfDue,
  rollcallQuestion,
  sendCheer,
  sendThanks,
  setGoing,
  tipReceive,
  tipStart,
} from "../morning/ops";
import { NOW_MINUTES, type NowMinutes } from "../morning/watch";
import { concierge, CONSULT_WORDS, inConversation } from "../concierge/run";
import { faqKind, faqReply } from "../concierge/faq";
import { clearSession as clearConcierge } from "../concierge/session";
import { setAlertPref } from "../road/store";
import { repo } from "../repo";
import { jstDate } from "../jst";
import { teamTerm } from "../team-theme";
import type { FamilyLink, Participant } from "../types";
import { getMessageContent, getProfile, push, reply } from "./client";
import { liffUrl } from "../url";
import { ensureTeam } from "../member";
import { MSG } from "./messages";
import { parseText, step, type RegInput, type Registration } from "./registration";
import type { LineEvent, LineMessage } from "./types";

const newId = (prefix: string) => `${prefix}-${randomBytes(6).toString("base64url")}`;

/** LINE のイベントを会話の入力に直す。扱わないイベントは null */
export function toInput(ev: LineEvent): RegInput | null {
  if (ev.type === "follow") return { kind: "follow" };
  if (ev.type === "postback" && "postback" in ev) return { kind: "postback", data: ev.postback.data };
  if (ev.type === "message" && "message" in ev) {
    const m = ev.message;
    if (m.type === "text") return parseText(m.text);
    if (m.type === "location") return { kind: "location", location: [m.latitude, m.longitude] };
  }
  return null;
}

async function nickname(lineUserId: string): Promise<string> {
  return (await getProfile(lineUserId))?.displayName ?? "参加者";
}

/** 2問まで終わった登録を保存し、最後の文面を返す */
export async function finishRegistration(lineUserId: string, reg: Registration): Promise<LineMessage[]> {
  const r = repo();
  const name = await nickname(lineUserId);

  if (reg.role === "helper") {
    const existing = await r.findParticipantByLineUserId(lineUserId);
    const teamId =
      existing?.role === "helper" && existing.teamId ? existing.teamId : assignTeam(await r.countHelpersByTeam());
    const p: Participant = {
      id: existing?.id ?? newId("p"),
      nickname: name,
      role: "helper",
      location: reg.location,
      lineUserId,
      teamId,
      morningMinutes: reg.morningMinutes,
      hasTools: reg.hasTools,
    };
    await r.upsertParticipant(p);
    return [...MSG.helperDone(teamId, teamTerm(jstDate())), ...MSG.soloInvite(liffUrl("/solo"), "helper")];
  }

  const level = await judgeLevel({ soloMinutes: reg.soloMinutes, clearArea: reg.clearArea });
  // 本人の登録なら、その LINE の参加者を上書き。家族の代理なら、本人の LINE はまだ分からないので新しく作る
  const existing = reg.proxy ? undefined : await r.findParticipantByLineUserId(lineUserId);
  const p: Participant = {
    id: existing?.id ?? newId("p"),
    nickname: reg.proxy ? `${name}さんのご家族` : name,
    role: "requester",
    location: reg.location,
    soloMinutes: reg.soloMinutes,
    clearArea: reg.clearArea,
    level: level.level,
  };
  if (!reg.proxy) p.lineUserId = lineUserId;
  else p.registeredByFamilyId = lineUserId;
  await r.upsertParticipant(p);

  // 拠点（地図の番号）。まだなければ次の番号を振る
  const base = await r.findBaseByRequester(p.id);
  if (!base) await r.upsertBase({ id: `base-${p.id}`, number: await r.nextBaseNumber(), requesterId: p.id });

  // お互いさま（v1.10）: 本人の登録ならチームに入る（家族の代理はまだ本人の LINE がないので入れない）
  if (!reg.proxy) {
    p.teamId = existing?.teamId ?? assignTeam(await r.countHelpersByTeam());
    await r.upsertParticipant(p);
  }
  const messages: LineMessage[] = MSG.requesterDone(level.message, level.level, level.requiredPeople);
  if (reg.proxy) {
    const link: FamilyLink = { familyLineUserId: lineUserId, requesterId: p.id, linkCode: makeLinkCode() };
    await r.addFamilyLink(link);
    messages.push(...MSG.proxyDone(link.linkCode));
  } else {
    messages.push(...MSG.soloInvite(liffUrl("/solo"), "requester"));
  }
  return messages;
}

/** 連携コードで、本人の LINE か家族の LINE を依頼者に紐づける */
export async function applyLink(lineUserId: string, code: string, who: "self" | "family"): Promise<LineMessage[]> {
  const r = repo();
  const found = await r.findFamilyLinkByCode(code);
  if (!found) return MSG.codeNotFound();
  const requester = await r.findParticipant(found.requesterId);
  if (!requester) return MSG.codeNotFound();

  if (who === "self") {
    await r.upsertParticipant({ ...requester, lineUserId });
    return MSG.linkedSelf();
  }
  await r.addFamilyLink({ familyLineUserId: lineUserId, requesterId: requester.id, linkCode: makeLinkCode() });
  return MSG.linkedFamily();
}

/** 近くに手伝える家がないとき: ひとこと＋コンシェルジュが1つすすめる（使えなければ今までの案内） */
async function nothingNow(lineUserId: string): Promise<LineMessage[]> {
  const cc = await concierge(lineUserId, "近くに手伝える家がない。ほかに何ができる？", new Date(), { force: true }).catch(() => null);
  return cc ? [...MSG.nowNoneLead(), ...cc] : MSG.nowNothing();
}

export async function handleEvent(ev: LineEvent): Promise<void> {
  const lineUserId = ev.source.userId;
  if (!lineUserId) return;
  const r = repo();

  if (ev.type === "unfollow") {
    await r.setSession(lineUserId, null);
    return;
  }

  // 前に登録したお願いする側の人も、LINE を使ったらチームに入る（v1.10）
  if (ev.type === "message" || ev.type === "postback") {
    const me = await r.findParticipantByLineUserId(lineUserId);
    if (me) await ensureTeam(me);
  }

  // 点呼の答え（rc:ans=...）は登録の会話とは別に扱う
  if (ev.type === "postback" && "postback" in ev && ev.postback.data.startsWith("rc:")) {
    const messages = await answerRollcall(lineUserId, ev.postback.data);
    if (ev.replyToken) await reply(ev.replyToken, messages);
    await planIfDue();
    await escalateHelpIfDue();
    return;
  }

  // 「出動する」（リッチメニュー／文字。前の名前「いまからやる」も受け付ける）→ 何分？ → 近くの小タスクを1件
  if (ev.type === "message" && "message" in ev && ev.message.type === "text" && /^(出動する|出動|いまからやる)$/.test(ev.message.text.trim())) {
    const p = await r.findParticipantByLineUserId(lineUserId);
    // 手伝える家がない日は、何分？を聞かずにコンシェルジュのおすすめへ（行き止まりにしない）
    const messages = p && !(await helpOpenFor(p.id)) ? await nothingNow(lineUserId) : MSG.nowAsk();
    if (ev.replyToken) await reply(ev.replyToken, messages);
    return;
  }
  // 隊長に相談とよくある質問（spec v1.10）
  if (ev.type === "message" && "message" in ev && ev.message.type === "text") {
    const kind = faqKind(ev.message.text);
    if (kind) {
      await clearConcierge(lineUserId);
      if (ev.replyToken) await reply(ev.replyToken, await faqReply(lineUserId, kind));
      return;
    }
  }
  if (ev.type === "postback" && "postback" in ev && ev.postback.data.startsWith("now:")) {
    const p = await r.findParticipantByLineUserId(lineUserId);
    const minutes = Number(ev.postback.data.slice(4));
    const ok = (NOW_MINUTES as readonly number[]).includes(minutes);
    const messages = !p
      ? MSG.notRegistered()
      : !ok
        ? MSG.nowAsk()
        : !(await helpOpenFor(p.id, minutes as NowMinutes))
          ? await nothingNow(lineUserId)
          : await offerTaskNow(p.id, minutes as NowMinutes);
    if (ev.replyToken) await reply(ev.replyToken, messages);
    return;
  }

  // ヘルプ通知の「行く（10分でも）」「今は無理」、返事なしの「声をかけに行く」
  if (ev.type === "postback" && "postback" in ev && (ev.postback.data.startsWith("help:") || ev.postback.data.startsWith("knock:"))) {
    const data = ev.postback.data;
    const p = await r.findParticipantByLineUserId(lineUserId);
    let messages: LineMessage[];
    if (!p) messages = MSG.notRegistered();
    else if (data.startsWith("help:go=")) messages = await joinMission(p.id, data.slice("help:go=".length));
    else if (data.startsWith("knock:")) messages = MSG.knockThanks();
    else messages = MSG.helpDeclined();
    if (ev.replyToken) await reply(ev.replyToken, messages);
    await escalateHelpIfDue();
    return;
  }

  // ありがとう点呼（お願いした人の3択）
  if (ev.type === "postback" && "postback" in ev && ev.postback.data.startsWith("thanks:")) {
    const messages = await sendThanks(lineUserId, ev.postback.data);
    if (ev.replyToken) await reply(ev.replyToken, messages);
    return;
  }

  // 家族の応援スタンプ（その家に紐づいた家族だけ）
  if (ev.type === "postback" && "postback" in ev && ev.postback.data.startsWith("cheer:")) {
    const messages = await sendCheer(lineUserId, ev.postback.data);
    if (ev.replyToken) await reply(ev.replyToken, messages);
    return;
  }

  // 「行く」「今朝は行けない」
  if (ev.type === "postback" && "postback" in ev && ev.postback.data.startsWith("go:")) {
    const p = await r.findParticipantByLineUserId(lineUserId);
    const messages = p ? await setGoing(p.id, ev.postback.data === "go:yes") : MSG.notRegistered();
    if (ev.replyToken) await reply(ev.replyToken, messages);
    return;
  }

  // 「それでも完了にする」（写真なし、本人の報告）
  if (ev.type === "postback" && "postback" in ev && ev.postback.data === "done:manual") {
    const p = await r.findParticipantByLineUserId(lineUserId);
    const messages = p ? (await completeManually(p.id)).messages : MSG.notRegistered();
    if (ev.replyToken) await reply(ev.replyToken, messages);
    return;
  }

  // 写真1枚で「終わりました」
  if (ev.type === "message" && "message" in ev && ev.message.type === "image") {
    const p = await r.findParticipantByLineUserId(lineUserId);
    let messages: LineMessage[];
    if (!p) messages = MSG.notRegistered();
    else {
      const content = await getMessageContent(ev.message.id);
      const mediaType = content && sniffImageType(content.bytes);
      messages =
        content && mediaType
          ? (await completeWithPhoto(p.id, { bytes: content.bytes, mediaType })).messages
          : MSG.photoNotCleared("写真を受け取れませんでした。");
    }
    if (ev.replyToken) await reply(ev.replyToken, messages);
    return;
  }

  // 道の報告を受け取るか（11/4 本人の指示。コンシェルジュが登録のあとに聞く・「道の通知」でいつでも）
  if (ev.type === "postback" && "postback" in ev && (ev.postback.data === "road:on" || ev.postback.data === "road:off")) {
    const p = await r.findParticipantByLineUserId(lineUserId);
    let messages: LineMessage[] = MSG.notRegistered();
    if (p) {
      await setAlertPref(p.id, ev.postback.data === "road:on");
      messages = MSG.roadPref(ev.postback.data === "road:on");
    }
    if (ev.replyToken) await reply(ev.replyToken, messages);
    return;
  }
  if (ev.type === "message" && "message" in ev && ev.message.type === "text" && /^\s*道の?通知\s*$/.test(ev.message.text)) {
    const p = await r.findParticipantByLineUserId(lineUserId);
    if (ev.replyToken) await reply(ev.replyToken, p ? MSG.roadAsk() : MSG.notRegistered());
    return;
  }

  // コンシェルジュの「今朝の点呼に答える」（spec v1.7）
  if (ev.type === "postback" && "postback" in ev && ev.postback.data === "cc:rollcall") {
    if (ev.replyToken) await reply(ev.replyToken, await rollcallQuestion(lineUserId));
    return;
  }

  // 今朝の先生（spec v1.6）: 「教える」「また今度」
  if (ev.type === "postback" && "postback" in ev && ev.postback.data.startsWith("tip:")) {
    const messages = await tipStart(lineUserId, ev.postback.data);
    if (ev.replyToken) await reply(ev.replyToken, messages);
    return;
  }

  // ことばで答える・頼む（spec v1.6）: 登録の途中でなければ、点呼の時間のふつうの文を答えとして読む
  // （「教える」を押したあとの文は、先にコツとして受け取る）
  if (ev.type === "message" && "message" in ev && ev.message.type === "text" && parseText(ev.message.text).kind === "text" && !(await r.getSession(lineUserId))) {
    const tip = await tipReceive(lineUserId, ev.message.text);
    if (tip) {
      if (ev.replyToken) await reply(ev.replyToken, tip);
      return;
    }
    // AI参加コンシェルジュ（spec v1.7）: 会話の続き・相談らしい文は、点呼の答えより先にコンシェルジュへ
    const consult = CONSULT_WORDS.test(ev.message.text) || (await inConversation(lineUserId));
    if (consult) {
      const cc = await concierge(lineUserId, ev.message.text);
      if (cc) {
        if (ev.replyToken) await reply(ev.replyToken, cc);
        return;
      }
    }
    const messages = await answerByWords(lineUserId, ev.message.text);
    if (messages) {
      if (ev.replyToken) await reply(ev.replyToken, messages);
      await planIfDue();
      await escalateHelpIfDue();
      return;
    }
    // 点呼の時間でなければ、登録した人の自由な文はコンシェルジュへ（「下のボタンから」で止めない）
    const cc = await concierge(lineUserId, ev.message.text);
    if (cc) {
      if (ev.replyToken) await reply(ev.replyToken, cc);
      return;
    }
  }

  let input = toInput(ev);
  if (!input) return;
  if (input.kind === "code" && !(await r.findFamilyLinkByCode(input.code))) {
    if (ev.replyToken) await reply(ev.replyToken, MSG.codeNotFound());
    return;
  }
  if (input.kind === "text") input = { kind: "text", text: input.text };

  const out = step(await r.getSession(lineUserId), input);
  const messages = [...out.messages];
  if (out.done) messages.push(...(await finishRegistration(lineUserId, out.done)));
  if (out.link) messages.push(...(await applyLink(lineUserId, out.link.code, out.link.who)));
  await r.setSession(lineUserId, out.session);
  if (ev.replyToken && messages.length > 0) await reply(ev.replyToken, messages);
  // 登録を終えた本人に、コンシェルジュが「近くの道の報告を受け取るか」を聞く（返信は5通までなので別に送る）
  if (out.done && !(out.done.role === "requester" && out.done.proxy)) await push(lineUserId, MSG.roadAsk());
}
