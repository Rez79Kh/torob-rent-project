import { normalizeFa, toPersianDigits } from "./persian";
import type { Toman } from "./types";

const UNIT: Record<string, number> = {
  میلیارد: 1e9,
  ملیارد: 1e9,
  م: 1e6,
  میلیون: 1e6,
  ملیون: 1e6,
  میل: 1e6,
  تومن: 1,
  تومان: 1,
  ت: 1,
  هزار: 1e3,
};

const WORD_NUM: Record<string, number> = {
  یک: 1, دو: 2, سه: 3, چهار: 4, پنج: 5, شش: 6, هفت: 7, هشت: 8, نه: 9, ده: 10,
  یازده: 11, دوازده: 12, پانزده: 15, بیست: 20, سی: 30, چهل: 40, پنجاه: 50,
  شصت: 60, هفتاد: 70, هشتاد: 80, نود: 90, صد: 100, دویست: 200, سیصد: 300,
  چهارصد: 400, پانصد: 500, ششصد: 600, هفتصد: 700, هشتصد: 800, نهصد: 900,
  نیم: 0.5,
};

export const AMOUNT_RE =
  /(\d+(?:[.,/]\d+)*|(?<![\p{L}])(?:یک|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده|یازده|دوازده|پانزده|بیست|سی|چهل|پنجاه|شصت|هفتاد|هشتاد|نود|صد|دویست|سیصد|چهارصد|پانصد|ششصد|هفتصد|هشتصد|نهصد|نیم)(?![\p{L}]))\s*(میلیارد|ملیارد|میلیون|ملیون|میل|هزار|تومان|تومن|م(?![\p{L}])|ت(?![\p{L}]))?/gu;

function parseNumberToken(tok: string): number {
  if (tok in WORD_NUM) return WORD_NUM[tok];
  // "1.5", "1/5" are decimals; "800,000,000" is grouping.
  if (/^\d{1,3}(,\d{3})+$/.test(tok)) return Number(tok.replace(/,/g, ""));
  return Number(tok.replace(/[/,]/g, "."));
}

/** Parse a Persian price phrase such as "۸۰۰ میلیون", "۱.۵ میلیارد", "800,000,000 تومان", "رهن کامل". */
export function parseToman(input: string | undefined | null): Toman | null {
  if (!input) return null;
  const s = normalizeFa(input);
  if (/رایگان|توافقی|مجانی/.test(s)) return 0;
  if (/رهن کامل|اجاره ندارد|بدون اجاره/.test(s)) return 0;
  let total = 0;
  let found = false;
  for (const m of s.matchAll(AMOUNT_RE)) {
    const n = parseNumberToken(m[1]);
    if (!Number.isFinite(n)) continue;
    const unit = m[2] ? UNIT[m[2]] ?? 1 : 1;
    total += n * unit;
    found = true;
  }
  return found ? Math.round(total) : null;
}

/** Short Persian formatting: 2_800_000_000 → "۲٫۸ میلیارد", 60_000_000 → "۶۰ میلیون". */
export function fmtToman(v: Toman, opts: { unit?: boolean } = {}): string {
  const unit = opts.unit ?? true;
  const abs = Math.abs(v);
  let out: string;
  if (abs >= 1e9) out = `${trim(v / 1e9)} میلیارد`;
  else if (abs >= 1e6) out = `${trim(v / 1e6)} میلیون`;
  else if (abs >= 1e3) out = `${trim(v / 1e3)} هزار`;
  else out = `${Math.round(v)}`;
  return toPersianDigits(out).replace(/\./g, "٫") + (unit ? " تومان" : "");
}

function trim(n: number): string {
  const r = Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 10) / 10;
  return String(r);
}

export function fmtPct(p: number): string {
  return toPersianDigits(`${Math.abs(Math.round(p))}٪`);
}
