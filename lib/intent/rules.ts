import { DEFAULT_USER_RATE } from "../convert";
import { matchAllNeighborhoods } from "../geo";
import { AMOUNT_RE } from "../money";
import { finglishToFa, normalizeFa } from "../persian";
import { DEFAULT_WEIGHTS } from "../rank";
import type { AmenityKey, Household, MustKey, UserIntent, Weights } from "../types";

export const DEFAULT_INTENT: UserIntent = {
  cash: 2_000_000_000,
  maxRent: 40_000_000,
  userRate: DEFAULT_USER_RATE,
  neighborhoods: [],
  must: [],
  nice: [],
  weights: DEFAULT_WEIGHTS,
  parsedBy: "manual",
  rawQuery: "",
};

const RENT_CTX = /ماهی|ماهانه|ماهیانه|اجاره|کرایه|در ماه/;
const CASH_CTX = /نقد|رهن|ودیعه|پول|پس ?انداز|سرمایه|دارم|موجودی/;
const MUST_CTX = /لازم|حتما|حتماً|باید|ضروری|واجب|نیاز|میخوام|می خوام|داشته باشه|بدون .* نمی/;
const NICE_CTX = /ترجیحا|ترجیحاً|بهتره|اگه بشه|اگر بشه|اگه شد|اگر شد|خوبه|بد نیست/;

const AMENITY_WORDS: [AmenityKey, RegExp][] = [
  ["parking", /پارکینگ/],
  ["elevator", /آسانسور|اسانسور/],
  ["storage", /انباری/],
  ["balcony", /بالکن|تراس|پاسیو/],
  ["renovated", /بازسازی|نوسازی شده/],
];

const UNIT_MULT: Record<string, number> = {
  میلیارد: 1e9, ملیارد: 1e9, میلیون: 1e6, ملیون: 1e6, میل: 1e6, م: 1e6, هزار: 1e3,
};
const SMALL_WORDS: Record<string, number> = {
  یک: 1, دو: 2, سه: 3, چهار: 4, پنج: 5, شش: 6, هفت: 7, هشت: 8, نه: 9, ده: 10, پانزده: 15, بیست: 20, سی: 30,
  چهل: 40, پنجاه: 50, شصت: 60, هفتاد: 70, هشتاد: 80, نود: 90, صد: 100, پانصد: 500, نیم: 0.5,
};

interface Amount {
  value: number;
  ctx: "rent" | "cash" | null;
}

/**
 * Colloquial Tehran rent talk: "ماهی ۴۰ تومن" means 40 million, "۲ تا نقد" means 2 billion.
 * Unitless or "تومن" amounts are scaled by context and magnitude.
 */
function scaleColloquial(n: number, unit: string | undefined, ctx: Amount["ctx"]): number {
  if (unit && UNIT_MULT[unit]) return n * UNIT_MULT[unit];
  if (n >= 1_000_000) return n;
  if (ctx === "rent") return n * 1e6;
  if (ctx === "cash") return n < 50 ? n * 1e9 : n * 1e6;
  return n < 20 ? n * 1e9 : n * 1e6;
}

const NUM_WORD_RE = Object.keys(SMALL_WORDS).filter((w) => w !== "نیم").join("|");

/** Closest keyword wins: "۲ میلیارد نقد دارم، ماهی ۴۰" -> first is cash (word after), second is rent (word before). */
function contextOf(before: string, after: string): Amount["ctx"] {
  const b = before.trim().split(/\s+/).filter(Boolean).reverse().slice(0, 3);
  const a = after.trim().split(/\s+/).filter(Boolean).slice(0, 3);
  for (let i = 0; i < 3; i++) {
    for (const w of [b[i], a[i]]) {
      if (!w) continue;
      if (RENT_CTX.test(w)) return "rent";
      if (CASH_CTX.test(w)) return "cash";
    }
  }
  return null;
}

