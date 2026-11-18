import neighborhoods from "@/data/neighborhoods.json";
import metro from "@/data/metro.json";
import { normalizeFa } from "./persian";

export interface Neighborhood {
  slug: string;
  fa: string;
  en: string;
  aliases: string[];
  center: [number, number];
  radiusM: number;
}

export const NEIGHBORHOODS = neighborhoods as Neighborhood[];
export const METRO = metro as { name: string; line: string; lat: number; lng: number }[];

export const NEIGHBORHOOD_BY_SLUG = Object.fromEntries(NEIGHBORHOODS.map((n) => [n.slug, n])) as Record<
  string,
  Neighborhood
>;

export function haversineM(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function nearestMetro(lat: number, lng: number): { name: string; distanceM: number } {
  let best = { name: "", distanceM: Infinity };
  for (const s of METRO) {
    const d = haversineM([lat, lng], [s.lat, s.lng]);
    if (d < best.distanceM) best = { name: s.name, distanceM: Math.round(d) };
  }
  return best;
}

/** Longest alias match wins, so "پونک جنوبی" beats a stray "عدل". */
export function matchNeighborhood(text: string): string | null {
  const t = normalizeFa(text);
  let best: { slug: string; len: number } | null = null;
  for (const n of NEIGHBORHOODS) {
    for (const a of n.aliases) {
      const na = normalizeFa(a);
      if (t.includes(na) && (!best || na.length > best.len)) best = { slug: n.slug, len: na.length };
    }
  }
  return best?.slug ?? null;
}

export function matchAllNeighborhoods(text: string): string[] {
  const t = normalizeFa(text);
  return NEIGHBORHOODS.filter((n) => n.aliases.some((a) => t.includes(normalizeFa(a)))).map((n) => n.slug);
}
