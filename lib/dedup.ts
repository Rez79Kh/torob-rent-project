import { marketMonthly } from "./convert";
import { normalizeFa } from "./persian";
import type { ClusterMember, NormalizedListing, PropertyCluster, RawListing } from "./types";

const BOILERPLATE = [
  /به نام خدا/g,
  /عرض ادب و احترام/g,
  /سلام وقت بخیر/g,
  /پر باشید از عشق/g,
  /فایل اختصاصی/g,
  /فرصت استثنایی/g,
  /فوری/g,
  /مشاور(?: امین شما)?\s*:?\s*[\p{L}]+/gu,
  /برای هماهنگی بازدید تماس بگیرید/g,
  /همراه شما از اولین بازدید تا پای قرارداد/g,
  /مشاوره رایگان، بازدید با هماهنگی/g,
  /جهت بازدید فقط تماس، به چت پاسخ داده نمی ?شود/g,
  /فایل های بیشتر در دفتر موجود است/g,
  /مالک هستم، املاک تماس نگیرد/g,
  /فقط مستاجر واقعی، مشاور املاک نیاید/g,
  /تماس بگیرید/g,
];

/** Strip agency marketing so similarity reflects the unit, not who's selling it. */
export function cleanForSimilarity(title: string, description: string): string {
  let t = normalizeFa(`${title} ${description}`);
  for (const re of BOILERPLATE) t = t.replace(re, " ");
  return t
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ngrams(s: string, n = 3): Map<string, number> {
  const m = new Map<string, number>();
  const padded = ` ${s} `;
  for (let i = 0; i + n <= padded.length; i++) {
    const g = padded.slice(i, i + n);
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}

export class TfIdf {
  private df = new Map<string, number>();
  private vecs = new Map<string, Map<string, number>>();
  private norms = new Map<string, number>();
  private n = 0;

  constructor(docs: { id: string; text: string }[]) {
    const tfs = docs.map((d) => ({ id: d.id, tf: ngrams(d.text) }));
    this.n = docs.length;
    for (const { tf } of tfs) for (const g of tf.keys()) this.df.set(g, (this.df.get(g) ?? 0) + 1);
    for (const { id, tf } of tfs) {
      const v = new Map<string, number>();
      let norm = 0;
      for (const [g, c] of tf) {
        const w = (1 + Math.log(c)) * Math.log((1 + this.n) / (1 + (this.df.get(g) ?? 0)));
        v.set(g, w);
        norm += w * w;
      }
      this.vecs.set(id, v);
      this.norms.set(id, Math.sqrt(norm) || 1);
    }
  }

  cosine(a: string, b: string): number {
    const va = this.vecs.get(a);
    const vb = this.vecs.get(b);
    if (!va || !vb) return 0;
    const [small, big] = va.size < vb.size ? [va, vb] : [vb, va];
    let dot = 0;
    for (const [g, w] of small) {
      const o = big.get(g);
      if (o) dot += w * o;
    }
    return dot / (this.norms.get(a)! * this.norms.get(b)!);
  }
}

export function hamming16(a: string, b: string): number {
  let d = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      d += x & 1;
      x >>= 1;
    }
  }
  return d;
}

export function imageOverlap(a?: string[], b?: string[]): number | null {
  if (!a?.length || !b?.length) return null;
  let hit = 0;
  for (const h of a) if (b.some((o) => hamming16(h, o) <= 6)) hit++;
  return hit / Math.min(a.length, b.length);
}

function cosineVec(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na * nb) || 1);
}

export const MERGE_THRESHOLD = 0.68;

export interface PairScore {
  score: number;
  matchedOn: string[];
  vetoed?: string;
  parts: Record<string, number>;
  textCosine?: number;
  imageOverlap?: number | null;
}

/**
 * Weighted evidence that two posts describe the same physical unit.
 * Structural fields alone max out below the threshold, so text or photo evidence is always required.
 */
