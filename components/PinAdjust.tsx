"use client";

// 道の報告のピンを地図で合わせる。ピンは画面の真ん中に固定し、指で地図を動かして危険な場所に重ねる（スマホで扱いやすいように）。
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "leaflet/dist/leaflet.css";
import type { LatLng } from "@/lib/types";

export default function PinAdjust({
  start,
  emoji,
  onDone,
  onCancel,
}: {
  start: LatLng;
  emoji?: string;
  onDone: (at: LatLng) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const [moved, setMoved] = useState(0);

  useEffect(() => {
    let map: import("leaflet").Map | undefined;
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !ref.current) return;
      map = L.map(ref.current, { zoomControl: false, attributionControl: true }).setView(start, 18);
      mapRef.current = map;
      L.control.zoom({ position: "topright" }).addTo(map);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        className: "town-tiles",
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      // 最初の位置（GPS）を薄い点で残す
      L.circleMarker(start, { radius: 6, color: "#fff", weight: 2, fillColor: "#2F6FE4", fillOpacity: 0.9, interactive: false }).addTo(map);
      const m = map;
      map.on("move", () => setMoved(Math.round(m.distance(m.getCenter(), start))));
    });
    return () => {
      cancelled = true;
      mapRef.current = null;
      map?.remove();
    };
  }, [start]);

  const done = () => {
    const c = mapRef.current?.getCenter();
    onDone(c ? [c.lat, c.lng] : start);
  };

  // 親の動き（transform）の中に閉じこめられないよう、ページのいちばん上に出す
  return createPortal(
    <div className="fixed inset-0 z-[1250] flex flex-col bg-paper" role="dialog" aria-label="ピンの場所を合わせる">
      <div className="bg-ink px-4 py-3 text-white">
        <p className="text-lg font-bold leading-snug">📍 ピンを危険な場所に合わせよう</p>
        <p className="text-sm text-white/85">指で地図を動かすと、真ん中のピンの場所が変わります。</p>
      </div>
      <div className="relative min-h-0 flex-1">
        <div ref={ref} className="h-full w-full" aria-label="場所を合わせる地図" />
        {/* 真ん中に固定したピン（先が地図の中心） */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-[500] -translate-x-1/2 translate-y-[calc(-100%-8px)]" aria-hidden="true">
          <div className="road-pin">
            <span>{emoji ?? "📍"}</span>
          </div>
        </div>
        <p className="pointer-events-none absolute inset-x-0 bottom-2 z-[500] text-center">
          <span className="rounded-full bg-card/95 px-3 py-1 text-sm font-bold shadow">
            {moved === 0 ? "青い点がいまの場所（GPS）" : `GPS から 約${moved}m 動かしました`}
          </span>
        </p>
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-2 bg-card p-3 pb-[max(12px,env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
        <button onClick={onCancel} className="btn btn-white rounded-full px-5 text-base">
          もどる
        </button>
        <button onClick={done} className="btn btn-lamp rounded-full text-xl">
          ここにする
        </button>
      </div>
    </div>,
    document.body,
  );
}
