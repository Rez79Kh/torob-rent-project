import { DEFAULT_RATE, fullDepositOf } from "../convert";
import { NEIGHBORHOOD_BY_SLUG, matchNeighborhood, nearestMetro } from "../geo";
import { parseToman } from "../money";
import { normalizeFa } from "../persian";
import type { Amenities, Convertibility, NormalizedListing, RawListing, RedFlag, RedFlagCode } from "../types";
import { CURRENT_JALALI_YEAR } from "../rank";

const ORDINAL: Record<string, number> = {
  همکف: 0, اول: 1, دوم: 2, سوم: 3, چهارم: 4, پنجم: 5, ششم: 6, هفتم: 7, هشتم: 8, نهم: 9, دهم: 10,
};
const SMALL: Record<string, number> = { یک: 1, دو: 2, سه: 3, چهار: 4, پنج: 5 };

export const RED_FLAG_PATTERNS: { code: RedFlagCode; re: RegExp }[] = [
  { code: "family_only", re: /فقط (به )?خانواده|مخصوص خانواده|فقط متاهل|فقط متأهل|خانواده محترم/ },
  { code: "couple_only", re: /فقط (به )?زوج|زوج جوان بدون فرزند|فقط زوجین/ },
  { code: "no_single", re: /به مجرد (داده )?نمی ?(شود|دهیم)|مجرد نمی ?پذیر|مجردی ممنوع|به مجرد اجاره داده نمی/ },
  { code: "mozahem_parking", re: /پارکینگ (مزاحم|مزاحم دار|پشت سر هم|تو در تو)|مزاحم دارد/ },
  { code: "shared_parking", re: /پارکینگ (مشاع|اشتراکی|عمومی)|پارکینگ نوبتی/ },
  { code: "evict_end_of_month", re: /تخلیه (آخر|پایان|اول|اواسط) [\p{L}]+|تخلیه (فوری|سریع)|تا آخر (ماه|آذر|دی|بهمن) تخلیه/u },
  { code: "commission_extra", re: /کمیسیون (جداگانه|جدا|کامل)|حق ?الزحمه (جداگانه|جدا)/ },
  { code: "short_contract", re: /قرارداد (شش|۶|6|سه|۳|3) ?ماهه|کوتاه ?مدت/ },
  { code: "basement_unit", re: /زیر ?زمین|زیر همکف|طبقه منفی|نیم طبقه پایین/ },
];

const NOT_CONVERTIBLE_RE = /غیر ?قابل تبدیل|قابل تبدیل نیست|تبدیل (نمی ?شود|ندارد)|بدون تبدیل/;
const CONVERTIBLE_RE = /قابل تبدیل|قابلیت تبدیل|قابل جابجایی|قابل جا به جایی|رهن و اجاره (قابل )?(تبدیل|جابجا)|تبدیل (تا|به|دارد)|امکان تبدیل/;

function field(raw: RawListing, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = raw.formFields[k];
    if (v != null && String(v).trim() !== "") return String(v);
  }
  return undefined;
}

function firstNumber(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const m = normalizeFa(s).match(/-?\d+/);
  return m ? Number(m[0]) : undefined;
}

function snippet(text: string, idx: number, len: number): string {
  return text.slice(Math.max(0, idx - 12), Math.min(text.length, idx + len + 12)).trim();
}

export function extractArea(text: string): number | undefined {
  const m = text.match(/(\d{2,3})\s*(متر|متری|مترمربع)/);
  return m ? Number(m[1]) : undefined;
}

export function extractRooms(text: string): number | undefined {
  if (/سوئیت|سوییت|استودیو|بدون اتاق/.test(text)) return 0;
  const m = text.match(/(\d|یک|دو|سه|چهار|پنج)\s*(خواب|خوابه)/);
  if (!m) return undefined;
  return /\d/.test(m[1]) ? Number(m[1]) : SMALL[m[1]];
}

export function extractFloor(text: string): { floor?: number; total?: number } {
  const of = text.match(/طبقه\s*(-?\d+|همکف|اول|دوم|سوم|چهارم|پنجم|ششم|هفتم|هشتم)\s*(از\s*(\d+))?/);
  if (of) {
    const floor = /\d/.test(of[1]) ? Number(of[1]) : ORDINAL[of[1]];
    const total = of[3] ? Number(of[3]) : undefined;
    const t2 = text.match(/(\d+)\s*طبقه/);
    return { floor, total: total ?? (t2 ? Number(t2[1]) : undefined) };
  }
  const t = text.match(/(\d+)\s*طبقه/);
  return { total: t ? Number(t[1]) : undefined };
}

