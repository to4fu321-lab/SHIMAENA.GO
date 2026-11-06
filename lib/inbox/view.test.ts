import { afterEach, describe, expect, it, vi } from "vitest";
import { MSG } from "../line/messages";
import { placeCard } from "../line/flex";
import type { InboxItem } from "./store";
import { toBubble, toBubbles, toHref } from "./view";

const item = (body: InboxItem["body"], dir: InboxItem["dir"] = "out", id = "x"): InboxItem => ({ id, key: "k", dir, body, at: "2026-12-01T00:00:00Z" });

afterEach(() => vi.unstubAllEnvs());

describe("隊長トークの表示", () => {
  it("画面の URL はアプリの中の道に直し、デモの ?as= を引き継ぐ。外のサイトはそのまま", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://example.test");
    expect(toHref("https://example.test/map", "h3")).toEqual({ href: "/map?as=h3", external: false });
    expect(toHref("https://example.test/solo?pick=10&focus=own_house")).toEqual({ href: "/solo?pick=10&focus=own_house", external: false });
    expect(toHref("https://www.google.com/maps/dir/?api=1", "h3")).toEqual({ href: "https://www.google.com/maps/dir/?api=1", external: true });
  });

  it("文の吹き出し: 小さなボタンは postback・画面・文・写真に直す。位置情報は出さない", () => {
    const [b] = toBubbles([item(MSG.photoNotCleared("まだ雪が残っています。")[0])]);
    expect(b.from).toBe("captain");
    expect(b.text).toContain("まだ雪が残っています");
    const q = toBubbles([item(MSG.photoNotCleared("x").at(-1)!)])[0].quick;
    expect(q.map((x) => x.kind)).toEqual(["postback", "photo", "photo"]);
    expect(q[1]).toMatchObject({ kind: "photo", capture: true });
    const loc = toBubble(item(MSG.locationSelf().at(-1)!));
    expect(loc.quick).toEqual([]);
  });

  it("大きなボタンの吹き出し（Flex）: 質問が文、ボタンは色つき。行き先カードは絵と「地図で見る」", () => {
    const ask = toBubble(item(MSG.rollcallRequester(12, "わた雪").at(-1)!));
    expect(ask.lines?.some((l) => l.text.includes("玄関"))).toBe(true);
    expect(ask.buttons.length).toBeGreaterThanOrEqual(3);
    expect(ask.buttons.every((x) => x.kind === "postback")).toBe(true);
    expect(ask.buttons.some((x) => x.tone === "soft")).toBe(true);

    const place = toBubble(item(placeCard({ time: "7:00", baseNumber: 3, note: "10分でも助かります", mapUrl: "http://localhost:3000/map", routeUrl: "https://www.google.com/maps/dir/?api=1" })));
    expect(place.image).toContain("/api/line/hero/go.png");
    expect(place.lines?.[0]).toMatchObject({ strong: true });
    expect(place.buttons.map((x) => x.kind)).toEqual(["link", "link"]);
    expect(place.buttons[1]).toMatchObject({ kind: "link", external: true });
  });

  it("画像は画像、本人の文と写真は右側。小さなボタンは最新の隊長の吹き出しにだけ残る", () => {
    const list = toBubbles([
      item(MSG.photoNotCleared("a").at(-1)!, "out", "1"),
      item({ type: "image", originalContentUrl: "http://localhost:3000/api/cards/c1/front.png", previewImageUrl: "x" }, "out", "2"),
      item({ text: "ありがとう" }, "in", "3"),
      item({ photo: true }, "in", "4"),
      item(MSG.photoNotCleared("b").at(-1)!, "out", "5"),
    ]);
    expect(list[0].quick).toEqual([]);
    expect(list[1].image).toBe("/api/cards/c1/front.png");
    expect(list[2]).toMatchObject({ from: "me", text: "ありがとう" });
    expect(list[3]).toMatchObject({ from: "me", photo: true });
    expect(list[4].quick.length).toBeGreaterThan(0);
  });
});
