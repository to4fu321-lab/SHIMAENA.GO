// 今朝の雪の歌（spec v1.28）の音符データ。/api/song（今日）・/api/song?date=YYYY-MM-DD（今日と過去 7 日だけ）。まだなければ作る（Claude なら少し待つ）。
import { songDate, songDateAllowed, warmSnowSong } from "@/lib/song/day";

export const maxDuration = 120;

export async function GET(req: Request): Promise<Response> {
  const d = new URL(req.url).searchParams.get("date");
  const today = await songDate();
  // どんな日付でも Claude に新しく作曲させられると、お金の守りにならない（11/6 外部レビュー）
  if (d && !songDateAllowed(d, today)) {
    return Response.json({ error: "歌があるのは今日と過去7日だけです。" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const song = await warmSnowSong(d ?? today);
  return Response.json(song, { headers: { "Cache-Control": "no-store" } });
}
