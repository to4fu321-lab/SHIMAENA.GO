"use client";

// 建物のぬりえ地図。Leaflet はブラウザでしか動かないので、ここは画面側だけで読み込む。
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { BaseView } from "@/lib/morning";
import { TEAMS } from "@/lib/teams";
import { TOWN } from "@/lib/town";
import type { LatLng, TeamId } from "@/lib/types";

const RED = "#FF3B5C"; // 人手不足
const GREY = "#9AA0AE"; // 返事なし
const INK = "#3B2A78";

const teamColor = (id: TeamId) => TEAMS.find((t) => t.id === id)!.color;
const centroid = (poly: LatLng[]): LatLng => [
  poly.reduce((s, p) => s + p[0], 0) / poly.length,
  poly.reduce((s, p) => s + p[1], 0) / poly.length,
];

interface StyleSpec {
  color: string;
  weight: number;
  fillColor: string;
  fillOpacity: number;
  dashArray?: string;
  className?: string;
  label: string; // 番号ピルの色
}

function baseStyle(view: BaseView | undefined): StyleSpec {
  const first = view?.teams[0];
  const second = view?.teams[1];
  switch (view?.status) {
    case "done":
      return {
        color: second ? teamColor(second) : INK,
        weight: second ? 4 : 1.5,
        dashArray: second ? "6 4" : undefined,
        fillColor: teamColor(first!),
        fillOpacity: 0.9,
        label: teamColor(first!),
      };
    case "short":
      return { color: RED, weight: 4, fillColor: "#ffffff", fillOpacity: 1, className: "blink", label: RED };
    case "assigned":
    case "in_progress":
      return {
        color: first ? teamColor(first) : INK,
        weight: 4,
        fillColor: "#ffffff",
        fillOpacity: 1,
        className: view.status === "in_progress" ? "pulse" : undefined,
        label: first ? teamColor(first) : INK,
      };
    case "no_answer":
      return { color: GREY, weight: 2, fillColor: GREY, fillOpacity: 0.85, className: "blink", label: GREY };
    default:
      return { color: INK, weight: 2, fillColor: "#ffffff", fillOpacity: 1, label: INK };
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

      const baseByBuilding = new Map(TOWN.bases.map((b) => [b.buildingId, b]));
      const viewByBase = new Map(views.map((v) => [v.baseId, v]));
      for (const building of TOWN.buildings) {
        if (baseByBuilding.has(building.id)) continue;
        L.polygon(building.polygon, {
          color: "#cbc3e3",
          weight: 0.6,
          fillColor: "#ece8f6",
          fillOpacity: 0.8,
          interactive: false,
        }).addTo(map);
      }

      for (const base of TOWN.bases) {
        const building = TOWN.buildings.find((b) => b.id === base.buildingId);
        if (!building) continue;
        const style = baseStyle(viewByBase.get(base.id));
        // ズーム16でも状態が分かるよう、家のまわりに状態色の輪を描く
        L.circle(centroid(building.polygon), {
          radius: 22,
          stroke: false,
          fillColor: style.label,
          fillOpacity: 0.28,
          className: style.className,
          interactive: false,
        }).addTo(map);
        L.polygon(building.polygon, { ...style, interactive: false }).addTo(map);
        L.marker(centroid(building.polygon), {
          interactive: false,
          icon: L.divIcon({
            className: "",
            html: `<div class="base-pin" style="background:${style.label}">${base.number}</div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 36],
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
