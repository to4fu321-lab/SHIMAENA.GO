"use client";

// 建物のぬりえ地図。Leaflet はブラウザでしか動かないので、ここは画面側だけで読み込む。
import { useEffect, useRef } from "react";
import type { Destination } from "@/lib/nav";
import type { LatLng } from "@/lib/types";
import "leaflet/dist/leaflet.css";
import { type CellView, type SoloCell, cellCenter, cellPolygon } from "@/lib/cells";
import { TEAMS } from "@/lib/teams";
import { TOWN } from "@/lib/town";
import type { TeamId } from "@/lib/types";

const RED = "#C0392B"; // 人手不足（赤は地図の状態色だけに使う）
const GREY = "#8B949E"; // 返事なし
const INK = "#29445C"; // 冬の深い青
const ICE = "#8FB8C9"; // 氷の青（ソロ出動の足あと）

const teamColor = (id: TeamId) => TEAMS.find((t) => t.id === id)!.color;

interface StyleSpec {
  color: string;
  weight: number;
  fillColor: string;
  fillOpacity: number;
  dashArray?: string;
  className?: string;
  label: string; // 番号ピンの色
}

function cellStyle(cell: CellView): StyleSpec {
  const first = cell.teams[0];
  const second = cell.teams[1];
  const doneFill = first ? teamColor(first) : "#ffffff";
  // 途中のマスは、終わった割合だけ薄く塗る
  const partial = 0.15 + cell.doneRatio * 0.5;
  switch (cell.status) {
    case "done":
      return {
        color: second ? teamColor(second) : teamColor(first!),
        weight: second ? 4 : 2,
        dashArray: second ? "8 6" : undefined,
        fillColor: doneFill,
        fillOpacity: 0.72,
        label: teamColor(first!),
      };
    case "short":
      return { color: RED, weight: 4, fillColor: cell.doneRatio ? doneFill : RED, fillOpacity: cell.doneRatio ? partial : 0.12, className: "blink", label: RED };
    case "no_answer":
      return { color: GREY, weight: 3, fillColor: GREY, fillOpacity: 0.5, className: "blink", label: GREY };
    case "in_progress":
    case "assigned":
      return {
        color: first ? teamColor(first) : INK,
        weight: 4,
        fillColor: cell.doneRatio ? doneFill : "#ffffff",
        fillOpacity: cell.doneRatio ? partial : 0.45,
        className: cell.status === "in_progress" ? "pulse" : undefined,
        label: first ? teamColor(first) : INK,
      };
    case "open":
      return { color: INK, weight: 3, fillColor: "#ffffff", fillOpacity: 0.55, label: INK };
    default:
      return { color: INK, weight: 1, dashArray: "3 5", fillColor: "#ffffff", fillOpacity: 0.15, label: "#6b8296" };
  }
}

