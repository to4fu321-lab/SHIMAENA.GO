import { describe, expect, it } from "vitest";
import { makeNameMasker } from "./admin-names";
import type { Participant } from "./types";

const p = (id: string, nickname: string, role: Participant["role"] = "helper"): Participant => ({ id, nickname, role, location: [43, 141] });

describe("/admin の名前", () => {
  it("架空の人はそのまま、本物の人は仮名", () => {
    const m = makeNameMasker([p("h1", "ゆき"), p("p-abc", "山田花子"), p("p-def", "佐藤", "requester")]);
    expect(m.label("h1")).toBe("ゆき");
    expect(m.label("p-abc")).toBe("手伝う人1");
    expect(m.label("p-def")).toBe("お願いする人2");
    expect(m.label("zzz")).toBe("（不明な人）");
  });
  it("記録の文から本物の名前を消す（長い名前から）", () => {
    const m = makeNameMasker([p("p-a", "山田"), p("p-b", "山田花子")]);
    expect(m.mask("山田花子さんが点呼に回答。山田さんも")).toBe("手伝う人2さんが点呼に回答。手伝う人1さんも");
  });
});
