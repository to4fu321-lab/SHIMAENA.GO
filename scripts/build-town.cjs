// 使い方: node scripts/build-town.cjs <Overpass の JSON>
// OpenStreetMap の建物の形から、デモ用の架空町内 data/town.json を作る。
// 実在の住所・建物名・公園名は書き出さない。拠点に割り当てる人物はすべて架空。
// 地図データ © OpenStreetMap contributors (ODbL)
const fs = require("fs");

const CENTER = [43.04, 141.37];
const RADIUS_M = 320;
const src = process.argv[2];
if (!src) throw new Error("Overpass の JSON ファイルを指定してください");
const osm = JSON.parse(fs.readFileSync(src, "utf8"));

// 決まった順番で選ぶための乱数（毎回同じ結果になる）
let seed = 20261102;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

const M_PER_LAT = 111320;
const M_PER_LNG = 111320 * Math.cos((CENTER[0] * Math.PI) / 180);
const r6 = (n) => Math.round(n * 1e6) / 1e6;
const toXY = ([lat, lng]) => [(lng - CENTER[1]) * M_PER_LNG, (lat - CENTER[0]) * M_PER_LAT];
function area(poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = toXY(poly[i]);
    const [x2, y2] = toXY(poly[(i + 1) % poly.length]);
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}
const centroid = (poly) => [poly.reduce((a, p) => a + p[0], 0) / poly.length, poly.reduce((a, p) => a + p[1], 0) / poly.length];
const dist = (a, b) => Math.hypot(...toXY(a).map((v, i) => v - toXY(b)[i]));

const buildings = [];
const parks = [];
for (const el of osm.elements) {
  if (el.type !== "way" || !el.geometry) continue;
  const poly = el.geometry.map((g) => [r6(g.lat), r6(g.lon)]);
  if (poly.length > 1 && poly[0][0] === poly.at(-1)[0] && poly[0][1] === poly.at(-1)[1]) poly.pop();
  if (el.tags.leisure === "park") {
    parks.push({ id: `p${parks.length + 1}`, polygon: poly });
  } else if (el.tags.building && dist(centroid(poly), CENTER) <= RADIUS_M) {
    buildings.push({ id: `b${buildings.length + 1}`, polygon: poly, _area: area(poly), _c: centroid(poly), _kind: el.tags.building });
  }
}

// 戸建てらしい大きさ（60〜200㎡）の建物から、互いに 70m 以上離れた8軒を拠点にする
const houses = buildings.filter((b) => ["yes", "house"].includes(b._kind) && b._area >= 60 && b._area <= 200);
const shuffled = houses.map((b) => [rand(), b]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
const baseBuildings = [];
for (const b of shuffled) {
  if (dist(b._c, CENTER) > RADIUS_M - 40) continue;
  if (baseBuildings.every((o) => dist(o._c, b._c) >= 70)) baseBuildings.push(b);
  if (baseBuildings.length === 8) break;
}
const used = new Set(baseBuildings.map((b) => b.id));
const helperBuildings = shuffled.filter((b) => !used.has(b.id)).slice(0, 12);

// 位置の表示は 50m 単位に丸める（spec 12）。保存も丸めた値にする
const round50 = ([lat, lng]) => [
  r6(Math.round(((lat - CENTER[0]) * M_PER_LAT) / 50) * 50 / M_PER_LAT + CENTER[0]),
  r6(Math.round(((lng - CENTER[1]) * M_PER_LNG) / 50) * 50 / M_PER_LNG + CENTER[1]),
];

const requesterNames = ["佐藤さん", "高橋さん", "伊藤さん", "渡辺さん", "山本さん", "中村さん", "小林さん", "加藤さん"];
const soloList = [60, 30, "unknown", 60, 15, 30, 60, 30];
const areaList = ["road", "entrance", "garage", "road", "entrance", "garage", "entrance", "road"];
const levelOf = (solo, area) => {
  const s = solo === "unknown" ? 2 : solo >= 60 ? 3 : solo >= 30 ? 2 : 1;
  const a = area === "road" ? 1 : 0;
  return Math.min(3, s + a);
};
const helperNames = ["田中", "鈴木", "ゆうき（小5）", "あや", "けんた", "みさき", "りく（大学生）", "はるな", "吉田", "松本", "そうた", "ももこ"];
const teamIds = ["salvia", "marigold", "lupinus"];
const morningList = [30, 15, 15, 30, 60, 15, 60, 30, 15, 30, 60, 15];

const participants = [];
const bases = [];
baseBuildings.forEach((b, i) => {
  const id = `r${i + 1}`;
  participants.push({
    id,
    nickname: requesterNames[i],
    role: "requester",
    location: round50(b._c),
    soloMinutes: soloList[i],
    clearArea: areaList[i],
    level: levelOf(soloList[i], areaList[i]),
  });
  // 拠点は実在の建物と結びつけない。位置は依頼者の 50m マスの中心だけ
  bases.push({ id: `base${i + 1}`, number: i + 1, requesterId: id });
});
helperBuildings.forEach((b, i) => {
  participants.push({
    id: `h${i + 1}`,
    nickname: helperNames[i],
    role: "helper",
    location: round50(b._c),
    teamId: teamIds[i % 3],
    morningMinutes: morningList[i],
    hasTools: i % 4 !== 3,
  });
});

const town = {
  name: "しらかば町内（架空）",
  attribution: "© OpenStreetMap contributors (ODbL)",
  center: CENTER,
  radiusM: RADIUS_M,
  buildings: buildings.map(({ id, polygon }) => ({ id, polygon })),
  parks: parks.map(({ id, polygon }) => ({ id, polygon })),
  bases,
  participants,
};
fs.writeFileSync("data/town.json", JSON.stringify(town) + "\n");
console.log(`建物 ${town.buildings.length} / 公園 ${parks.length} / 拠点 ${bases.length} / 参加者 ${participants.length}`);
