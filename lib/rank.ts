import { effectiveMonthly, fitToCash } from "./convert";
import { effPerM2, fairDeltaPct } from "./fairPrice";
import type {
  Dataset,
  NormalizedListing,
  PropertyCluster,
  RankedResult,
  RedFlagCode,
  UserIntent,
  Weights,
} from "./types";

export const CURRENT_JALALI_YEAR = 1405;
export const NEAR_METRO_M = 1200;

export const DEFAULT_WEIGHTS: Weights = { cost: 0.35, fairness: 0.2, fit: 0.2, trust: 0.15, commute: 0.1 };

const SOFT_PENALTY_FLAGS: RedFlagCode[] = [
  "mozahem_parking",
  "shared_parking",
  "evict_end_of_month",
  "commission_extra",
  "short_contract",
  "basement_unit",
  "no_elevator_high_floor",
];
const ALWAYS_BLOCK: RedFlagCode[] = ["placeholder_price", "non_apartment"];

export function blockingFlagsFor(l: NormalizedListing, intent: UserIntent): RedFlagCode[] {
  const out: RedFlagCode[] = [];
  for (const f of l.redFlags) {
    if (ALWAYS_BLOCK.includes(f.code)) out.push(f.code);
    if (intent.household === "single" && ["family_only", "couple_only", "no_single"].includes(f.code)) out.push(f.code);
    if (intent.household === "family" && f.code === "couple_only") out.push(f.code);
  }
  return out;
}

export const REJECT_LABEL: Record<string, string> = {
  cash: "پول نقد کافی نیست",
  rent: "اجاره حتی بعد از تبدیل بالاتر از سقف شماست",
  neighborhood: "خارج از محله‌های انتخابی",
  area: "متراژ کمتر از خواستهٔ شما",
  rooms: "تعداد خواب کمتر",
  age: "ساختمان قدیمی‌تر از خواستهٔ شما",
  flag: "شرط مالک با شرایط شما نمی‌خواند",
  must: "یکی از امکانات ضروری را ندارد",
};

interface Candidate {
  listing: NormalizedListing;
  deposit: number;
  rent: number;
  eff: number;
  unlocked: boolean;
}

function bestMemberForUser(members: NormalizedListing[], intent: UserIntent): Candidate | { reason: string; listing: NormalizedListing } {
  let best: Candidate | null = null;
  let firstReason: string | null = null;
  for (const l of members) {
    const fit = fitToCash(l.deposit, l.rent, l.convert, intent.cash, intent.maxRent, intent.userRate);
    if (!fit.feasible) {
      firstReason ??= fit.reason ?? "cash";
      continue;
    }
    const eff = effectiveMonthly(fit.deposit, fit.rent, intent.userRate);
    if (!best || eff < best.eff) best = { listing: l, deposit: fit.deposit, rent: fit.rent, eff, unlocked: fit.unlockedByConversion };
  }
  return best ?? { reason: firstReason ?? "cash", listing: members[0] };
}

function staticReject(l: NormalizedListing, intent: UserIntent): string | null {
  if (intent.neighborhoods.length && !intent.neighborhoods.includes(l.neighborhood)) return "neighborhood";
  if (intent.minArea && l.areaM2 < intent.minArea) return "area";
  if (intent.minRooms && l.rooms < intent.minRooms) return "rooms";
  if (intent.maxBuildAge && l.buildYear && CURRENT_JALALI_YEAR - l.buildYear > intent.maxBuildAge) return "age";
  for (const m of intent.must) {
    if (m === "near_metro") {
      if ((l.nearestMetro?.distanceM ?? Infinity) > NEAR_METRO_M) return "must";
    } else if (!l.amenities[m]) return "must";
  }
  return null;
}

function trustScore(l: NormalizedListing, cluster: PropertyCluster): number {
  let t = 0.5;
  if (l.realPhotos === "yes") t += 0.2;
  if (l.realPhotos === "decorative") t -= 0.25;
  if (l.advertiser.kind === "owner") t += 0.1;
  if (cluster.memberIds.length > 1 && cluster.priceSpread.savings === 0) t += 0.05;
  t -= 0.1 * l.redFlags.filter((f) => SOFT_PENALTY_FLAGS.includes(f.code)).length;
  t += 0.1 * (l.extraction.confidence - 0.5);
  return clamp01(t);
}

function fitScore(l: NormalizedListing, intent: UserIntent): number {
  const nice = intent.nice.filter((n) => n !== "near_metro");
  const niceHit = nice.length ? nice.filter((n) => l.amenities[n as keyof typeof l.amenities]).length / nice.length : 0.5;
  const areaBonus = intent.minArea ? Math.min(0.3, ((l.areaM2 - intent.minArea) / intent.minArea) * 0.6) : Math.min(0.3, l.areaM2 / 400);
  const roomBonus = intent.minRooms ? Math.min(0.1, (l.rooms - intent.minRooms) * 0.05) : 0;
  const age = l.buildYear ? CURRENT_JALALI_YEAR - l.buildYear : 15;
  const ageBonus = 0.1 * clamp01(1 - age / 30);
  return clamp01(0.6 * niceHit + areaBonus + roomBonus + ageBonus);
}

