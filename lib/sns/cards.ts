// SNS シェアカード（spec v1.3）。画像生成AIは使わず、図形から SVG で描く（PNG 化は lib/cards/png.ts）。
// 数字は集計（PublicStats）だけ。氏名・家・マスの位置は載せない。個人カード（me）だけ本人の呼び名を載せる。
import { escapeXml, kawaiiBird, wrap } from "../cards/svg";
import { QUIZ_TYPES, type QuizType } from "../public/quiz";
import type { PublicStats } from "../public/stats";
import { TEAMS } from "../teams";
import type { TeamId } from "../types";
import type { MeStats, ShareKind } from "./text";

export type ShareFormat = "square" | "story" | "og";
export const SHARE_SIZE: Record<ShareFormat, [number, number]> = { square: [1080, 1080], story: [1080, 1920], og: [1200, 630] };

export interface ShareCard {
  /** 上の小さな文字（町内名・日付） */
  eyebrow: string;
  headline: string;
  bigValue: string;
  bigUnit: string;
  bigLabel: string;
  /** 雪解けゲージ（0〜100） */
  gauge?: number;
  rows: { label: string; value: string }[];
  /** ひとこと（個人カード・診断） */
  quote?: string;
  /** 並べるシマエナガの耳あての色（最大5羽） */
  birds: (TeamId | undefined)[];
  /** 下に出す URL（表示用） */
  url: string;
  /** ストーリーズの下の誘い文 */
  tagline: string;
}

const JP = "Zen Maru Gothic, sans-serif";
const INK = "#29445c"; // 冬の深い青
const NEON = "#7d4f68"; // 雪椿（強調の文字）
const SUB = "#4a6076"; // 補足の文字
const ICE = "#8fb8c9"; // 氷の青（ゲージ）
const TEAM_ORDER: TeamId[] = ["salvia", "marigold", "lupinus"];

const md = (ymd: string) => {
  const [, m, d] = ymd.split("-").map(Number);
  return `${m}月${d}日`;
};

/** 来た人の数だけ並べる耳あての色（3チームを順番に、最大5羽） */
function birdsFor(n: number): TeamId[] {
  return Array.from({ length: Math.max(1, Math.min(5, n)) }, (_, i) => TEAM_ORDER[i % 3]);
}

export function shareCardData(kind: ShareKind, st: PublicStats, url: string, me?: MeStats & { nickname: string }): ShareCard {
  const eyebrow = `${st.townName} ・ ${md(kind === "me" || kind === "town" ? st.today : st.morningDate)}`;
  const base = { eyebrow, url, tagline: "あなたの5分で町が変わる" };
  switch (kind) {
    case "today":
      return {
        ...base,
        headline: "今日もシマエナGO 出動！",
        bigValue: String(st.todayPeople),
        bigUnit: "羽",
        bigLabel: "今日の出動",
        gauge: st.thawPct,
        rows: [
          { label: "ミッション達成", value: `${st.todayMissions}件` },
          { label: "雪解け", value: `${st.housesDone}/${st.housesTotal}軒` },
          { label: st.snowName ? "今朝の相手" : "予報", value: st.snowName ? `『${st.snowName}』` : `${st.forecastCm}cm` },
        ],
        birds: birdsFor(st.todayPeople),
      };
    case "town":
      return {
        ...base,
        headline: `${st.townName}の雪解け`,
        bigValue: String(st.thawPct),
        bigUnit: "%",
        bigLabel: "町の雪解け率",
        gauge: st.thawPct,
        rows: [
          { label: "助けた家（今週）", value: `${st.week.housesDone}軒` },
          { label: "今週の活動人数", value: `${st.week.people}人` },
          { label: "どけた雪", value: st.snowKg > 0 ? `${st.snowKgLabel}（${st.snowComparison}）` : "これから" },
        ],
        birds: birdsFor(st.week.people),
      };
    case "recruit": {
      const one = st.shortHouses > 0 && st.shortMissingMin === 1;
      return {
        ...base,
        headline: one ? "あと1人で雪解け！" : st.shortHouses > 0 ? "5分だけ参加しませんか？" : "今日の町を一緒に救おう",
        bigValue: String(st.shortHouses > 0 ? st.shortHouses : st.left),
        bigUnit: "軒",
        bigLabel: st.shortHouses > 0 ? "人手が足りない家" : "のこりの家",
        gauge: st.thawPct,
        rows: [
          { label: "5分の仕事", value: "見回り・砂まき・雪捨て" },
          { label: "今日の出動", value: `${st.todayPeople}人` },
          { label: "参加", value: "LINE で1分" },
        ],
        birds: [undefined, ...birdsFor(2)],
      };
    }
    case "me": {
      const m = me ?? { nickname: "わたし", todayFeathers: 0, streak: 0, todayActs: 0 };
      return {
        ...base,
        headline: `${m.nickname}の今日`,
        bigValue: String(m.todayFeathers),
        bigUnit: "羽",
        bigLabel: "今日の羽ポイント",
        rows: [
          { label: "今日の活動", value: `${m.todayActs}件` },
          { label: "連続出動", value: `${m.streak}日` },
          { label: "今日のシマエナ", value: m.shimaena ?? "これから" },
        ],
        quote: m.hitokoto,
        birds: [undefined],
        tagline: "小さな一歩で町が変わる",
      };
    }
  }
}

