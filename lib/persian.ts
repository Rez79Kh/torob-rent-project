const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export function toLatinDigits(s: string): string {
  return s.replace(/[۰-۹٠-٩]/g, (d) => {
    const i = FA_DIGITS.indexOf(d);
    return String(i >= 0 ? i : AR_DIGITS.indexOf(d));
  });
}

export function toPersianDigits(s: string | number): string {
  return String(s).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

/** Canonical form for matching: Persian letters, Latin digits, single spaces, no ZWNJ/diacritics. */
export function normalizeFa(s: string): string {
  return toLatinDigits(s)
    .replace(/ي/g, "ی")
    .replace(/ى/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/ة/g, "ه")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/\u200c/g, " ")
    .replace(/٬/g, ",")
    .replace(/٫/g, ".")
    .replace(/[ـ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const FINGLISH: [RegExp, string][] = [
  [/\bmilyard\b|\bmiliard\b|\bmilyard\b|\bbillion\b/g, "میلیارد"],
  [/\bmilion\b|\bmillion\b|\bmilioon\b|\bmil\b/g, "میلیون"],
  [/\btoman\b|\btomen\b|\btoomn\b|\btomn\b|\btmn\b/g, "تومن"],
  [/\bparking\b|\bparkin\b/g, "پارکینگ"],
  [/\basansor\b|\basanser\b|\belevator\b/g, "آسانسور"],
  [/\banbari\b|\bstorage\b/g, "انباری"],
  [/\bbalkon\b|\bbalcony\b/g, "بالکن"],
  [/\bmetro\b|\bmetroo\b/g, "مترو"],
  [/\bnazdik\b/g, "نزدیک"],
  [/\brahn\b|\bvadie\b|\bvadieh\b/g, "رهن"],
  [/\bejare\b|\bejareh\b|\bkerayeh\b|\bkeraye\b/g, "اجاره"],
  [/\bnaghd\b|\bnaqd\b|\bcash\b/g, "نقد"],
  [/\bmahi\b|\bmahane\b|\bmonthly\b/g, "ماهی"],
  [/\bdaram\b/g, "دارم"],
  [/\bta\b/g, "تا"],
  [/\bmojarad\b|\bmojarrad\b|\bsingle\b/g, "مجرد"],
  [/\bzoj\b|\bzog\b|\bcouple\b/g, "زوج"],
  [/\bkhanevade\b|\bfamily\b/g, "خانواده"],
  [/\bkhab\b|\bkhabe\b/g, "خواب"],
  [/\bmetr\b|\bmetri\b/g, "متر"],
  [/\bnosaz\b/g, "نوساز"],
  [/\bpunak\b|\bpoonak\b/g, "پونک"],
  [/\bsadeghiye\b|\bsadeghieh\b|\bsadeghiyeh\b/g, "صادقیه"],
  [/\bsaadat ?abad\b|\bsaadatabad\b/g, "سعادت آباد"],
  [/\btehranpars\b|\btehran pars\b/g, "تهرانپارس"],
  [/\byousef ?abad\b|\byusef ?abad\b|\byousefabad\b/g, "یوسف آباد"],
];

export function finglishToFa(s: string): string {
  let out = s.toLowerCase();
  for (const [re, fa] of FINGLISH) out = out.replace(re, fa);
  return out;
}

export function tokenize(s: string): string[] {
  return normalizeFa(s)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}