function commuteScore(l: NormalizedListing, intent: UserIntent): number {
  const wants = intent.must.includes("near_metro") || intent.nice.includes("near_metro");
  if (!wants) return 0.5;
  return Math.exp(-(l.nearestMetro?.distanceM ?? 5000) / 800);
}

function normWeights(w: Weights): Weights {
  const sum = w.cost + w.fairness + w.fit + w.trust + w.commute || 1;
  return { cost: w.cost / sum, fairness: w.fairness / sum, fit: w.fit / sum, trust: w.trust / sum, commute: w.commute / sum };
}

export interface RankOutput {
  ranked: RankedResult[];
  rejected: RankedResult[];
  unlockedCount: number;
  rejectCounts: Record<string, number>;
}

export function rankMarket(data: Pick<Dataset, "listings" | "clusters" | "neighborhoods" | "conversionRate">, intent: UserIntent): RankOutput {
  const byId = new Map(data.listings.map((l) => [l.id, l]));
  const median = new Map(data.neighborhoods.map((n) => [n.slug, n.medianEffPerM2]));
  const w = normWeights(intent.weights);

  const feasible: RankedResult[] = [];
  const rejected: RankedResult[] = [];

  for (const cluster of data.clusters) {
    const members = cluster.memberIds.map((id) => byId.get(id)!).filter(Boolean);
    const canonical = byId.get(cluster.canonicalId) ?? members[0];
    const base = {
      cluster,
      score: 0,
      scoreBreakdown: { cost: 0, fairness: 0, fit: 0, trust: 0, commute: 0 },
    };

    const stat = staticReject(canonical, intent);
    const flags = blockingFlagsFor(canonical, intent);
    const pick = bestMemberForUser(members, intent);
    const listing = "eff" in pick ? pick.listing : pick.listing;
    const perM2 = effPerM2(listing, data.conversionRate);
    const fair = fairDeltaPct(perM2, median.get(listing.neighborhood) ?? perM2);

    const reason = stat ?? (flags.length ? "flag" : "eff" in pick ? null : pick.reason);
    if (reason || !("eff" in pick)) {
      rejected.push({
        ...base,
        listing,
        feasible: false,
        chosenDeposit: listing.deposit,
        resultingRent: listing.rent,
        effectiveMonthly: effectiveMonthly(listing.deposit, listing.rent, intent.userRate),
        effPerM2: perM2,
        fairDeltaPct: fair,
        unlockedByConversion: false,
        blockingFlags: flags,
        rejectReason: reason ?? "cash",
      });
      continue;
    }

    feasible.push({
      ...base,
      listing,
      feasible: true,
      chosenDeposit: pick.deposit,
      resultingRent: pick.rent,
      effectiveMonthly: pick.eff,
      effPerM2: perM2,
      fairDeltaPct: fair,
      unlockedByConversion: pick.unlocked,
      blockingFlags: [],
    });
  }

  // Mostly "what I get per m²", partly "what I pay each month", both relative to what's feasible right now.
  const abs = feasible.map((r) => r.effectiveMonthly);
  const per = feasible.map((r) => r.effectiveMonthly / Math.max(r.listing.areaM2, 1));
  const bounds = new Map([abs, per].map((arr) => [arr, [Math.min(...arr), Math.max(...arr)] as const]));
  const norm = (arr: number[], i: number) => {
    const [lo, hi] = bounds.get(arr)!;
    return hi > lo ? 1 - (arr[i] - lo) / (hi - lo) : 1;
  };
  feasible.forEach((r, i) => {
    const s: Weights = {
      cost: 0.3 * norm(abs, i) + 0.7 * norm(per, i),
      fairness: 1 / (1 + Math.exp(r.fairDeltaPct / 10)),
      fit: fitScore(r.listing, intent),
      trust: trustScore(r.listing, r.cluster),
      commute: commuteScore(r.listing, intent),
    };
    r.scoreBreakdown = s;
    r.score = w.cost * s.cost + w.fairness * s.fairness + w.fit * s.fit + w.trust * s.trust + w.commute * s.commute;
  });
  feasible.sort((a, b) => b.score - a.score);

  const rejectCounts: Record<string, number> = {};
  for (const r of rejected) rejectCounts[r.rejectReason!] = (rejectCounts[r.rejectReason!] ?? 0) + 1;

  return { ranked: feasible, rejected, unlockedCount: feasible.filter((r) => r.unlockedByConversion).length, rejectCounts };
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
