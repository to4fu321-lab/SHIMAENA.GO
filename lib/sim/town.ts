// テストモードの町: 手伝う人 20 人（AI 参加者）と、雪かきを頼む家 10 軒。人物はすべて架空。
// ID は架空の人の形（h101〜・r101〜）にして、隊長トーク（demo:<ID>）に文面が届くようにする。
import { TOWN } from "../town";
import type { Base, ClearArea, HelpStyle, Participant, TeamId } from "../types";

/** AI 参加者の性格。点呼の答え・「行く」・写真の撮り方を、この性格で決める */
export type Persona = "early" | "steady" | "busy" | "rescuer" | "photoShy" | "late";

export const PERSONA_LABEL: Record<Persona, string> = {
  early: "早起き（60分動ける）",
  steady: "いつもの人（30分）",
  busy: "急用が入る（行けない）",
  rescuer: "駆けつけ役（足りない家へ）",
  photoShy: "写真が苦手（報告で完了）",
  late: "お昼から（朝は休み）",
};

export interface SimHelper extends Participant {
  persona: Persona;
}

const TEAMS: TeamId[] = ["salvia", "marigold", "lupinus"];

// 20 人の性格の並び（busy 2・rescuer 3・photoShy 2・late 1）
const PERSONAS: Persona[] = [
  "early", "steady", "steady", "busy", "rescuer", "steady", "early", "photoShy", "steady", "rescuer",
  "steady", "early", "late", "steady", "busy", "steady", "rescuer", "photoShy", "steady", "early",
];

const HELPER_NAMES = [
  "ゆきだるま", "しろくま", "こなゆき", "つらら", "ほたて", "すずらん", "たんちょう", "えぞりす", "はまなす", "ななかまど",
  "らべんだー", "とうきび", "じゃがいも", "ふきのとう", "しまふくろう", "きつね", "おこじょ", "ひぐま", "かもめ", "さけ",
];

const REQ: { name: string; level: 1 | 2 | 3; area: ClearArea; style: HelpStyle }[] = [
  { name: "白樺さん", level: 3, area: "road", style: "omakase" },
  { name: "雪野さん", level: 2, area: "entrance", style: "omakase" },
  { name: "氷見さん", level: 2, area: "garage", style: "together" },
  { name: "冬木さん", level: 1, area: "entrance", style: "omakase" },
  { name: "春待さん", level: 3, area: "entrance", style: "omakase" },
  { name: "北原さん", level: 2, area: "road", style: "together" },
  { name: "松葉さん", level: 1, area: "entrance", style: "omakase" },
  { name: "灯台さん", level: 2, area: "entrance", style: "omakase" },
  { name: "霧島さん", level: 3, area: "garage", style: "together" },
  { name: "鈴蘭さん", level: 1, area: "entrance", style: "omakase" },
];

/** 中心から角度・距離（m）で位置を決める（決まった並び。毎回同じ町になる） */
function spot(i: number, n: number, radiusM: number): [number, number] {
  const [lat, lng] = TOWN.center;
  const a = (i / n) * Math.PI * 2 + 0.3;
  const dLat = (radiusM * Math.cos(a)) / 111_000;
  const dLng = (radiusM * Math.sin(a)) / (111_000 * Math.cos((lat * Math.PI) / 180));
  return [Number((lat + dLat).toFixed(6)), Number((lng + dLng).toFixed(6))];
}

export function simHelpers(): SimHelper[] {
  return PERSONAS.map((persona, i) => ({
    id: `h${101 + i}`,
    nickname: `${HELPER_NAMES[i]}さん`,
    role: "helper",
    location: spot(i, 20, 120 + (i % 4) * 60),
    teamId: TEAMS[i % 3],
    morningMinutes: persona === "early" ? 60 : 30,
    hasTools: i % 3 !== 2,
    persona,
  }));
}

export function simRequesters(): Participant[] {
  return REQ.map((r, i) => ({
    id: `r${101 + i}`,
    nickname: r.name,
    role: "requester",
    location: spot(i, 10, 150 + (i % 3) * 70),
    soloMinutes: r.level === 3 ? 60 : 30,
    clearArea: r.area,
    level: r.level,
    helpStyle: r.style,
  }));
}

export function simBases(requesters: Participant[]): Base[] {
  return requesters.map((r, i) => ({ id: `base${101 + i}`, number: i + 1, requesterId: r.id }));
}
