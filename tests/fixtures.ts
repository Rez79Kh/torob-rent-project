import type { NormalizedListing, PropertyCluster, UserIntent } from "@/lib/types";
import { DEFAULT_WEIGHTS } from "@/lib/rank";

export function listing(p: Partial<NormalizedListing> & { id: string }): NormalizedListing {
  return {
    rawId: p.id,
    source: "divar",
    url: "",
    title: p.id,
    neighborhood: "punak",
    areaM2: 80,
    rooms: 2,
    floor: 2,
    totalFloors: 5,
    buildYear: 1395,
    deposit: 1e9,
    rent: 30e6,
    convert: { mode: "none", minDeposit: p.deposit ?? 1e9, maxDeposit: p.deposit ?? 1e9, rate: 0.03 },
    amenities: { parking: true, elevator: true, storage: true, balcony: false, renovated: false },
    realPhotos: "unknown",
    redFlags: [],
    advertiser: { kind: "agency", name: "املاک تست" },
    geo: { lat: 35.76, lng: 51.33, approx: true },
    nearestMetro: { name: "x", distanceM: 900 },
    isSeed: true,
    postedAt: "2026-11-10",
    extraction: { method: "rules", confidence: 0.8, fieldsFromText: [] },
    ...p,
  };
}

export function single(l: NormalizedListing): PropertyCluster {
  return {
    clusterId: `c-${l.id}`,
    canonicalId: l.id,
    memberIds: [l.id],
    members: [{ listingId: l.id, similarity: 1, matchedOn: [] }],
    priceSpread: { minEffective: 0, maxEffective: 0, savings: 0 },
    bestMemberId: l.id,
  };
}

export function intent(p: Partial<UserIntent> = {}): UserIntent {
  return {
    cash: 2e9,
    maxRent: 40e6,
    userRate: 0.025,
    neighborhoods: [],
    must: [],
    nice: [],
    weights: DEFAULT_WEIGHTS,
    parsedBy: "manual",
    rawQuery: "",
    ...p,
  };
}
