"use client";

// 建物のぬりえ地図。Leaflet はブラウザでしか動かないので、ここは画面側だけで読み込む。
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { type CellView, cellCenter, cellPolygon, viewCells } from "@/lib/cells";
import type { BaseView } from "@/lib/morning";
import { TEAMS } from "@/lib/teams";
import { TOWN } from "@/lib/town";
import type { TeamId } from "@/lib/types";

const RED = "#FF3B5C"; // 人手不足
const GREY = "#9AA0AE"; // 返事なし
const INK = "#3B2A78";

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
      return { color: INK, weight: 1, dashArray: "3 5", fillColor: "#ffffff", fillOpacity: 0.15, label: "#8a7bb5" };
  }
}

export default function TownMap({ views }: { views: BaseView[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: import("leaflet").Map | undefined;
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !ref.current) return;
      map = L.map(ref.current, { zoomControl: false, attributionControl: true }).setView(TOWN.center, 16);
      L.control.zoom({ position: "topright" }).addTo(map);
      // OpenStreetMap 標準タイル。パステルに合わせて CSS（.town-tiles）で色を淡くする
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        className: "town-tiles",
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      for (const park of TOWN.parks) {
        L.polygon(park.polygon, { stroke: false, fillColor: "#bff0dc", fillOpacity: 0.7, interactive: false }).addTo(map);
      }

      for (const building of TOWN.buildings) {
        L.polygon(building.polygon, {
          color: "#cbc3e3",
          weight: 0.6,
          fillColor: "#ece8f6",
          fillOpacity: 0.8,
          interactive: false,
        }).addTo(map);
      }

      // 50m マスを塗る（どの家かは出さない）
      for (const cell of viewCells(views)) {
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
    });
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [views]);

  return <div ref={ref} className="h-full w-full" aria-label="町内の地図" />;
}
