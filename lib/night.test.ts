// 夜の防犯ルール（spec v1.8）: 夜（18時〜6時）は自分の家と家の中でできることだけ。よその家には行かない
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildOptions, type ConciergeContext } from "./concierge/options";
import { DEMO_DATE } from "./morning/flow";
import { announce, joinMission, joinNearby, offerTaskNow, plan, ring, setGoing } from "./morning/ops";
import { loadMorning } from "./morning/store";
import { allowedAtNight, isNight, NIGHT_FROM, NIGHT_UNTIL } from "./night";
import { completeSolo } from "./solo/ops";
import { textOf } from "./line/flex";
import type { LineMessage } from "./line/types";

const at = (hm: string) => new Date(`2026-12-14T${hm}:00+09:00`);
const t = (ms: LineMessage[]) => ms.map(textOf).join("\n");

describe("夜の判定", () => {
  it(`${NIGHT_FROM}時から翌${NIGHT_UNTIL}時までが夜`, () => {
    expect(isNight(at("17:59"))).toBe(false);
    expect(isNight(at("18:00"))).toBe(true);
    expect(isNight(at("23:30"))).toBe(true);
    expect(isNight(at("05:59"))).toBe(true);
    expect(isNight(at("06:00"))).toBe(false);
    expect(isNight(at("10:00"))).toBe(false);
  });
  it("夜にしてよいのは、自分の家と家の中でできることだけ", () => {
    expect(allowedAtNight("own_house", true)).toBe(true);
    expect(allowedAtNight("check_area", false)).toBe(true);
    expect(allowedAtNight("patrol", true)).toBe(false);
    expect(allowedAtNight("report_snow", true)).toBe(false);
  });
});

describe("夜はよその家に行かない（入口ぜんぶ）", () => {
  beforeEach(() => {
    for (const k of ["__shimaenaRepo", "__shimaenaMorning", "__shimaenaArchive", "__shimaenaSoloScores"]) delete (globalThis as Record<string, unknown>)[k];
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it("ソロ: 夜の見回りは断り、自分の家の雪かきとアプリでの参加はできる", async () => {
    await announce({ date: DEMO_DATE, forecastCm: 12 });
    const night = at("21:00");
    expect(await completeSolo("h3", "patrol", { now: night })).toMatchObject({ ok: false, reason: "night" });
    expect((await completeSolo("h3", "own_house", { now: night })).ok).toBe(true);
    expect((await completeSolo("h3", "check_area", { now: night })).ok).toBe(true);
    expect((await completeSolo("h3", "patrol", { now: at("10:00") })).ok).toBe(true);
  });

  it("家の手伝い: 夜は「行く」「助けに行く」「10分だけ参加」「出動する」を断り、自分の家へ案内する", async () => {
    await announce({ date: DEMO_DATE, forecastCm: 12 });
    await ring();
    await plan();
    const s = await loadMorning();
    const m = s.morning.missions[0];
    const night = at("20:00");
    expect(t(await setGoing("h1", true, night))).toContain("自分の家の雪かきだけ");
    expect(t(await joinMission("h1", m.id, night))).toContain("防犯");
    expect((await joinNearby("h1", 10, night)).joined).toBe(false);
    expect(t(await offerTaskNow("h1", 10, night))).toContain("自分の家の雪かきだけ");
    expect((await loadMorning()).morning.sorties.length).toBe(s.morning.sorties.length); // 何も増えない
  });

  it("コンシェルジュ: 夜はよその家・見回り・人手不足の家をすすめない", () => {
    const ctx: ConciergeContext = {
      role: "helper", hasTeam: true, rollcall: "planned", answered: true, going: true, shortHouses: 2,
      soloDoneToday: [], safety: false, firstTime: false, tipOk: false, night: true,
    };
    const ids = buildOptions(ctx).map((o) => o.id);
    expect(ids).toEqual(["own_house", "online", "cheer"]);
    expect(buildOptions({ ...ctx, night: false }).map((o) => o.id)).toContain("my_mission");
  });
});
