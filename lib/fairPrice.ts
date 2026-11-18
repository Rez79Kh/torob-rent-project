import { marketMonthly } from "./convert";
import type { NeighborhoodStats, NormalizedListing } from "./types";

export function effPerM2(l: Pick<NormalizedListing, "deposit" | "rent" | "areaM2">, rate?: number): number {
  return marketMonthly(l.deposit, l.rent, rate) / Math.max(l.areaM2, 1);
}

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** One value per physical property (cluster), so agency reposts don't skew the median. */
export function neighborhoodStats(representatives: NormalizedListing[], rate?: number): NeighborhoodStats[] {
  const by = new Map<string, number[]>();
  for (const l of representatives) {
    const arr = by.get(l.neighborhood) ?? [];
    arr.push(effPerM2(l, rate));
    by.set(l.neighborhood, arr);
  }
  return [...by.entries()].map(([slug, vals]) => {
    const s = vals.sort((a, b) => a - b);
    return {
      slug,
      medianEffPerM2: Math.round(quantile(s, 0.5)),
      p25: Math.round(quantile(s, 0.25)),
      p75: Math.round(quantile(s, 0.75)),
      n: s.length,
    };
  });
}

export function fairDeltaPct(value: number, median: number): number {
  if (!median) return 0;
  return (value / median - 1) * 100;
}

export type FairBand = "good" | "fair" | "high";
export function fairBand(deltaPct: number): FairBand {
  if (deltaPct < -8) return "good";
  if (deltaPct > 8) return "high";
  return "fair";
}
