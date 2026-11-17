// 頼む家の住所と、ほかに雪かきが要る所（spec v1.72）
import { describe, expect, it } from "vitest";
import { decompose } from "./game/mission";
import { cleanAddress, cleanNote, cleanParts, geocodeAddress } from "./house";
import { destinationsFor } from "./nav";
import { requestDay } from "./morning/flow";
import type { Participant } from "./types";

describe("住所・目印・ほかに要る所をきれいにする", () => {
  it("空白・改行を整え、長すぎれば切る。空なら undefined", () => {
    expect(cleanAddress("  札幌市中央区\n南1条西2丁目  ")).toBe("札幌市中央区 南1条西2丁目");
    expect(cleanAddress("   ")).toBeUndefined();
    expect(cleanAddress(123)).toBeUndefined();
    expect(cleanNote("あ".repeat(80))).toHaveLength(60);
  });

  it("知らない所は捨て、並びは一定", () => {
    expect(cleanParts(["back", "roof", "nope"])).toEqual(["roof", "back"]);
    expect(cleanParts("window,tank")).toEqual(["window", "tank"]);
    expect(cleanParts(undefined)).toEqual([]);
  });
});

describe("住所から地図の位置（国土地理院）", () => {
  const answer = (body: unknown) => (async () => new Response(JSON.stringify(body))) as unknown as typeof fetch;

  it("答えの [経度, 緯度] を [緯度, 経度] にする", async () => {
    const g = await geocodeAddress("札幌市中央区南1条西2丁目", answer([{ geometry: { coordinates: [141.354, 43.058] }, properties: { title: "札幌市中央区南一条西二丁目" } }]));
    expect(g).toEqual({ location: [43.058, 141.354], title: "札幌市中央区南一条西二丁目" });
  });

  it("北海道から遠い答え・空の答え・通信の失敗は使わない（地図で合わせてもらう）", async () => {
    expect(await geocodeAddress("中央区", answer([{ geometry: { coordinates: [139.7, 35.6] } }]))).toBeUndefined();
    expect(await geocodeAddress("どこか", answer([]))).toBeUndefined();
    expect(await geocodeAddress("どこか", (async () => { throw new Error("down"); }) as unknown as typeof fetch)).toBeUndefined();
  });
});

describe("雪かきの小さな作業", () => {
  it("ほかに要る所は、1か所10分の作業になる", () => {
    const t = decompose("entrance", 1, ["roof", "trash"]);
    expect(t.filter((x) => x.kind === "part").map((x) => [x.label, x.minutes])).toEqual([
      ["屋根から落ちた雪の山", 10],
      ["ゴミ置き場までの道", 10],
    ]);
    expect(decompose("entrance", 1).some((x) => x.kind === "part")).toBe(false);
  });
});

describe("住所を見せる相手", () => {
  const home: Participant = { id: "p-home", nickname: "家", role: "requester", location: [43.04, 141.37], lineUserId: "U-h", address: "しらかば町1-2-3", houseNote: "青い屋根", clearParts: ["window"] };
  const goer: Participant = { id: "p-go", nickname: "行く人", role: "helper", location: [43.041, 141.371], lineUserId: "U-g" };
  const other: Participant = { id: "p-x", nickname: "ほかの人", role: "helper", location: [43.041, 141.371], lineUserId: "U-x" };
  const roster = { participants: [home, goer, other], bases: [{ id: "base-h", number: 5, requesterId: "p-home" }] };
  const s = requestDay({ date: "2026-12-20" });
  s.morning.missions.push({ id: "m-h", rollcallId: "rc", baseId: "base-h", importance: 1, requiredPeople: 1, subtasks: [], status: "in_progress", startAt: "", reason: "" });
  s.morning.sorties.push({ id: "s1", missionId: "m-h", participantId: "p-go", teamId: "salvia", subtaskIds: [], status: "going", rescue: false });

  it("向かっている人にだけ、住所・目印・ほかに要る所", () => {
    expect(destinationsFor(s, roster, "p-go")[0]).toMatchObject({ address: "しらかば町1-2-3", note: "青い屋根", parts: ["窓の前"] });
    expect(destinationsFor(s, roster, "p-x")).toEqual([]);
  });
});
