import { clusterListings } from "../lib/dedup";
import { neighborhoodStats } from "../lib/fairPrice";
import type { Dataset, NormalizedListing, RawListing } from "../lib/types";

const NOISE = new Set(["placeholder_price", "non_apartment"]);

export function buildDataset(raw: RawListing[], listings: NormalizedListing[], rate = 0.03): Dataset {
  const usable = listings.filter((l) => !l.redFlags.some((f) => NOISE.has(f.code)) && l.areaM2 > 0 && l.deposit + l.rent > 0);
  const dropped = listings.length - usable.length;

  const rawById = new Map(raw.map((r) => [r.id, r]));
  const { clusters } = clusterListings(usable, rawById, rate);
  const byId = new Map(usable.map((l) => [l.id, l]));
  const representatives = clusters.map((c) => byId.get(c.canonicalId)!);

  return {
    generatedAt: new Date().toISOString(),
    conversionRate: rate,
    listings: usable,
    raw: raw.filter((r) => byId.has(r.id) || listings.some((l) => l.rawId === r.id)),
    clusters: clusters.sort((a, b) => b.memberIds.length - a.memberIds.length),
    neighborhoods: neighborhoodStats(representatives, rate),
    stats: {
      rawCount: raw.length,
      droppedNoise: dropped + (raw.length - listings.length),
      mergedDuplicates: usable.length - clusters.length,
      textOnlyConvertible: usable.filter((l) => l.convert.mode === "text").length,
    },
  };
}
