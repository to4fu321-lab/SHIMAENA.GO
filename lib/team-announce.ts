// チーム発表（派手め）。登録したときと、日曜の夜の組み直しのときに LINE で送る。
// 画像: /api/team/<id>.png?from=YYYY-MM-DD（チーム色の紙ふぶき・チーム色のマフラーのシマエナガ・期間）
import { mascotInner } from "./mascot-svg";
import { scarfOf, teamTerm, teamTheme, type TeamTerm } from "./team-theme";
import type { TeamId } from "./types";
import { baseUrl } from "./url";
import type { ImageMessage } from "./line/types";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** 紙ふぶき（決まった並び。毎回同じ絵になるように乱数は使わない） */
function confetti(colors: string[]): string {
  const out: string[] = [];
  for (let i = 0; i < 46; i++) {
    const x = (i * 211) % 1040;
    const y = (i * 137) % 1040;
    const rot = (i * 47) % 180;
    const c = colors[i % colors.length];
    out.push(
      i % 3 === 0
        ? `<circle cx="${x}" cy="${y}" r="${8 + (i % 4) * 2}" fill="${c}" opacity="0.9"/>`
        : `<rect x="${x}" y="${y}" width="${14 + (i % 3) * 4}" height="${26 + (i % 2) * 8}" rx="3" fill="${c}" opacity="0.9" transform="rotate(${rot} ${x} ${y})"/>`,
    );
  }
  return out.join("");
}

/** 正方形 1040×1040 の発表画像（LINE の画像メッセージ用） */
export function teamAnnounceSvg(id: TeamId, term: TeamTerm, kind: "first" | "weekly" = "weekly"): string {
  const t = teamTheme(id);
  const head = kind === "first" ? "あなたのチームが決まりました！" : "今週のチーム発表！";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1040 1040" width="1040" height="1040">
  <defs>
    <radialGradient id="g" cx="50%" cy="42%" r="70%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1040" height="1040" fill="${t.team.color}"/>
  <rect width="1040" height="1040" fill="url(#g)"/>
  ${confetti(["#ffffff", t.light, "#F3C48A", "#C8A7B8", t.shade])}
  <g font-family="Zen Maru Gothic" font-weight="700" text-anchor="middle">
    <rect x="170" y="70" width="700" height="96" rx="48" fill="#ffffff"/>
    <text x="520" y="136" font-size="50" fill="${t.deep}">${esc(head)}</text>
    <g transform="translate(330 190) scale(3.2)">${mascotInner("happy", scarfOf(id))}</g>
    <text x="520" y="690" font-size="58" fill="${t.onColor}">あなたは</text>
    <text x="520" y="810" font-size="${t.team.name.length > 5 ? 118 : 140}" fill="${t.onColor}" stroke="${t.shade}" stroke-width="3" paint-order="stroke">${esc(t.team.name)}</text>
    <text x="520" y="870" font-size="40" fill="${t.onColor}" letter-spacing="10">TEAM ${esc(t.team.nameEn)}</text>
    <rect x="150" y="910" width="740" height="84" rx="42" fill="#29445c"/>
    <text x="520" y="966" font-size="40" fill="#ffffff">${esc(term.label)} の1週間</text>
  </g>
</svg>`;
}

export function teamImageUrl(id: TeamId, term: TeamTerm, kind: "first" | "weekly"): string {
  return `${baseUrl()}/api/team/${id}.png?from=${term.from}&kind=${kind}`;
}

export function teamImageMessage(id: TeamId, term: TeamTerm, kind: "first" | "weekly"): ImageMessage {
  const url = teamImageUrl(id, term, kind);
  return { type: "image", originalContentUrl: url, previewImageUrl: `${url}&size=preview` };
}

/** 発表の文（1吹き出し）。例: 🎉 チーム発表 🎉 / 11/9（月）〜11/15（日）のあなたは / 💙 サルビア（青） 💙 */
export function teamAnnounceText(id: TeamId, term: TeamTerm, kind: "first" | "weekly"): string {
  const t = teamTheme(id);
  const e = t.emoji;
  const lead = kind === "first" ? "🎉 チームが決まりました 🎉" : "🎉 今週のチーム発表 🎉";
  return [
    lead,
    `${term.label}のあなたは…`,
    `${e}${e}「${t.team.name}」チーム（${t.team.colorName}）${e}${e}`,
    `地図のマスとシマエナガのマフラーが${t.team.colorName}になります。`,
    `チームは${term.until}。毎週日曜の夜に組み直します。`,
  ].join("\n");
}

export { teamTerm };