function amountsIn(rawClause: string): Amount[] {
  const clause = rawClause
    // "۲ میلیارد و ۵۰۰ (میلیون)" -> "2500 میلیون"
    .replace(/(\d+(?:\.\d+)?)\s*میلیارد\s*و\s*(\d+)\s*(?:میلیون)?/g, (_, b, m) => `${Number(b) * 1000 + Number(m)} میلیون`)
    // "دو و نیم میلیارد" / "2 و نیم میلیون" -> "2.5 میلیارد"
    .replace(new RegExp(`(\\d+|${NUM_WORD_RE})\\s*و\\s*نیم\\s*(میلیارد|میلیون)`, "g"), (_, n, u) => {
      const v = /\d/.test(n) ? Number(n) : SMALL_WORDS[n];
      return `${v + 0.5} ${u}`;
    });
  const matches = [...clause.matchAll(AMOUNT_RE)];
  const out: Amount[] = [];
  matches.forEach((m, i) => {
    const tok = m[1];
    const unit = m[2];
    const start = m.index ?? 0;
    const end = start + m[0].length;
    const after = clause.slice(end, matches[i + 1]?.index ?? clause.length);
    const before = clause.slice(i ? (matches[i - 1].index ?? 0) + matches[i - 1][0].length : 0, start);
    if (/^\s*(متر|متری|خواب|سال|طبقه|اتاق|دقیقه|نفر|تا خواب)/.test(clause.slice(end))) return;
    if (!unit && /^\d{4}$/.test(tok) && Number(tok) > 1300 && Number(tok) < 1500) return;
    const isWord = tok in SMALL_WORDS;
    if (isWord && !unit && !/^\s*(تا|تومن|تومان)/.test(after)) return;
    const n = isWord ? SMALL_WORDS[tok] : Number(tok.replace(/\//g, ".").replace(/,(?=\d{3}(\D|$))/g, "").replace(/,/g, "."));
    if (!Number.isFinite(n) || n === 0) return;
    const ctx = contextOf(before, after);
    const effUnit = unit === "تومن" || unit === "تومان" || unit === "ت" ? undefined : unit;
    out.push({ value: scaleColloquial(n, effUnit, ctx), ctx });
  });
  return out;
}

export function parseIntentRules(query: string, base: UserIntent = DEFAULT_INTENT): UserIntent {
  const q = normalizeFa(finglishToFa(normalizeFa(query)));
  const clauses = q.split(/[،؛;\n]|,(?!\d{3})|\.(?!\d)/).map((c) => c.trim()).filter(Boolean);

  let cash: number | undefined;
  let maxRent: number | undefined;
  const loose: number[] = [];
  const must = new Set<MustKey>();
  const nice = new Set<MustKey>();
  const w: Weights = { ...DEFAULT_WEIGHTS };

  for (const c of clauses) {
    for (const a of amountsIn(c)) {
      if (a.ctx === "rent" && maxRent == null) maxRent = a.value;
      else if (a.ctx === "cash" && cash == null) cash = a.value;
      else loose.push(a.value);
    }
    const isNice = NICE_CTX.test(c);
    for (const [k, re] of AMENITY_WORDS) {
      if (re.test(c) && !/(بدون|نمی خوام|لازم نیست|مهم نیست)/.test(c)) (isNice ? nice : must).add(k);
    }
    if (/مترو/.test(c)) {
      if (/حتما|حتماً|ضروری|باید/.test(c)) must.add("near_metro");
      else nice.add("near_metro");
      w.commute += 0.15;
    }
  }
  for (const v of loose.sort((a, b) => b - a)) {
    if (cash == null && v >= 200e6) cash = v;
    else if (maxRent == null && v < 200e6) maxRent = v;
  }

  const areaM = q.match(/(?:حداقل|بالای|بیشتر از|از)?\s*(\d{2,3})\s*(?:متر|متری)/);
  const roomsM = q.match(/(\d|یک|دو|سه|چهار)\s*(?:خواب|خوابه)/);
  const roomWord: Record<string, number> = { یک: 1, دو: 2, سه: 3, چهار: 4 };
  const ageM = q.match(/(?:زیر|کمتر از|حداکثر)\s*(\d{1,2})\s*سال/);

  let household: Household | undefined;
  if (/مجرد|دانشجو|تنها زندگی|تنهام/.test(q)) household = "single";
  else if (/زوج|متاهل|متأهل|تازه عروس|نامزد|همسرم/.test(q)) household = "couple";
  else if (/خانواده|بچه|فرزند/.test(q)) household = "family";

  if (/ارزون|ارزان|اقتصادی|کم هزینه|کمترین|صرفه/.test(q)) w.cost += 0.2;
  if (/مطمئن|امن|بی دردسر|واقعی|دردسر نداشته|گول نخورم/.test(q)) w.trust += 0.15;
  if (/منصفانه|زیر قیمت|زیر میانگین|می ارزه|ارزش/.test(q)) w.fairness += 0.15;
  if (/بزرگ|دلباز|نوساز|شیک|نورگیر|تمیز/.test(q)) w.fit += 0.15;

  return {
    ...base,
    cash: cash ?? base.cash,
    maxRent: maxRent ?? base.maxRent,
    neighborhoods: matchAllNeighborhoods(q),
    minArea: areaM ? Number(areaM[1]) : undefined,
    minRooms: roomsM ? (/\d/.test(roomsM[1]) ? Number(roomsM[1]) : roomWord[roomsM[1]]) : undefined,
    maxBuildAge: ageM ? Number(ageM[1]) : /نوساز|کلید نخورده/.test(q) ? 5 : undefined,
    must: [...must],
    nice: [...nice].filter((n) => !must.has(n)),
    household,
    weights: w,
    parsedBy: "rules",
    rawQuery: query,
  };
}
