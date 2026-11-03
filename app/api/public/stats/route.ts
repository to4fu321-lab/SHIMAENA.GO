// 公開の集計（spec v1.3）。LINE 登録前の人や SNS からも読める。数だけで、名前・家・マスの位置は入らない。
import { loadPublicStats } from "@/lib/public/load";

export async function GET(): Promise<Response> {
  const stats = await loadPublicStats();
  return Response.json(stats, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300" } });
}
