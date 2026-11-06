// 今朝の雪の歌（spec v1.28）の音符データ。/api/song（今日）・/api/song?date=YYYY-MM-DD。まだなければ作る（Claude なら少し待つ）。
import { songDate, warmSnowSong } from "@/lib/song/day";

export const maxDuration = 120;

export async function GET(req: Request): Promise<Response> {
  const d = new URL(req.url).searchParams.get("date");
  const date = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : await songDate();
  const song = await warmSnowSong(date);
  return Response.json(song, { headers: { "Cache-Control": "no-store" } });
}
