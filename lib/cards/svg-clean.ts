// Claude が自由に描いた SVG を、カードに入れてよい形だけに作り直す（spec v1.24）。
// 決まった要素と属性だけを、値を確かめてから組み立て直す（元の文字列はそのまま使わない）。
// 文字（text）・スクリプト・外の画像・リンク・style 属性・イベント属性は入りようがない。id は他の部品とぶつからないよう頭に印を付ける。

const TAGS = new Set([
  "g", "path", "circle", "ellipse", "rect", "polygon", "polyline", "line", "defs", "use",
  "linearGradient", "radialGradient", "stop", "clipPath", "mask",
  "filter", "feGaussianBlur", "feOffset", "feBlend", "feMerge", "feMergeNode", "feColorMatrix", "feFlood", "feComposite", "feDropShadow",
]);

const NUM = /^-?(\d+\.?\d*|\.\d+)(e-?\d+)?(%|px)?$/i;
const NUMS = /^[-\d.eE,\s%]+$/;
const PATH = /^[MmLlHhVvCcSsQqTtAaZz\d.,\seE+-]+$/;
const WORD = /^[A-Za-z][\w-]{0,30}$/;
const ID = /^[A-Za-z][\w-]{0,40}$/;
const COLOR = /^(#[0-9a-fA-F]{3,8}|rgba?\(\s*[\d.%]+\s*,\s*[\d.%]+\s*,\s*[\d.%]+\s*(,\s*[\d.]+\s*)?\)|[a-zA-Z]{3,20})$/;
const TRANSFORM = /^\s*((matrix|translate|scale|rotate|skewX|skewY)\s*\([-\d.,\seE+]*\)[\s,]*)+$/;
const URL_REF = /^url\(\s*#([A-Za-z][\w-]{0,40})\s*\)$/;

type Check = (v: string) => string | undefined;

const num: Check = (v) => (NUM.test(v) ? v : undefined);
const nums =
  (max: number): Check =>
  (v) =>
    v.length <= max && NUMS.test(v) ? v.replace(/\s+/g, " ") : undefined;
const word: Check = (v) => (WORD.test(v) ? v : undefined);
const transform: Check = (v) => (v.length <= 300 && TRANSFORM.test(v) ? v.replace(/\s+/g, " ") : undefined);

const ATTRS: Record<string, Check | "paint" | "ref" | "href" | "id"> = {
  id: "id",
  x: num, y: num, width: num, height: num, cx: num, cy: num, r: num, rx: num, ry: num,
  x1: num, y1: num, x2: num, y2: num, fx: num, fy: num, fr: num, offset: num, dx: num, dy: num,
  opacity: num, "fill-opacity": num, "stroke-opacity": num, "stop-opacity": num, "flood-opacity": num,
  "stroke-width": num, "stroke-miterlimit": num, "stroke-dashoffset": num, k1: num, k2: num, k3: num, k4: num,
  points: nums(6000), "stroke-dasharray": nums(200), values: nums(400), stdDeviation: nums(40),
  d: (v) => (v.length <= 12000 && PATH.test(v) ? v.replace(/\s+/g, " ") : undefined),
  fill: "paint", stroke: "paint", "stop-color": "paint", "flood-color": "paint",
  transform, gradientTransform: transform,
  "stroke-linecap": word, "stroke-linejoin": word, "fill-rule": word, "clip-rule": word, gradientUnits: word, spreadMethod: word,
  clipPathUnits: word, maskUnits: word, maskContentUnits: word, filterUnits: word, primitiveUnits: word, "color-interpolation-filters": word,
  mode: word, type: word, operator: word, in: word, in2: word, result: word,
  "clip-path": "ref", mask: "ref", filter: "ref",
  href: "href", "xlink:href": "href",
};

export interface CleanResult {
  svg: string;
  elements: number;
}

/**
 * 描かれた SVG を点検して組み立て直す。prefix は id の頭に付ける印。
 * 図形が少なすぎる・大きすぎるときは undefined（使わない）
 */
export function cleanSvg(raw: string, prefix: string, opts: { minShapes?: number; maxBytes?: number } = {}): CleanResult | undefined {
  const src = raw
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "")
    .replace(/<\?[\s\S]*?\?>/g, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "");
  const pre = prefix.replace(/[^A-Za-z0-9]/g, "");
  const ids = new Set<string>();
  for (const m of src.matchAll(/\bid\s*=\s*["']([A-Za-z][\w-]{0,40})["']/g)) ids.add(m[1]);
  const rid = (id: string) => (ids.has(id) ? `${pre}-${id}` : undefined);

  const out: string[] = [];
  const stack: string[] = [];
  let elements = 0;
  let shapes = 0;
  const tagRe = /<\s*(\/)?\s*([A-Za-z][\w:.-]*)((?:\s+[^\s=>/]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/)?\s*>/g;
  for (const m of src.matchAll(tagRe)) {
    const [, closing, tag, attrText, selfClose] = m;
    if (!TAGS.has(tag)) continue;
    if (closing) {
      const at = stack.lastIndexOf(tag);
      if (at < 0) continue;
      while (stack.length > at) out.push(`</${stack.pop()}>`);
      continue;
    }
    if (++elements > 4000) break;
    if (!["g", "defs", "linearGradient", "radialGradient", "stop", "clipPath", "mask", "filter"].includes(tag) && !tag.startsWith("fe")) shapes++;
    const attrs: string[] = [];
    for (const a of attrText.matchAll(/([^\s=>/]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      const name = a[1];
      const value = (a[2] ?? a[3] ?? "").trim();
      const rule = ATTRS[name];
      if (!rule || !value) continue;
      let ok: string | undefined;
      if (rule === "id") ok = ID.test(value) ? `${pre}-${value}` : undefined;
      else if (rule === "paint") {
        const ref = URL_REF.exec(value);
        ok = ref ? (rid(ref[1]) ? `url(#${rid(ref[1])})` : undefined) : COLOR.test(value) ? value : undefined;
      } else if (rule === "ref") {
        const ref = URL_REF.exec(value);
        ok = ref && rid(ref[1]) ? `url(#${rid(ref[1])})` : undefined;
      } else if (rule === "href") {
        const id = /^#([A-Za-z][\w-]{0,40})$/.exec(value)?.[1];
        ok = id && rid(id) ? `#${rid(id)}` : undefined;
      } else ok = rule(value);
      if (ok !== undefined) attrs.push(`${name === "xlink:href" ? "href" : name}="${ok}"`);
    }
    const open = `<${tag}${attrs.length ? " " + attrs.join(" ") : ""}`;
    if (selfClose) out.push(`${open}/>`);
    else {
      out.push(`${open}>`);
      stack.push(tag);
    }
  }
  while (stack.length) out.push(`</${stack.pop()}>`);
  const svg = out.join("");
  if (shapes < (opts.minShapes ?? 20)) return undefined;
  if (svg.length > (opts.maxBytes ?? 200_000)) return undefined;
  return { svg, elements };
}