export default function TownMap({
  cells,
  home,
  destinations = [],
  solo = [],
}: {
  cells: CellView[];
  /** ソロ出動の足あと（今日、そのマスで活動した件数） */
  solo?: SoloCell[];
  /** 自分の家（登録した位置） */
  home?: LatLng;
  /** 自分が向かっている家（本人にだけ渡る正確な場所） */
  destinations?: Destination[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);

  useEffect(() => {
    let map: import("leaflet").Map | undefined;
    let ro: ResizeObserver | undefined;
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !ref.current) return;
      map = L.map(ref.current, { zoomControl: false, attributionControl: true }).setView(TOWN.center, 16);
      const m = map;
      ro = new ResizeObserver(() => m.invalidateSize());
      ro.observe(ref.current);
      mapRef.current = map;
      L.control.zoom({ position: "topright" }).addTo(map);
      // OpenStreetMap 標準タイル。雪明かりの画面に合わせて CSS（.town-tiles）で色を淡くする
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        className: "town-tiles",
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      for (const park of TOWN.parks) {
        L.polygon(park.polygon, { stroke: false, fillColor: "#dfe9e3", fillOpacity: 0.7, interactive: false }).addTo(map);
      }

      for (const building of TOWN.buildings) {
        L.polygon(building.polygon, {
          color: "#c9d3dc",
          weight: 0.6,
          fillColor: "#eef2f6",
          fillOpacity: 0.8,
          interactive: false,
        }).addTo(map);
      }

      // 50m マスを塗る（どの家かは出さない）
      for (const cell of cells) {
        const style = cellStyle(cell);
        L.polygon(cellPolygon(cell.key), { ...style, interactive: false }).addTo(map);
        L.marker(cellCenter(cell.key), {
          interactive: false,
          icon: L.divIcon({
            className: "",
            html: `<div class="base-pin" style="background:${style.label}">${cell.baseNumbers.join("・")}</div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 40], // マスの上に出して、塗った色を隠さない
          }),
        }).addTo(map);
      }

      // ソロ出動の足あと: 氷の青の薄い塗り（拠点のマスでなければ）と羽のピン。赤・緑は使わない
      const baseKeys = new Set(cells.map((c) => c.key));
      for (const sc of solo) {
        if (!baseKeys.has(sc.key)) {
          L.polygon(cellPolygon(sc.key), { color: ICE, weight: 2, dashArray: "4 4", fillColor: ICE, fillOpacity: 0.35, interactive: false }).addTo(map);
        }
        const [lat, lng] = cellCenter(sc.key);
        L.marker([lat, lng], {
          interactive: false,
          icon: L.divIcon({ className: "", html: `<div class="solo-pin">🪶${sc.count}</div>`, iconSize: [40, 22], iconAnchor: [-4, 30] }),
        }).addTo(map);
      }

      // 自分の家（登録した位置）と、向かっている家（本人だけ）。家までは点線で結ぶ
      if (home) {
        L.marker(home, {
          interactive: false,
          icon: L.divIcon({ className: "", html: `<div class="me-pin">あなた</div>`, iconSize: [48, 24], iconAnchor: [24, 12] }),
        }).addTo(map);
      }
      for (const d of destinations) {
        L.marker(d.location, {
          interactive: false,
          icon: L.divIcon({ className: "", html: `<div class="dest-pin">拠点${d.baseNumber} ここ</div>`, iconSize: [96, 26], iconAnchor: [48, 34] }),
        }).addTo(map);
        L.circleMarker(d.location, { radius: 7, color: RED, weight: 3, fillColor: "#fff", fillOpacity: 1, interactive: false }).addTo(map);
        if (home) L.polyline([home, d.location], { color: INK, weight: 3, dashArray: "6 8", opacity: 0.8, interactive: false }).addTo(map);
      }
      if (destinations.length > 0) {
        const pts = [...destinations.map((d) => d.location), ...(home ? [home] : [])];
        map.fitBounds(L.latLngBounds(pts).pad(0.4), { maxZoom: 17 });
      }
    });
    return () => {
      cancelled = true;
      ro?.disconnect();
      mapRef.current = null;
      map?.remove();
    };
  }, [cells, home, destinations, solo]);

  // 現在地（GPS）: 許可があれば青い点を動かす。許可がなければ何も出さない
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    let dot: import("leaflet").CircleMarker | undefined;
    let Lmod: typeof import("leaflet") | undefined;
    import("leaflet").then((L) => {
      Lmod = L;
    });
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const map = mapRef.current;
        if (!map || !Lmod) return;
        const at: LatLng = [pos.coords.latitude, pos.coords.longitude];
        if (!dot) {
          dot = Lmod.circleMarker(at, { radius: 8, color: "#fff", weight: 3, fillColor: "#2F6FE4", fillOpacity: 1, interactive: false }).addTo(map);
        } else dot.setLatLng(at);
      },
      () => {
        /* 許可されなかった・取れなかった → 出さない */
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
    return () => {
      navigator.geolocation.clearWatch(id);
      dot?.remove();
    };
  }, []);

  return <div ref={ref} className="h-full w-full" aria-label="町内の地図" />;
}
