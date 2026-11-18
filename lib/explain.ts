import { NEIGHBORHOOD_BY_SLUG } from "./geo";
import { fmtPct, fmtToman } from "./money";
import { toPersianDigits } from "./persian";
import { CURRENT_JALALI_YEAR } from "./rank";
import type { Explanation, RankedResult, UserIntent, Weights } from "./types";

export interface Fact {
  key: keyof Weights | "unlock";
  text: string;
  gap: number;
}

const AMENITY_FA: Record<string, string> = {
  parking: "پارکینگ",
  elevator: "آسانسور",
  storage: "انباری",
  balcony: "بالکن",
  renovated: "بازسازی",
};

function costFact(a: RankedResult, b: RankedResult): string {
  const diff = b.effectiveMonthly - a.effectiveMonthly;
  if (diff > 0) return `با پول نقد شما ماهانه ${fmtToman(diff, { unit: false })} ارزان‌تر تمام می‌شود`;
  const perA = a.effectiveMonthly / a.listing.areaM2;
  const perB = b.effectiveMonthly / b.listing.areaM2;
  return `هر متر ${fmtToman(perB - perA, { unit: false })} ارزان‌تر است (${toPersianDigits(a.listing.areaM2 - b.listing.areaM2)} متر بزرگ‌تر با هزینهٔ کمی بیشتر)`;
}

function fairFact(a: RankedResult, b: RankedResult): string {
  const hood = (r: RankedResult) => NEIGHBORHOOD_BY_SLUG[r.listing.neighborhood]?.fa ?? "";
  const side = (p: number) => (p < 0 ? "زیر" : "بالای");
  return `${fmtPct(a.fairDeltaPct)} ${side(a.fairDeltaPct)} میانگین ${hood(a)} است؛ این یکی ${fmtPct(b.fairDeltaPct)} ${side(b.fairDeltaPct)} میانگین ${hood(b)}`;
}

function fitFact(a: RankedResult, b: RankedResult): string {
  const missing = (Object.keys(a.listing.amenities) as (keyof typeof a.listing.amenities)[]).filter(
    (k) => a.listing.amenities[k] && !b.listing.amenities[k],
  );
  if (missing.length) return `${missing.map((k) => AMENITY_FA[k]).join(" و ")} دارد که این یکی ندارد`;
  const dArea = a.listing.areaM2 - b.listing.areaM2;
  if (dArea > 3) return `${toPersianDigits(dArea)} متر بزرگ‌تر است`;
  const ageA = a.listing.buildYear ? CURRENT_JALALI_YEAR - a.listing.buildYear : null;
  const ageB = b.listing.buildYear ? CURRENT_JALALI_YEAR - b.listing.buildYear : null;
  if (ageA != null && ageB != null && ageB > ageA) return `${toPersianDigits(ageB - ageA)} سال نوسازتر است`;
  return "با خواسته‌های شما جورتر است";
}

function trustFact(a: RankedResult, b: RankedResult): string {
  const parts: string[] = [];
  if (a.listing.realPhotos === "yes" && b.listing.realPhotos !== "yes") parts.push("عکس واقعی دارد");
  if (b.listing.realPhotos === "decorative") parts.push("عکس‌های این یکی تزئینی است");
  if (a.listing.advertiser.kind === "owner" && b.listing.advertiser.kind !== "owner") parts.push("مستقیم از مالک است");
  const flagsB = b.listing.redFlags.length - a.listing.redFlags.length;
  if (flagsB > 0) parts.push(`${toPersianDigits(flagsB)} شرط دردسرساز کمتر دارد`);
  return parts.length ? parts.join("، ") : "آگهی کامل‌تر و قابل‌اعتمادتری است";
}

function commuteFact(a: RankedResult, b: RankedResult): string {
  const da = a.listing.nearestMetro?.distanceM ?? 0;
  const db = b.listing.nearestMetro?.distanceM ?? 0;
  return `${toPersianDigits(Math.round(da / 50) * 50)} متر تا مترو ${a.listing.nearestMetro?.name}؛ این یکی ${toPersianDigits(Math.round(db / 50) * 50)} متر`;
}

const RENDER: Record<keyof Weights, (a: RankedResult, b: RankedResult) => string> = {
  cost: costFact,
  fairness: fairFact,
  fit: fitFact,
  trust: trustFact,
  commute: commuteFact,
};

/** Facts behind "why #1 beats #k": the two weighted score components with the largest gap. */
export function factsVs(a: RankedResult, b: RankedResult, intent: UserIntent): Fact[] {
  const w = intent.weights;
  const sum = w.cost + w.fairness + w.fit + w.trust + w.commute || 1;
  const gaps = (Object.keys(RENDER) as (keyof Weights)[])
    .map((k) => ({ key: k, gap: ((a.scoreBreakdown[k] - b.scoreBreakdown[k]) * w[k]) / sum }))
    .filter((g) => g.gap > 0.005)
    .sort((x, y) => y.gap - x.gap)
    .slice(0, 2);
  const facts: Fact[] = gaps.map((g) => ({ key: g.key, gap: g.gap, text: RENDER[g.key](a, b) }));
  if (a.unlockedByConversion && !b.unlockedByConversion && facts.length < 2) {
    facts.push({ key: "unlock", gap: 0, text: `با تبدیل ${fmtToman(a.chosenDeposit - a.listing.deposit, { unit: false })} رهن بیشتر، اجاره به ${fmtToman(a.resultingRent, { unit: false })} می‌رسد` });
  }
  return facts;
}

export function explainTop(ranked: RankedResult[], intent: UserIntent): Explanation {
  const [a, ...rest] = ranked;
  if (!a) return { bullets: [], by: "template" };
  const bullets = rest.slice(0, 2).map((b, i) => {
    const facts = factsVs(a, b, intent);
    const text = facts.length ? facts.map((f) => f.text).join("؛ و ") : "امتیاز کلی کمی بالاتر با وزن‌های فعلی شما";
    return { vs: i + 2, text };
  });
  return { bullets, by: "template" };
}