/** 診断結果のカード（町の数字は使わない） */
export function quizCardData(type: QuizType, url: string, townName: string): ShareCard {
  const q = QUIZ_TYPES[type];
  return {
    eyebrow: `${townName} ・ シマエナ診断`,
    headline: "あなたは…",
    bigValue: q.name,
    bigUnit: "",
    bigLabel: q.catchphrase,
    rows: [
      { label: "おすすめの5分", value: q.mission.replace(/（.*）$/, "") },
      { label: "参加", value: "LINE で1分" },
    ],
    birds: [q.ear, q.ear === "lupinus" ? "salvia" : "lupinus", "marigold"],
    url,
    tagline: "あなたも診断してみて",
  };
}

const t = (x: number, y: number, size: number, body: string, opts: { fill?: string; anchor?: "start" | "middle" | "end"; weight?: number; spacing?: number } = {}) =>
  `<text x="${x}" y="${y}" font-family="${JP}" font-size="${size}" font-weight="${opts.weight ?? 700}" fill="${opts.fill ?? INK}" text-anchor="${opts.anchor ?? "start"}"${opts.spacing ? ` letter-spacing="${opts.spacing}"` : ""}>${escapeXml(body)}</text>`;

function background(w: number, h: number): string {
  return `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f7fa"/><stop offset="1" stop-color="#e3eef3"/></linearGradient></defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <g opacity="0.7"><circle cx="${w - 90}" cy="40" r="14" fill="#ffffff"/><circle cx="26" cy="${h / 2}" r="10" fill="#ffffff"/><circle cx="${w - 40}" cy="${h - 300}" r="8" fill="#c8a7b8"/><circle cx="60" cy="90" r="6" fill="#ffffff"/><circle cx="${w / 2}" cy="${h - 140}" r="7" fill="#ffffff"/></g>`;
}

function logo(x: number, y: number, size: number): string {
  return `<text x="${x}" y="${y}" font-family="${JP}" font-size="${size}" font-weight="700" fill="${INK}">シマエナ<tspan fill="${NEON}">GO</tspan></text>`;
}

function birdRow(birds: (TeamId | undefined)[], cx: number, y: number, scale: number, gap: number): string {
  const n = birds.length;
  const x0 = cx - ((n - 1) * gap) / 2;
  const color = (id?: TeamId) => TEAMS.find((tm) => tm.id === id)?.color ?? "#c8a7b8";
  return birds.map((b, i) => kawaiiBird(x0 + i * gap, y + (i % 2) * 8, scale, color(b))).join("");
}

