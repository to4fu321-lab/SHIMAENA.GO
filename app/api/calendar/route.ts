// 📅 予定に入れる（spec v1.41 ①）: その日の帯の予定を .ics で返す。iPhone は開くと「カレンダーに追加」が出る。
// 中身は日付・帯・チーム名だけで決まる（家・人の名前・場所は入れない）。ログインは要らない。
import { buildIcs, slotEvent } from "@/lib/calendar/ics";
import { isSlot } from "@/lib/calendar/slots";
import { TEAMS } from "@/lib/teams";
import { TOWN } from "@/lib/town";
import { baseUrl } from "@/lib/url";

export function GET(req: Request): Response {
  const q = new URL(req.url).searchParams;
  const date = q.get("date") ?? "";
  const when = q.get("when") ?? "";
  const team = TEAMS.find((t) => t.id === q.get("team"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`)) || !isSlot(when)) {
    return new Response("日付か時間が読めませんでした。", { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  const ev = slotEvent({ date, when, teamName: team?.name, appUrl: `${baseUrl()}/team?tab=time`, area: TOWN.name.replace(/（架空）$/, "") });
  return new Response(buildIcs(ev), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `inline; filename="shimaena-${date}-${when}.ics"`,
      "cache-control": "no-store",
    },
  });
}
