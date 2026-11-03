// 道順: 割り当てられた家の正確な場所は、その人にだけ渡す（spec 6）。地図アプリ（徒歩）で開く URL を作る。
import type { MorningRecord } from "./morning/flow";
import type { Roster } from "./morning/roster";
import type { LatLng } from "./types";

/** Google マップの徒歩の道順（iPhone でも Android でも開ける） */
export function mapsUrl(to: LatLng, from?: LatLng): string {
  const u = new URL("https://www.google.com/maps/dir/");
  u.searchParams.set("api", "1");
  u.searchParams.set("destination", `${to[0].toFixed(6)},${to[1].toFixed(6)}`);
  if (from) u.searchParams.set("origin", `${from[0].toFixed(6)},${from[1].toFixed(6)}`);
  u.searchParams.set("travelmode", "walking");
  return u.toString();
}

export interface Destination {
  missionId: string;
  baseNumber: number | string;
  location: LatLng;
  mapsUrl: string;
}

/** その人がいま向かっている家（正確な場所つき）。向かっている本人以外には返さない */
export function destinationsFor(s: MorningRecord, roster: Roster, participantId: string): Destination[] {
  const me = roster.participants.find((p) => p.id === participantId);
  const out: Destination[] = [];
  for (const x of s.morning.sorties) {
    if (x.participantId !== participantId || x.status !== "going") continue;
    const m = s.morning.missions.find((mm) => mm.id === x.missionId);
    const base = m && roster.bases.find((b) => b.id === m.baseId);
    const requester = base && roster.participants.find((p) => p.id === base.requesterId);
    if (!base || !requester) continue;
    out.push({ missionId: x.missionId, baseNumber: base.number, location: requester.location, mapsUrl: mapsUrl(requester.location, me?.location) });
  }
  return out;
}
