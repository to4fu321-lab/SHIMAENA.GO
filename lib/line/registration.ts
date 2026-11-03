// 登録の会話（spec 1）。役割 → 自宅の位置 → 2問。家族の代理登録もここ。
// 保存先や LINE に関係なく使えるよう、いまの途中経過と入力から「次の途中経過と返す文面」を決めるだけの関数にしている。
import type { ClearArea, LatLng, MorningMinutes, Role, SoloMinutes } from "../types";
import { MSG } from "./messages";
import type { LineMessage } from "./types";

export type RegStep = "role" | "location" | "q1" | "q2" | "linkWho";

/** 登録の途中経過（LINE のユーザーごとに1つ） */
export interface RegSession {
  step: RegStep;
  role?: Role;
  /** 家族が代わりに登録している（依頼者本人の LINE ではない） */
  proxy?: boolean;
  location?: LatLng;
  q1?: string;
  /** 連携コードを送ってきた人に「本人か家族か」を聞いている間だけ */
  linkCode?: string;
}

export type RegInput =
  | { kind: "follow" }
  | { kind: "restart" }
  | { kind: "postback"; data: string }
  | { kind: "location"; location: LatLng }
  | { kind: "code"; code: string } // 見つかった連携コード（見つかるかどうかは呼ぶ側が確かめる）
  | { kind: "text"; text: string };

export type Registration =
  | { role: "requester"; proxy: boolean; location: LatLng; soloMinutes: SoloMinutes; clearArea: ClearArea }
  | { role: "helper"; location: LatLng; morningMinutes: MorningMinutes; hasTools: boolean };

export interface RegOutcome {
  session: RegSession | null;
  messages: LineMessage[];
  /** 2問まで終わった（呼ぶ側がレベル判定・チーム配属・保存をして、最後の文面を足す） */
  done?: Registration;
  /** 連携コードの紐づけが決まった */
  link?: { code: string; who: "self" | "family" };
}

/** 入力の文字を読む。「登録」などはやり直し、6桁は連携コード */
export function parseText(text: string): { kind: "restart" } | { kind: "code"; code: string } | { kind: "text"; text: string } {
  const t = text.trim();
  if (/^(登録|やりなおし|やり直し|設定)$/.test(t)) return { kind: "restart" };
  const m = /^(?:連携\s*)?(\d{6})$/.exec(t);
  if (m) return { kind: "code", code: m[1] };
  return { kind: "text", text: t };
}

/** いまの段階の質問をもう一度出す */
function question(s: RegSession): LineMessage[] {
  switch (s.step) {
    case "role":
      return MSG.welcome();
    case "location":
      return s.proxy ? MSG.locationProxy() : MSG.locationSelf();
    case "q1":
      return s.role === "helper" ? MSG.helperQ1() : MSG.requesterQ1();
    case "q2":
      return s.role === "helper" ? MSG.helperQ2() : MSG.requesterQ2();
    case "linkWho":
      return MSG.linkWho();
  }
}

function parseData(data: string): { ns: string; key: string; value: string } | null {
  const m = /^([a-z]+):([a-z0-9]+)=([a-z0-9]+)$/i.exec(data);
  return m ? { ns: m[1], key: m[2], value: m[3] } : null;
}

const SOLO: Record<string, SoloMinutes> = { "15": 15, "30": 30, "60": 60, unknown: "unknown" };
const AREA: Record<string, ClearArea> = { entrance: "entrance", garage: "garage", road: "road" };
const MORNING: Record<string, MorningMinutes> = { "15": 15, "30": 30, "60": 60 };

export function step(session: RegSession | undefined, input: RegInput): RegOutcome {
  const s = session ?? null;

  if (input.kind === "follow" || input.kind === "restart") {
    const next: RegSession = { step: "role" };
    return { session: next, messages: question(next) };
  }

  if (input.kind === "code") {
    const next: RegSession = { step: "linkWho", linkCode: input.code };
    return { session: next, messages: question(next) };
  }

  if (!s) {
    // 登録の途中ではない。文字が来たら案内だけ返す
    return { session: null, messages: input.kind === "text" ? MSG.help() : [] };
  }

  if (input.kind === "location") {
    if (s.step !== "location") return { session: s, messages: question(s) };
    const next: RegSession = { ...s, step: "q1", location: input.location };
    return { session: next, messages: question(next) };
  }

  if (input.kind === "postback") {
    const d = parseData(input.data);
    if (!d) return { session: s, messages: question(s) };

    if (d.ns === "link" && d.key === "who" && s.step === "linkWho" && s.linkCode) {
      if (d.value === "self" || d.value === "family") {
        return { session: null, messages: [], link: { code: s.linkCode, who: d.value } };
      }
      return { session: s, messages: question(s) };
    }

    if (d.ns === "reg" && d.key === "role" && s.step === "role") {
      const next: RegSession =
        d.value === "family"
          ? { step: "location", role: "requester", proxy: true }
          : d.value === "requester" || d.value === "helper"
            ? { step: "location", role: d.value, proxy: false }
            : s;
      return { session: next, messages: question(next) };
    }

    if (d.ns === "reg" && d.key === "q1" && s.step === "q1") {
      const ok = s.role === "helper" ? d.value in MORNING : d.value in SOLO;
      if (!ok) return { session: s, messages: question(s) };
      const next: RegSession = { ...s, step: "q2", q1: d.value };
      return { session: next, messages: question(next) };
    }

    if (d.ns === "reg" && d.key === "q2" && s.step === "q2" && s.location && s.q1 !== undefined) {
      if (s.role === "helper") {
        if (d.value !== "yes" && d.value !== "no") return { session: s, messages: question(s) };
        return {
          session: null,
          messages: [],
          done: { role: "helper", location: s.location, morningMinutes: MORNING[s.q1], hasTools: d.value === "yes" },
        };
      }
      if (!(d.value in AREA)) return { session: s, messages: question(s) };
      return {
        session: null,
        messages: [],
        done: {
          role: "requester",
          proxy: Boolean(s.proxy),
          location: s.location,
          soloMinutes: SOLO[s.q1],
          clearArea: AREA[d.value],
        },
      };
    }

    // 段階に合わないボタン（古いメッセージのボタンなど）→ いまの質問をもう一度
    return { session: s, messages: question(s) };
  }

  // 途中で文字が来た → いまの質問をもう一度
  return { session: s, messages: question(s) };
}