export function pairScore(a: NormalizedListing, b: NormalizedListing, textSim: number): PairScore {
  if (a.floor != null && b.floor != null && a.floor !== b.floor) return { score: 0, matchedOn: [], vetoed: "floor", parts: {} };
  if (a.rooms !== b.rooms) return { score: 0, matchedOn: [], vetoed: "rooms", parts: {} };
  const dArea = Math.abs(a.areaM2 - b.areaM2);
  if (dArea > 5) return { score: 0, matchedOn: [], vetoed: "area", parts: {} };

  const parts: Record<string, number> = {};
  const weights: Record<string, number> = {};
  const add = (k: string, w: number, v: number | null) => {
    if (v == null) return;
    parts[k] = v;
    weights[k] = w;
  };
  add("area", 0.2, dArea <= 1 ? 1 : Math.max(0, 1 - (dArea - 1) / 4));
  add("floor", 0.1, a.floor != null && b.floor != null ? 1 : null);
  add("year", 0.1, a.buildYear && b.buildYear ? (Math.abs(a.buildYear - b.buildYear) <= 1 ? 1 : 0) : null);
  add("totalFloors", 0.05, a.totalFloors && b.totalFloors ? (a.totalFloors === b.totalFloors ? 1 : 0) : null);
  const keys = Object.keys(a.amenities) as (keyof NormalizedListing["amenities"])[];
  const inter = keys.filter((k) => a.amenities[k] && b.amenities[k]).length;
  const uni = keys.filter((k) => a.amenities[k] || b.amenities[k]).length;
  add("amenities", 0.1, uni ? inter / uni : 1);
  const text = a.textVector && b.textVector ? cosineVec(a.textVector, b.textVector) : textSim;
  add("text", 0.25, Math.min(1, Math.max(0, (text - 0.15) / 0.5)));
  add("image", 0.2, imageOverlap(a.imageHashes, b.imageHashes));

  const wSum = Object.values(weights).reduce((x, y) => x + y, 0);
  // Missing fields are excluded, but the structural share is capped so text/photos still decide.
  const structuralKeys = ["area", "floor", "year", "totalFloors", "amenities"];
  let score = 0;
  for (const k of Object.keys(parts)) score += parts[k] * weights[k];
  score /= Math.max(wSum, 0.75);

  const label: Record<string, string> = {
    area: "متراژ",
    floor: "طبقه",
    year: "سال ساخت",
    totalFloors: "تعداد طبقات",
    amenities: "امکانات",
    text: "متن آگهی",
    image: "عکس مشترک",
  };
  const matchedOn = Object.keys(parts)
    .filter((k) => parts[k] >= (structuralKeys.includes(k) ? 0.99 : 0.5))
    .map((k) => label[k]);
  const hasEvidence = (parts.text ?? 0) >= 0.5 || (parts.image ?? 0) >= 0.34;
  if (!hasEvidence) score = Math.min(score, MERGE_THRESHOLD - 0.01);
  return { score, matchedOn, parts, textCosine: text, imageOverlap: parts.image ?? null };
}

class UnionFind {
  parent = new Map<string, string>();
  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x);
    const p = this.parent.get(x)!;
    if (p === x) return x;
    const r = this.find(p);
    this.parent.set(x, r);
    return r;
  }
  union(a: string, b: string) {
    this.parent.set(this.find(a), this.find(b));
  }
}

export interface ClusterResult {
  clusters: PropertyCluster[];
  pairs: { a: string; b: string; score: PairScore }[];
}

export function clusterListings(listings: NormalizedListing[], raw: Map<string, RawListing>, rate = 0.03): ClusterResult {
  const tfidf = new TfIdf(
    listings.map((l) => {
      const r = raw.get(l.rawId);
      return { id: l.id, text: cleanForSimilarity(r?.title ?? l.title, r?.description ?? "") };
    }),
  );

  const blocks = new Map<string, NormalizedListing[]>();
  for (const l of listings) {
    const k = `${l.neighborhood}|${l.rooms}`;
    blocks.set(k, [...(blocks.get(k) ?? []), l]);
  }

  const uf = new UnionFind();
  const pairs: ClusterResult["pairs"] = [];
  const best = new Map<string, { sim: number; on: string[]; text: number; image: number | null; other: string }>();
  for (const group of blocks.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        if (Math.abs(a.areaM2 - b.areaM2) > 5) continue;
        const sc = pairScore(a, b, tfidf.cosine(a.id, b.id));
        if (sc.vetoed) continue;
        pairs.push({ a: a.id, b: b.id, score: sc });
        if (sc.score >= MERGE_THRESHOLD) {
          uf.union(a.id, b.id);
          for (const [x, other] of [[a.id, b.id], [b.id, a.id]]) {
            const prev = best.get(x);
            if (!prev || sc.score > prev.sim)
              best.set(x, { sim: sc.score, on: sc.matchedOn, text: sc.textCosine ?? 0, image: sc.imageOverlap ?? null, other });
          }
        }
      }
    }
  }

  const groups = new Map<string, NormalizedListing[]>();
  for (const l of listings) {
    const r = uf.find(l.id);
    groups.set(r, [...(groups.get(r) ?? []), l]);
  }

  const clusters: PropertyCluster[] = [];
  for (const members of groups.values()) {
    const completeness = (l: NormalizedListing) =>
      l.extraction.confidence + (l.floor != null ? 0.1 : 0) + (l.buildYear ? 0.1 : 0) + (l.source === "divar" ? 0.05 : 0);
    const canonical = [...members].sort((x, y) => completeness(y) - completeness(x))[0];
    const costs = members.map((m) => ({ id: m.id, c: marketMonthly(m.deposit, m.rent, rate) }));
    const sorted = [...costs].sort((x, y) => x.c - y.c);
    const memberRows: ClusterMember[] = members.map((m) => {
      const b = best.get(m.id);
      return {
        listingId: m.id,
        similarity: Math.round((b?.sim ?? 1) * 100) / 100,
        matchedOn: b?.on ?? [],
        evidence: b
          ? { textCosine: Math.round(b.text * 100) / 100, imageOverlap: b.image == null ? null : Math.round(b.image * 100) / 100, pairedWith: b.other }
          : undefined,
      };
    });
    clusters.push({
      clusterId: `p-${canonical.id}`,
      canonicalId: canonical.id,
      memberIds: members.map((m) => m.id),
      members: memberRows,
      priceSpread: {
        minEffective: sorted[0].c,
        maxEffective: sorted[sorted.length - 1].c,
        savings: sorted[sorted.length - 1].c - sorted[0].c,
      },
      bestMemberId: sorted[0].id,
    });
  }
  return { clusters, pairs };
}
