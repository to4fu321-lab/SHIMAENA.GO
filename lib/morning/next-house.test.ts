import { describe, expect, it } from "vitest";
import { nextHouseOf, type ShortHouse } from "./watch";

const h = (n: number, missing: number, distanceM?: number): ShortHouse => ({ missionId: `m${n}`, baseNumber: n, missing, required: 3, going: 3 - missing, tasks: [], importance: 1, distanceM });

describe("次の1軒（spec v1.56）", () => {
  it("人手が足りない家のうち、いちばん近い家", () => {
    expect(nextHouseOf([h(1, 1, 400), h(2, 2, 150), h(3, 1, 300)])?.baseNumber).toBe(2);
  });
  it("同じ距離なら、足りない人数が多い（まだ終わらなそうな）家", () => {
    expect(nextHouseOf([h(1, 1, 200), h(2, 2, 200)])?.baseNumber).toBe(2);
  });
  it("距離が分からないときは、足りない人数が多い家。家がなければなし", () => {
    expect(nextHouseOf([h(1, 1), h(2, 2)])?.baseNumber).toBe(2);
    expect(nextHouseOf([])).toBeUndefined();
  });
});
