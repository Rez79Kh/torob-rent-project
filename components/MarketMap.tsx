"use client";

import L from "leaflet";
import { useEffect, useMemo } from "react";
import { Circle, CircleMarker, MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { ClientData } from "@/lib/data";
import { fairBand } from "@/lib/fairPrice";
import { METRO, NEIGHBORHOODS } from "@/lib/geo";
import { fmtToman } from "@/lib/money";
import { toPersianDigits } from "@/lib/persian";
import type { RankedResult } from "@/lib/types";

const COLOR = { good: "#0f9d58", fair: "#6b7280", high: "#d93025" } as const;

function rankIcon(rank: number, color: string, active: boolean) {
  const size = active ? 34 : 28;
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:999px;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font:900 ${
      active ? 14 : 12
    }px Vazirmatn;font-variant-numeric:tabular-nums;font-feature-settings:'tnum';border:3px solid #fff;box-shadow:${
      active ? "0 0 0 3px #f31d3a, 0 2px 6px rgba(0,0,0,.35)" : "0 2px 6px rgba(0,0,0,.35)"
    }">${toPersianDigits(rank)}</div>`,
  });
}

function FitOnce() {
  const map = useMap();
  useEffect(() => {
    const bounds = L.latLngBounds(NEIGHBORHOODS.map((n) => n.center)).pad(0.15);
    // The container gets its final size after layout; refit until the user interacts.
    let touched = false;
    const mark = () => (touched = true);
    map.on("dragstart zoomstart", mark);
    const ro = new ResizeObserver(() => {
      map.invalidateSize();
      if (!touched) map.fitBounds(bounds, { animate: false });
    });
    ro.observe(map.getContainer());
    const t = setTimeout(() => {
      map.invalidateSize();
      map.fitBounds(bounds, { animate: false });
      touched = false;
    }, 60);
    return () => {
      clearTimeout(t);
      ro.disconnect();
      map.off("dragstart zoomstart", mark);
    };
  }, [map]);
  return null;
}

function FollowHover({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target && !map.getBounds().pad(-0.1).contains(target)) map.panTo(target, { animate: true });
  }, [map, target]);
  return null;
}

export default function MarketMap({
  data,
  ranked,
  hoverId,
  selectedId,
  onHover,
  onSelect,
}: {
  data: ClientData;
  ranked: RankedResult[];
  hoverId: string | null;
  selectedId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}) {
  const medians = useMemo(() => new Map(data.neighborhoods.map((n) => [n.slug, n])), [data.neighborhoods]);
  const activeId = hoverId ?? selectedId;
  const activeResult = ranked.find((r) => r.cluster.clusterId === activeId);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-line bg-white">
      <MapContainer center={[35.745, 51.43]} zoom={12} scrollWheelZoom className="h-full w-full" attributionControl={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitOnce />
        <FollowHover target={activeResult ? [activeResult.listing.geo.lat, activeResult.listing.geo.lng] : null} />

        {NEIGHBORHOODS.map((n) => {
          const m = medians.get(n.slug);
          return (
            <Circle
              key={n.slug}
              center={n.center}
              radius={n.radiusM}
              pathOptions={{ color: "#1f2430", weight: 1, dashArray: "4 4", fillOpacity: 0.03 }}
            >
              <Tooltip direction="top" className="price-tip" permanent={false}>
                <b>{n.fa}</b>
                {m && <span className="num"> | میانهٔ اجارهٔ مؤثر هر متر: {fmtToman(m.medianEffPerM2, { unit: false })}</span>}
              </Tooltip>
            </Circle>
          );
        })}

        {METRO.map((s) => (
          <CircleMarker key={s.name} center={[s.lat, s.lng]} radius={4} pathOptions={{ color: "#1d4ed8", weight: 2, fillColor: "#fff", fillOpacity: 1 }}>
            <Tooltip className="price-tip">مترو {s.name} (خط {s.line})</Tooltip>
          </CircleMarker>
        ))}

        {ranked.slice(10).reverse().map((r) => {
          const id = r.cluster.clusterId;
          const color = COLOR[fairBand(r.fairDeltaPct)];
          const active = id === activeId;
          return (
            <CircleMarker
              key={`${id}-${active ? "on" : "off"}`}
              center={[r.listing.geo.lat, r.listing.geo.lng]}
              radius={active ? 10 : 6}
              pathOptions={{ color: active ? "#f31d3a" : "#fff", weight: active ? 3 : 2, fillColor: active ? "#f31d3a" : color, fillOpacity: 1 }}
              eventHandlers={{ mouseover: () => onHover(id), mouseout: () => onHover(null), click: () => onSelect(id) }}
            >
              <Tooltip className="price-tip">
                <span className="num">
                  {toPersianDigits(r.listing.areaM2)} متر | {fmtToman(r.effectiveMonthly, { unit: false })} در ماه
                </span>
              </Tooltip>
            </CircleMarker>
          );
        })}

        {ranked.slice(0, 10).reverse().map((r) => {
          const rank = ranked.indexOf(r) + 1;
          const id = r.cluster.clusterId;
          const active = id === activeId;
          return (
            <Marker
              key={`${id}-${active ? "on" : "off"}`}
              position={[r.listing.geo.lat, r.listing.geo.lng]}
              icon={rankIcon(rank, active || rank === 1 ? "#f31d3a" : COLOR[fairBand(r.fairDeltaPct)], active)}
              zIndexOffset={active ? 1000 : 500 - rank}
              eventHandlers={{ mouseover: () => onHover(id), mouseout: () => onHover(null), click: () => onSelect(id) }}
            >
              <Tooltip className="price-tip" direction="top" offset={[0, -12]}>
                <span className="num">
                  #{toPersianDigits(rank)} | {toPersianDigits(r.listing.areaM2)} متر | {fmtToman(r.effectiveMonthly, { unit: false })} در ماه
                </span>
              </Tooltip>
            </Marker>
          );
        })}
      </MapContainer>

      <div className="pointer-events-none absolute bottom-3 right-3 z-[500] rounded-xl border border-line bg-white px-3 py-2 text-[11px]">
        <div className="mb-1 font-bold">نسبت به میانگین محله</div>
        <div className="flex items-center gap-3">
          <Legend color={COLOR.good} label="زیر میانگین" />
          <Legend color={COLOR.fair} label="منصفانه" />
          <Legend color={COLOR.high} label="گران" />
        </div>
        <div className="mt-1 text-muted">محدودهٔ تقریبی ملک روی نقشه</div>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
