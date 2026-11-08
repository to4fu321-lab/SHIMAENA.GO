import type { Participant } from "./types";
// 撮影ステージ（docs/video/stage.html）に並べる架空の人（11/7 撮影）。
// A と B は別のチームの手伝う人、C はお願いする家の人。C の家（拠点7）は A から約 255m・B から約 158m で、
// 最初の「助けて」（300m）が2人に届く（2チームの合流が自然に撮れる）。
// /admin のデモ操作（4 1軒完了・5 駆けつけ）は、この3人を勝手に動かさない（画面に別の家の完了が出ないように）。
export const STAGE_CAST = { a: "h1", b: "h11", c: "r7" } as const;
export const STAGE_IDS: ReadonlySet<string> = new Set(Object.values(STAGE_CAST));

// 発表モードで足す架空の手伝う人8人（11/8 本人「参加人数も20人にして」）。町の基本の12人と合わせて手伝う人20人。
// 町のデータ（data/town.json）は変えない（テストやシミュレーションの前提を崩さないため）。発表モードを押したときだけ名簿に入れる。
export const PRESENT_EXTRA: Participant[] = [
  { id: "h13", nickname: "さとう（会社員）", role: "helper", location: [43.0413, 141.3712], teamId: "salvia", morningMinutes: 30, hasTools: true },
  { id: "h14", nickname: "ゆい（高1）", role: "helper", location: [43.0389, 141.3681], teamId: "marigold", morningMinutes: 15, hasTools: true },
  { id: "h15", nickname: "おおた", role: "helper", location: [43.0412, 141.3735], teamId: "lupinus", morningMinutes: 30, hasTools: true },
  { id: "h16", nickname: "ハン（留学生）", role: "helper", location: [43.0386, 141.3728], teamId: "salvia", morningMinutes: 30, hasTools: false },
  { id: "h17", nickname: "なかむら（70代）", role: "helper", location: [43.0405, 141.3678], teamId: "marigold", morningMinutes: 15, hasTools: true },
  { id: "h18", nickname: "こうへい", role: "helper", location: [43.0418, 141.3693], teamId: "lupinus", morningMinutes: 60, hasTools: true },
  { id: "h19", nickname: "まい", role: "helper", location: [43.0395, 141.3742], teamId: "salvia", morningMinutes: 15, hasTools: false },
  { id: "h20", nickname: "いとう", role: "helper", location: [43.0381, 141.3699], teamId: "marigold", morningMinutes: 30, hasTools: true },
];

// 審査員がえらぶ架空の手伝う人10人（11/8 本人「人を10人から選べるように」）。
// 1人を全員で使うと記録が混ざるので、10人に分ける。撮影ステージの2人（h1・h11）は入れない（撮影で動くため）
export const JUDGE_CAST = ["h2", "h3", "h4", "h5", "h6", "h7", "h8", "h9", "h10", "h12"] as const;

/** えらんだ人で開く道（?as= を付ける）。next はアプリの中の道だけ */
export function demoHref(next: string, as: string): string {
  const path = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return `${path}${path.includes("?") ? "&" : "?"}as=${as}`;
}