function gaugeBar(x: number, y: number, w: number, h: number, pct: number): string {
  const p = Math.max(0, Math.min(100, pct));
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="#ffffff" stroke="#c9d3dc" stroke-width="2"/>
  ${p > 0 ? `<rect x="${x}" y="${y}" width="${Math.max(h, (w * p) / 100)}" height="${h}" rx="${h / 2}" fill="${ICE}"/>` : ""}`;
}

/** 正方形とストーリーズ（縦長）。ストーリーズは上下に余白を足して、シマエナガの列と誘い文を大きく */
function portrait(c: ShareCard, w: number, h: number): string {
  const story = h > w * 1.2;
  let y = story ? 240 : 110;
  const out: string[] = [background(w, h)];
  out.push(logo(80, y, story ? 72 : 60));
  out.push(t(w - 80, y, story ? 32 : 28, c.eyebrow, { fill: SUB, anchor: "end", weight: 400 }));
  y += story ? 130 : 105;
  for (const line of wrap(c.headline, 13).slice(0, 2)) {
    out.push(t(80, y, story ? 76 : 64, line, { spacing: 2 }));
    y += story ? 92 : 80;
  }
  // 大きな数字の板（右にシマエナガ）
  const panelH = c.gauge !== undefined ? 330 : 280;
  y += 10;
  out.push(`<rect x="70" y="${y}" width="${w - 140}" height="${panelH}" rx="40" fill="#fff" stroke="#c9d3dc" stroke-width="3"/>`);
  const numSize = c.bigValue.length >= 5 ? 76 : c.bigValue.length >= 3 ? 140 : 170;
  out.push(
    `<text x="120" y="${y + 190}" font-family="${JP}" font-weight="700" fill="${NEON}"><tspan font-size="${numSize}">${escapeXml(c.bigValue)}</tspan><tspan font-size="60" fill="${INK}" dx="10">${escapeXml(c.bigUnit)}</tspan></text>`,
  );
  out.push(t(124, y + 250, 36, c.bigLabel, { fill: SUB }));
  out.push(birdRow(c.birds.slice(0, 3), w - 250, y + 130, 1.25, 105));
  if (c.gauge !== undefined) out.push(gaugeBar(120, y + 280, w - 240, 22, c.gauge));
  y += panelH + (story ? 90 : 70);
  // 表
  for (const r of c.rows) {
    out.push(t(90, y, story ? 40 : 36, r.label, { fill: SUB, weight: 400 }));
    out.push(t(w - 90, y, story ? 42 : 38, r.value, { anchor: "end" }));
    out.push(`<line x1="90" y1="${y + 22}" x2="${w - 90}" y2="${y + 22}" stroke="#e3eef3" stroke-width="2"/>`);
    y += story ? 92 : 72;
  }
  if (c.quote) {
    y += 10;
    for (const line of wrap(`「${c.quote}」`, 18).slice(0, 2)) {
      out.push(t(w / 2, y, story ? 40 : 34, line, { anchor: "middle", fill: "#29445c" }));
      y += story ? 56 : 46;
    }
  }
  if (story) {
    // 下: シマエナガの列と誘い文
    out.push(`<ellipse cx="${w / 2}" cy="${h - 360}" rx="420" ry="40" fill="#fff" opacity="0.7"/>`);
    out.push(birdRow(c.birds.length > 1 ? c.birds : [...c.birds, "salvia", "lupinus"], w / 2, h - 420, 1.7, 170));
    out.push(t(w / 2, h - 230, 54, c.tagline, { anchor: "middle", fill: NEON, spacing: 2 }));
  }
  out.push(t(w / 2, h - (story ? 120 : 46), story ? 32 : 28, `#シマエナGO ・ ${c.url}`, { anchor: "middle", fill: SUB, weight: 400 }));
  return out.join("\n");
}

/** OG（1200×630、X やリンクの見出し画像）: 左に文字、右にシマエナガ */
function landscape(c: ShareCard, w: number, h: number): string {
  const out: string[] = [background(w, h)];
  out.push(logo(64, 92, 52));
  out.push(t(64, 140, 26, c.eyebrow, { fill: SUB, weight: 400 }));
  let y = 230;
  for (const line of wrap(c.headline, 12).slice(0, 2)) {
    out.push(t(64, y, 58, line, { spacing: 2 }));
    y += 72;
  }
  out.push(
    `<text x="64" y="${h - 110}" font-family="${JP}" font-weight="700" fill="${NEON}"><tspan font-size="${c.bigValue.length >= 5 ? 64 : 130}">${escapeXml(c.bigValue)}</tspan><tspan font-size="48" fill="${INK}" dx="8">${escapeXml(c.bigUnit)}</tspan></text>`,
  );
  out.push(t(70, h - 60, 30, c.bigLabel, { fill: SUB }));
  out.push(`<circle cx="${w - 250}" cy="${h / 2 - 10}" r="200" fill="#fff" opacity="0.75"/>`);
  out.push(birdRow(c.birds.slice(0, 3), w - 250, h / 2 - 20, 1.3, 110));
  if (c.gauge !== undefined) out.push(gaugeBar(w - 430, h / 2 + 110, 360, 20, c.gauge));
  out.push(t(w - 64, h - 40, 24, `#シマエナGO ・ ${c.url}`, { anchor: "end", fill: SUB, weight: 400 }));
  return out.join("\n");
}

export function renderShareSvg(c: ShareCard, format: ShareFormat): string {
  const [w, h] = SHARE_SIZE[format];
  const body = format === "og" ? landscape(c, w, h) : portrait(c, w, h);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">\n${body}\n</svg>`;
}