export function extractBuildYear(text: string): number | undefined {
  const y = text.match(/(?:ساخت|سال ساخت|بنای?)\s*(13[5-9]\d|140\d)/) ?? text.match(/\b(13[6-9]\d|140[0-5])\b/);
  if (y) return Number(y[1]);
  const age = text.match(/(\d{1,2})\s*سال (ساخت|بنا|سن)/) ?? text.match(/سن بنا\s*(\d{1,2})/);
  if (age) return CURRENT_JALALI_YEAR - Number(age[1]);
  if (/کلید نخورده|نوساز|تازه ساز/.test(text)) return CURRENT_JALALI_YEAR - 1;
  return undefined;
}

function hasAmenity(text: string, word: string): boolean | undefined {
  if (new RegExp(`(بدون|فاقد) ${word}|${word} (ندارد|نداره|ندارد\\.)`).test(text)) return false;
  if (new RegExp(word).test(text)) return true;
  return undefined;
}

export function extractConvertibility(text: string, deposit: number, rent: number, flag?: boolean): Convertibility {
  const none: Convertibility = { mode: "none", minDeposit: deposit, maxDeposit: deposit, rate: DEFAULT_RATE };
  if (NOT_CONVERTIBLE_RE.test(text) && !flag) return none;

  let rate = DEFAULT_RATE;
  let evidence: string | undefined;
  let maxDeposit: number | undefined;

  // "هر ۱۰۰ میلیون، ۳ میلیون" -> explicit rate
  const rateM = text.match(/هر\s*(\d+(?:[.,/]\d+)?)\s*(میلیون|میلیارد)\s*[،,]?\s*(?:رهن\s*)?(?:=|معادل|برابر)?\s*(\d+(?:[.,/]\d+)?)\s*(میلیون|هزار)/);
  if (rateM) {
    const per = parseToman(`${rateM[1]} ${rateM[2]}`) ?? 0;
    const eq = parseToman(`${rateM[3]} ${rateM[4]}`) ?? 0;
    if (per > 0 && eq > 0) {
      rate = eq / per;
      evidence = rateM[0];
    }
  }

  // "تبدیل تا ۲ میلیارد" or "رهن کامل ۲.۵ میلیارد" -> max deposit
  const upTo = text.match(/(?:تبدیل|جابجایی)\s*(?:تا|به)\s*(?:سقف\s*)?(?:ودیعه\s*)?(\d+(?:[.,/]\d+)?\s*(?:میلیارد|میلیون))/);
  const full = text.match(/(?:یا|و|تا)?\s*رهن کامل\s*(?:هم\s*)?(\d+(?:[.,/]\d+)?\s*(?:میلیارد|میلیون))/);
  const target = upTo ?? full;
  if (target) {
    const v = parseToman(target[1]);
    if (v && v > deposit) {
      maxDeposit = v;
      evidence ??= target[0].trim();
      if (full && !rateM && rent > 0) rate = rent / (v - deposit);
    }
  }

  const textSays = CONVERTIBLE_RE.test(text) || !!target;
  if (!flag && !textSays) return none;

  if (!evidence && textSays) {
    const m = text.match(CONVERTIBLE_RE);
    if (m) evidence = snippet(text, m.index ?? 0, m[0].length);
  }
  const cap = fullDepositOf(deposit, rent, rate);
  return {
    mode: flag ? "form" : "text",
    minDeposit: deposit,
    maxDeposit: Math.round(Math.min(maxDeposit ?? cap, cap)),
    rate: Math.round(rate * 10000) / 10000,
    evidence,
  };
}

