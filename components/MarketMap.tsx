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

const PILL = {
  good: "background:#ecfdf5;color:#059669;border:1px solid #059669;",
  fair: "background:#ffffff;color:#1e293b;border:1px solid #e5e7eb;",
  high: "background:#fff1f2;color:#e11d48;border:1px solid #fecdd3;",
} as const;

function shortMonthly(v: number): string {
  const millions = v / 1e6;
  const rounded = millions >= 100 ? Math.round(millions) : Math.round(millions * 10) / 10;
  return `${toPersianDigits(String(rounded)).replace(".", "٫")} م`;
}

function priceIcon(label: string, band: keyof typeof PILL, active: boolean) {
  const width = Math.max(48, label.length * 8 + 16);
  const height = 22;
  const look = active
    ? "background:#f31d3a;color:#fff;border:1px solid #f31d3a;box-shadow:0 8px 16px -6px rgba(243,29,58,.75);transform:scale(1.1);"
    : PILL[band];
  return L.divIcon({
    className: active ? "hover:!z-[1000] !z-[1000]" : "hover:!z-[1000]",
    iconSize: [width, height],
    iconAnchor: [width / 2, height / 2],
    html: `<div class="inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-bold shadow-sm" style="font-family:Vazirmatn,sans-serif;font-variant-numeric:tabular-nums;font-feature-settings:'tnum';${look}">${label}</div>`,
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

        {[...ranked].reverse().map((r) => {
          const rank = ranked.indexOf(r) + 1;
          const id = r.cluster.clusterId;
          const active = id === activeId;
          const band = fairBand(r.fairDeltaPct);
          const label = shortMonthly(r.effectiveMonthly);
          return (
            <Marker
              key={`${id}-${active ? "on" : "off"}-${label}`}
              position={[r.listing.geo.lat, r.listing.geo.lng]}
              icon={priceIcon(label, band, active)}
              zIndexOffset={active ? 1000 : 400 - Math.min(rank, 80)}
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
          <Legend color="#059669" label="زیر میانگین" />
          <Legend color="#1e293b" label="منصفانه" />
          <Legend color="#e11d48" label="گران" />
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
