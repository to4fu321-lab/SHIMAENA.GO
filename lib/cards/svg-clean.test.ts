import { describe, expect, it } from "vitest";
import { cleanSvg } from "./svg-clean";
import { isPendingSvg, renderCardSvg, type CardArt } from "./svg";

const many = Array.from({ length: 25 }, (_, i) => `<circle cx="${i * 10}" cy="20" r="4" fill="#ffffff"/>`).join("");

describe("Claude の絵の点検（v1.24）", () => {
  it("決まった要素と属性だけ残し、危ないものは消す", () => {
    const raw = `<svg viewBox="0 0 540 560" onload="alert(1)"><script>alert(1)</script>
      <defs><linearGradient id="sky"><stop offset="0" stop-color="#ffb3d9"/></linearGradient></defs>
      <rect width="540" height="560" fill="url(#sky)" style="fill:red" onclick="x()"/>
      <text x="1" y="2">山田さん</text><image href="https://evil.example/x.png"/>
      <foreignObject><div>hi</div></foreignObject>
      <use href="https://evil.example/a.svg#x"/><use href="#sky"/>
      <path d="M0 0 L10 10 Z" fill="javascript:alert(1)" transform="translate(5 5) rotate(10)"/>
      ${many}</svg>`;
    const r = cleanSvg(raw, "a1b2")!;
    expect(r.svg).not.toMatch(/script|onload|onclick|style=|<text|山田|<image|evil|foreignObject|<div|javascript/);
    expect(r.svg).toContain('id="a1b2-sky"');
    expect(r.svg).toContain('fill="url(#a1b2-sky)"');
    expect(r.svg).toContain('<use href="#a1b2-sky"/>');
    expect(r.svg).toContain('transform="translate(5 5) rotate(10)"');
    expect(r.svg).toContain('<path d="M0 0 L10 10 Z" transform');
    expect(r.svg).not.toContain("<svg");
  });

  it("閉じ忘れは閉じ、知らない id への参照は消す", () => {
    const r = cleanSvg(`<g><g fill="url(#nope)" clip-path="url(#nope)">${many}`, "p")!;
    expect(r.svg.match(/<g/g)?.length).toBe(r.svg.match(/<\/g>/g)?.length);
    expect(r.svg).not.toContain("nope");
  });

  it("図形が少なすぎる絵は使わない", () => {
    expect(cleanSvg(`<circle r="3"/>`, "p")).toBeUndefined();
  });
});

describe("カードの表（v1.24）", () => {
  const art: CardArt = { style: "kawaii", designName: "t", designNameEn: "t", rarityLabel: "朝の群れ", stars: 1, members: [{ name: "a", teamId: "salvia" }], date: "2026-12-14", townName: "町", snowKg: 1, snowKgComparison: "x", serial: 1, issuedCount: 1 };
  it("描いている間は帯つき、描き上がったら Claude の絵で枠の中をおおう", () => {
    expect(isPendingSvg(renderCardSvg({ ...art, pending: true }))).toBe(true);
    const done = renderCardSvg({ ...art, picture: '<rect width="540" height="560" fill="#123456"/>' });
    expect(isPendingSvg(done)).toBe(false);
    expect(done).toContain('data-art="drawn"');
    expect(done.indexOf('data-art="drawn"')).toBeLessThan(done.indexOf("<!--stamp-->")); // 消印は絵の上
  });
});