export function extractRedFlags(text: string): RedFlag[] {
  const out: RedFlag[] = [];
  for (const { code, re } of RED_FLAG_PATTERNS) {
    const m = text.match(re);
    if (m) out.push({ code, evidence: snippet(text, m.index ?? 0, m[0].length) });
  }
  return out;
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Divar only exposes an approximate circle; seed data gets a stable pseudo-random point inside the neighborhood. */
export function approxGeo(raw: RawListing, slug: string): { lat: number; lng: number; approx: boolean } {
  if (raw.approxLocation) return { lat: raw.approxLocation.lat, lng: raw.approxLocation.lng, approx: true };
  const n = NEIGHBORHOOD_BY_SLUG[slug];
  const h = hashStr(raw.id);
  const angle = ((h % 3600) / 3600) * 2 * Math.PI;
  const r = (((h >>> 12) % 1000) / 1000) ** 0.5 * n.radiusM * 0.75;
  const dLat = (r * Math.cos(angle)) / 111_320;
  const dLng = (r * Math.sin(angle)) / (111_320 * Math.cos((n.center[0] * Math.PI) / 180));
  return { lat: n.center[0] + dLat, lng: n.center[1] + dLng, approx: true };
}

/** Deterministic Persian extractor: form fields first, free text as fallback, and records which fields came from text. */
export function extractListingRules(raw: RawListing): NormalizedListing | null {
  const text = normalizeFa(`${raw.title}\n${raw.description}`);
  const fromText: string[] = [];

  const slug = matchNeighborhood(raw.neighborhoodText) ?? matchNeighborhood(text);
  if (!slug) return null;

  let area = firstNumber(field(raw, "متراژ"));
  if (area == null) {
    area = extractArea(text);
    if (area != null) fromText.push("areaM2");
  }

  let rooms = firstNumber(field(raw, "اتاق", "تعداد اتاق"));
  if (rooms == null) {
    rooms = extractRooms(text);
    if (rooms != null) fromText.push("rooms");
  }

  let buildYear = firstNumber(field(raw, "ساخت", "سال ساخت"));
  if (buildYear == null) {
    buildYear = extractBuildYear(text);
    if (buildYear != null) fromText.push("buildYear");
  }

  let floor: number | undefined;
  let totalFloors: number | undefined;
  const floorField = field(raw, "طبقه");
  if (floorField) {
    const f = extractFloor(`طبقه ${normalizeFa(floorField)}`);
    floor = f.floor;
    totalFloors = f.total;
  } else {
    const f = extractFloor(text);
    floor = f.floor;
    totalFloors = f.total;
    if (floor != null) fromText.push("floor");
  }

  const deposit = parseToman(raw.priceText.deposit) ?? 0;
  const rent = parseToman(raw.priceText.rent) ?? 0;

  const amenityText = normalizeFa(`${field(raw, "ویژگی‌ها", "امکانات") ?? ""}`);
  const amenities = {} as Amenities;
  const words: [keyof Amenities, string][] = [
    ["parking", "پارکینگ"],
    ["elevator", "آسانسور"],
    ["storage", "انباری"],
    ["balcony", "بالکن|تراس|پاسیو"],
    ["renovated", "بازسازی"],
  ];
  for (const [k, w] of words) {
    const fromForm = amenityText ? hasAmenity(amenityText, w) : undefined;
    if (fromForm != null) amenities[k] = fromForm;
    else {
      const t = hasAmenity(text, w);
      amenities[k] = t ?? false;
      if (t) fromText.push(k);
    }
  }

  const convert = extractConvertibility(text, deposit, rent, raw.convertibleFlag);
  if (convert.mode === "text") fromText.push("convertible");

  const redFlags = extractRedFlags(text);
  const badges = raw.badges.map(normalizeFa).join(" ");
  const photoField = normalizeFa(field(raw, "تصاویر برای همین ملک است؟") ?? "");
  let realPhotos: NormalizedListing["realPhotos"] = "unknown";
  if (/عکس تزئینی|تصویر تزئینی/.test(badges) || /عکس(ها)? تزئینی|عکس نمونه|تصاویر نمونه/.test(text)) {
    realPhotos = "decorative";
    redFlags.push({ code: "decorative_photos", evidence: "عکس تزئینی" });
  } else if (photoField === "بله" || /عکس (واقعی|خود واحد|از خود واحد)|تصاویر واقعی/.test(text)) realPhotos = "yes";

  if ((deposit > 0 && deposit < 10_000_000 && rent < 1_000_000) || (deposit === 0 && rent > 0 && rent < 100_000)) {
    redFlags.push({ code: "placeholder_price", evidence: `${raw.priceText.deposit ?? ""} / ${raw.priceText.rent ?? ""}` });
  }
  if (/هم ?خونه|هم ?خانه|پارکینگ خودرو|انبار تجاری|مغازه|دفتر کار|اتاق اجاره ای/.test(normalizeFa(raw.title))) {
    redFlags.push({ code: "non_apartment", evidence: raw.title });
  }
  if (floor != null && floor >= 4 && !amenities.elevator) {
    redFlags.push({ code: "no_elevator_high_floor", evidence: `طبقه ${floor} بدون آسانسور` });
  }
  if (floor != null && floor < 0 && !redFlags.some((f) => f.code === "basement_unit")) {
    redFlags.push({ code: "basement_unit", evidence: `طبقه ${floor}` });
  }

  const geo = approxGeo(raw, slug);
  const keyFields = [area, rooms, buildYear, floor, deposit || rent ? 1 : undefined];
  const confidence = keyFields.filter((v) => v != null).length / keyFields.length - fromText.length * 0.02;

  return {
    id: raw.id,
    rawId: raw.id,
    source: raw.source,
    url: raw.url,
    title: raw.title,
    neighborhood: slug,
    areaM2: area ?? 0,
    rooms: rooms ?? 0,
    floor,
    totalFloors,
    buildYear,
    deposit,
    rent,
    convert,
    amenities,
    realPhotos,
    redFlags,
    advertiser: raw.advertiser,
    geo,
    nearestMetro: nearestMetro(geo.lat, geo.lng),
    imageHashes: raw.imageHashes,
    isSeed: raw.isSeed,
    postedAt: raw.postedAt,
    extraction: { method: "rules", confidence: Math.max(0.3, Math.round(confidence * 100) / 100), fieldsFromText: fromText },
  };
}