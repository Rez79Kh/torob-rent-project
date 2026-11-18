/**
 * Writes data/seed-raw.json: Divar/Sheypoor/Kilid-style raw posts for five Tehran neighborhoods at Aban 1405 prices.
 * Deterministic (fixed PRNG seed) so the dataset is reproducible and reviewable.
 * It deliberately plants: agency reposts of the same unit, convertibility mentioned only in text,
 * owner-specific conversion rates, decorative photos, placeholder-price bait, and household/parking/eviction traps.
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { toPersianDigits } from "../lib/persian";
import type { RawListing, Source } from "../lib/types";

let s = 20261119;
function rand(): number {
  s |= 0;
  s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T,>(a: T[]): T => a[Math.floor(rand() * a.length)];
const chance = (p: number) => rand() < p;
const between = (a: number, b: number) => a + rand() * (b - a);
const int = (a: number, b: number) => Math.floor(between(a, b + 1));
const fa = (n: number | string) => toPersianDigits(n);

/** Market cost per m² per month (rent + 3% of deposit), Aban 1405. */
const HOODS = [
  { slug: "punak", perM2: 1_000_000, subs: ["پونک", "پونک جنوبی", "پونک شمالی", "میدان پونک", "پونک عدل"], areas: [55, 120] },
  { slug: "sadeghiyeh", perM2: 950_000, subs: ["صادقیه", "فلکه دوم صادقیه", "فلکه اول صادقیه", "آریاشهر", "ستارخان غربی"], areas: [50, 115] },
  { slug: "saadat-abad", perM2: 1_350_000, subs: ["سعادت آباد", "میدان کاج", "سرو غربی", "علامه طباطبایی", "سعادت‌آباد"], areas: [70, 170] },
  { slug: "tehranpars", perM2: 750_000, subs: ["تهرانپارس", "فلکه اول تهرانپارس", "فلکه دوم تهرانپارس", "تهرانپارس، رشید", "تهرانپارس، جشنواره"], areas: [50, 130] },
  { slug: "yousef-abad", perM2: 1_250_000, subs: ["یوسف آباد", "یوسف‌آباد", "اسدآبادی", "میدان سلماس", "یوسف‌آباد، خیابان ۲۰"], areas: [55, 140] },
] as const;

const AGENCIES = [
  "املاک دلاوران", "مشاورین املاک آشیان", "املاک پارسیان", "مسکن نگین", "املاک کاج", "مشاور املاک امین",
  "املاک بهار", "مسکن فرهنگیان", "املاک الماس شرق", "املاک ستاره غرب", "دفتر املاک ایرانیان", "املاک یاس",
  "مسکن آریا", "املاک سرو", "مشاورین املاک کیان", "املاک مهرگان",
];
const AGENTS = ["زارعی", "محمدی", "رضایی", "کریمی", "حسینی", "احمدی", "موسوی", "جعفری", "صادقی", "نوری"];

const FACTS = [
  "نورگیر عالی", "کابینت هایگلاس", "کف سرامیک", "کف پارکت", "شوفاژ و پکیج", "داکت اسپلیت", "کولر آبی",
  "آیفون تصویری", "درب ضد سرقت", "کمد دیواری", "سرویس فرنگی", "حمام و دستشویی جدا", "لابی", "روف گاردن",
  "دو نبش", "جنوبی آفتابگیر", "شمالی", "کوچه آرام", "نزدیک پارک", "دسترسی عالی به بزرگراه", "بالکن دلباز",
  "آشپزخانه اوپن", "هود و گاز صفحه ای", "سیستم اعلام حریق", "سرایدار", "استخر و سونا",
];
const GREETINGS = ["به نام خدا", "✨عرض ادب و احترام✨", "🌸 سلام وقت بخیر 🌸", "⚜️ فایل اختصاصی ⚜️", "🔴 فوری 🔴", "💎 فرصت استثنایی 💎", ""];
const CLOSINGS = [
  "برای هماهنگی بازدید تماس بگیرید.",
  "✨همراه شما از اولین بازدید تا پای قرارداد✨",
  "مشاوره رایگان، بازدید با هماهنگی.",
  "جهت بازدید فقط تماس، به چت پاسخ داده نمی‌شود.",
  "فایل‌های بیشتر در دفتر موجود است.",
];

interface Unit {
  key: string;
  hood: (typeof HOODS)[number];
  sub: string;
  area: number;
  rooms: number;
  floor: number;
  totalFloors: number;
  year: number;
  amen: { parking: boolean; elevator: boolean; storage: boolean; balcony: boolean; renovated: boolean };
  facts: string[];
  marketCost: number;
  photoHashes: string[];
  flags: string[];
  convert: "none" | "form" | "text-cap" | "text-full" | "text-rate" | "explicit-no";
  ownerRate: number;
}

function hex16(): string {
  let h = "";
  for (let i = 0; i < 16; i++) h += "0123456789abcdef"[int(0, 15)];
  return h;
}
function flipBits(h: string, n: number): string {
  const arr = h.split("");
  for (let i = 0; i < n; i++) {
    const p = int(0, 15);
    arr[p] = ((parseInt(arr[p], 16) ^ (1 << int(0, 3))) & 15).toString(16);
  }
  return arr.join("");
}

function makeUnit(i: number, hood: (typeof HOODS)[number]): Unit {
  const area = int(hood.areas[0], hood.areas[1]);
  const rooms = area < 60 ? 1 : area < 100 ? 2 : area < 140 ? pick([2, 3]) : 3;
  const totalFloors = pick([3, 4, 4, 5, 5, 6, 7, 8, 10]);
  const floor = chance(0.06) ? -1 : int(0, totalFloors);
  const year = chance(0.15) ? int(1402, 1404) : chance(0.5) ? int(1390, 1401) : int(1375, 1389);
  const age = 1405 - year;
  const amen = {
    parking: chance(age < 15 ? 0.9 : 0.55),
    elevator: totalFloors >= 5 ? chance(0.92) : chance(0.35),
    storage: chance(0.7),
    balcony: chance(0.55),
    renovated: age > 15 && chance(0.4),
  };
  const facts = Array.from(new Set(Array.from({ length: int(3, 6) }, () => pick(FACTS))));
  // Price: neighborhood base × age × amenities × noise, with planted gems and overpriced bait.
  let mult = 1 + (age < 5 ? 0.15 : age < 15 ? 0.03 : -0.12) + (amen.parking ? 0.04 : -0.04) + (amen.elevator ? 0.03 : -0.03);
  mult *= between(0.88, 1.12);
  if (i % 17 === 3) mult *= 0.8;
  if (i % 19 === 7) mult *= 1.3;
  const marketCost = Math.round((hood.perM2 * area * mult) / 1e6) * 1e6;

  const flags: string[] = [];
  if (chance(0.12)) flags.push("family_only");
  if (chance(0.05)) flags.push("no_single");
  if (amen.parking && chance(0.12)) flags.push("mozahem_parking");
  if (chance(0.1)) flags.push("evict");
  if (chance(0.06)) flags.push("commission");
  if (chance(0.04)) flags.push("short");

  const r = rand();
  const convert: Unit["convert"] =
    r < 0.32 ? "form" : r < 0.4 ? "text-cap" : r < 0.45 ? "text-full" : r < 0.49 ? "text-rate" : r < 0.56 ? "explicit-no" : "none";
  const ownerRate = convert === "text-rate" ? pick([0.025, 0.035, 0.04]) : convert === "text-full" ? pick([0.025, 0.02]) : 0.03;

  return {
    key: `${hood.slug}-${i}`,
    hood,
    sub: pick([...hood.subs]),
    area,
    rooms,
    floor,
    totalFloors,
    year,
    amen,
    facts,
    marketCost,
    photoHashes: Array.from({ length: int(4, 9) }, hex16),
    flags,
    convert,
    ownerRate,
  };
}

function round(n: number, step: number) {
  return Math.max(0, Math.round(n / step) * step);
}

function priceSplit(cost: number): { deposit: number; rent: number } {
  const style = rand();
  if (style < 0.1) return { deposit: round(cost / 0.03, 100e6), rent: 0 }; // رهن کامل
  const share = style < 0.45 ? between(0.2, 0.45) : style < 0.85 ? between(0.45, 0.75) : between(0.75, 0.92);
  const deposit = round((cost * share) / 0.03, 50e6);
  const rent = round(cost - deposit * 0.03, 1e6);
  return { deposit: Math.max(deposit, 100e6), rent: Math.max(rent, 0) };
}

function priceText(v: number, style: "comma" | "words"): string {
  if (style === "comma") return `${fa(v.toLocaleString("en-US"))} تومان`;
  if (v >= 1e9) return `${fa(String(Math.round((v / 1e9) * 100) / 100))} میلیارد`;
  return `${fa(String(Math.round(v / 1e6)))} میلیون`;
}

const floorWord = (f: number) =>
  f < 0 ? "زیرهمکف" : f === 0 ? "همکف" : ["", "اول", "دوم", "سوم", "چهارم", "پنجم", "ششم", "هفتم", "هشتم", "نهم", "دهم"][f] ?? `${fa(f)}`;
const roomsWord = (r: number) => (r === 0 ? "سوئیت" : `${["", "یک", "دو", "سه", "چهار"][r]} خواب`);

function flagLines(u: Unit): string[] {
  const out: string[] = [];
  for (const f of u.flags) {
    if (f === "family_only") out.push(pick(["فقط به خانواده محترم اجاره داده می‌شود.", "مخصوص خانواده، به مجرد داده نمی‌شود."]));
    if (f === "no_single") out.push("به مجرد اجاره داده نمی‌شود.");
    if (f === "mozahem_parking") out.push(pick(["پارکینگ مزاحم دار", "پارکینگ پشت سر هم (مزاحم دارد)"]));
    if (f === "evict") out.push(pick(["تخلیه آخر آذر", "تخلیه پایان ماه", "تخلیه اواسط دی"]));
    if (f === "commission") out.push("کمیسیون جداگانه طبق تعرفه اتحادیه.");
    if (f === "short") out.push("قرارداد شش ماهه، قابل تمدید.");
  }
  return out;
}

function convertLine(u: Unit, deposit: number, rent: number): string | null {
  const cap = deposit + rent / u.ownerRate;
  switch (u.convert) {
    case "text-cap":
      return pick([`ودیعه قابل تبدیل تا ${priceText(round(Math.min(cap, deposit + (cap - deposit) * between(0.5, 1)), 100e6), "words")}`, `رهن و اجاره قابل جابجایی (تبدیل تا ${priceText(round(cap * 0.9, 100e6), "words")})`]);
    case "text-full":
      return `یا رهن کامل ${priceText(round(cap, 50e6), "words")}`;
    case "text-rate":
      return `قابل تبدیل، هر ۱۰۰ میلیون ${fa(String(u.ownerRate * 100))} میلیون`;
    case "explicit-no":
      return pick(["غیر قابل تبدیل", "مبلغ رهن و اجاره قابل تبدیل نیست."]);
    default:
      return null;
  }
}

function writeRaw(u: Unit, opts: {
  id: string; source: Source; agency?: string; owner?: boolean; priceMult: number; decorative?: boolean;
  postedDaysAgo: number; omitForm?: boolean; photoNoise: number;
}): RawListing {
  const cost = round(u.marketCost * opts.priceMult, 1e6);
  const { deposit, rent } = priceSplit(cost);
  const owner = !!opts.owner;
  const agency = opts.agency ?? pick(AGENCIES);

  const titleStyles = [
    () => `${fa(u.area)} متر ${roomsWord(u.rooms)} ${u.sub}`,
    () => `${u.sub}/${fa(u.area)}متر/${roomsWord(u.rooms)}/${u.year >= 1402 ? "نوساز" : "خوش‌نقشه"}${chance(0.3) ? "/عکس واقعی" : ""}`,
    () => `رهن و اجاره ${fa(u.area)} متری ${u.sub} ${u.amen.parking ? "پارکینگ دار" : ""}`.trim(),
    () => `آپارتمان ${roomsWord(u.rooms)} ${u.sub} طبقه ${floorWord(u.floor)}`,
    () => `${u.year >= 1402 ? "کلید نخورده" : "تمیز"} ${fa(u.area)}متر ${u.sub}`,
  ];
  const title = owner ? `${fa(u.area)} متری ${u.sub} از مالک بدون واسطه` : pick(titleStyles)();

  const amenWords: string[] = [];
  if (u.amen.parking) amenWords.push("پارکینگ");
  if (u.amen.storage) amenWords.push("انباری");
  if (u.amen.elevator) amenWords.push("آسانسور");
  if (u.amen.balcony) amenWords.push("بالکن");
  if (u.amen.renovated) amenWords.push("بازسازی شده");

  const facts = [...u.facts].sort(() => rand() - 0.5).slice(0, Math.max(2, u.facts.length - int(0, 1)));
  const lines: string[] = [];
  if (!owner) lines.push(pick(GREETINGS));
  lines.push(`${fa(u.area)} متر، ${roomsWord(u.rooms)}، طبقه ${floorWord(u.floor)} از ${fa(u.totalFloors)}`);
  if (opts.omitForm || chance(0.5)) lines.push(`ساخت ${fa(u.year)}`);
  lines.push(amenWords.length ? `${amenWords.join(" و ")}` : "بدون پارکینگ");
  if (!u.amen.elevator && u.totalFloors >= 4) lines.push("آسانسور ندارد");
  lines.push(facts.join("، "));
  lines.push(...flagLines(u));
  const cl = convertLine(u, deposit, rent);
  if (cl) lines.push(cl);
  if (u.flags.includes("evict") === false && chance(0.2)) lines.push("آماده تحویل");
  if (owner) lines.push(pick(["مالک هستم، املاک تماس نگیرد.", "فقط مستاجر واقعی، مشاور املاک نیاید."]));
  else lines.push(pick(CLOSINGS), `مشاور: ${pick(AGENTS)}`);

  const formFields: Record<string, string> = {};
  if (!opts.omitForm) {
    formFields["متراژ"] = fa(u.area);
    formFields["اتاق"] = fa(u.rooms);
    if (opts.source !== "sheypoor") {
      if (chance(0.85)) formFields["ساخت"] = fa(u.year);
      formFields["طبقه"] = `${fa(u.floor)} از ${fa(u.totalFloors)}`;
      const feat = [u.amen.elevator ? "آسانسور" : "آسانسور ندارد", u.amen.parking ? "پارکینگ" : "پارکینگ ندارد", u.amen.storage ? "انباری" : "انباری ندارد"];
      formFields["ویژگی‌ها"] = feat.join("، ");
      if (opts.source === "divar") formFields["تصاویر برای همین ملک است؟"] = opts.decorative ? "خیر" : chance(0.6) ? "بله" : "";
    }
  }

  const badges: string[] = [];
  if (opts.decorative) badges.push("عکس تزئینی");
  if (!owner && chance(0.25)) badges.push(pick(["نردبان شده", "پله شده"]));

  const style = opts.source === "divar" ? "comma" : pick(["comma", "words"] as const);
  const posted = new Date(Date.UTC(2026, 10, 18) - opts.postedDaysAgo * 86400000).toISOString();

  return {
    id: opts.id,
    source: opts.source,
    url: "",
    title,
    description: lines.filter(Boolean).join("\n"),
    priceText: { deposit: priceText(deposit, style), rent: rent === 0 ? "رهن کامل" : priceText(rent, style) },
    formFields,
    badges,
    convertibleFlag: opts.source === "divar" && u.convert === "form" ? true : undefined,
    advertiser: owner ? { kind: "owner" } : { kind: "agency", name: agency, activeAds: int(12, 240) },
    neighborhoodText: u.sub,
    imageHashes: opts.decorative ? [hex16(), hex16()] : u.photoHashes.map((h) => flipBits(h, opts.photoNoise)).slice(0, int(3, u.photoHashes.length)),
    postedAt: posted,
    fetchedAt: "2026-11-18T20:00:00.000Z",
    isSeed: true,
  };
}

function main() {
  const out: RawListing[] = [];
  let id = 0;
  const nextId = (src: Source) => `${src}-${String(++id).padStart(4, "0")}`;

  // One real snapshot from Divar (observed 1405/08/27) to anchor price levels.
  out.push({
    id: "divar-gaxPcvmg",
    source: "divar",
    url: "https://divar.ir/v/%DB%B8%DB%B0%D9%85%D8%AA%D8%B1-%D8%AF%D9%88-%D8%AE%D9%88%D8%A7%D8%A8-%D8%AE%D9%88%D8%B4-%D9%86%D9%82%D8%B4%D9%87-%D8%B4%D8%AE%D8%B5%DB%8C-%D8%AA%D8%A7%D9%BE-%D9%84%D9%88%DA%A9%DB%8C%D8%B4%D9%86-%D8%B9%DA%A9%D8%B3-%D9%88%D8%A7%D9%82%D8%B9%DB%8C/gaxPcvmg",
    token: "gaxPcvmg",
    title: "۸۰متر دو خواب/خوش‌نقشه/شخصی/تاپ لوکیشن‌/عکس واقعی",
    description:
      "به نام خدا\n✨عرض ادب و احترام✨\nپر باشید از عشق\n⚜️پونک عدل | دوخواب خوش‌نقشه با پاسیو اختصاصی⚜️\n۸۰ متر، دو خواب\nطبقه اول، پارکینگ و انباری\nساختمان دارای لابی\nسالن پرده‌خور، فضای داخلی تمیز و مرتب\nواحدی خوش‌نقشه با فضای اختصاصی و امکانات کامل، آماده بازدید و سکونت.\n✨همراه شما از اولین بازدید تا پای قرارداد✨\n(برای مشاوره و اجاره ملک مد نظرتون، تماس بگیرید.)\nمشاور امین شما : زارعی",
    priceText: { deposit: "۸۰۰,۰۰۰,۰۰۰ تومان", rent: "۶۰,۰۰۰,۰۰۰ تومان" },
    formFields: { متراژ: "۸۰", ساخت: "۱۳۹۱", اتاق: "۲", طبقه: "۱ از ۵", "ویژگی‌ها": "آسانسور ندارد، پارکینگ، انباری", "تصاویر برای همین ملک است؟": "بله" },
    badges: ["پله شده"],
    convertibleFlag: true,
    advertiser: { kind: "agency", name: "املاک دلاوران", activeAds: 188 },
    neighborhoodText: "پونک",
    approxLocation: { lat: 35.7612, lng: 51.3341, radiusM: 500 },
    postedAt: "2026-11-09T14:00:00.000Z",
    fetchedAt: "2026-11-18T20:00:00.000Z",
    isSeed: false,
  });

  const units: Unit[] = [];
  HOODS.forEach((h, hi) => {
    for (let k = 0; k < 22; k++) units.push(makeUnit(hi * 100 + k, h));
  });

  units.forEach((u, idx) => {
    const isDupCluster = idx % 6 === 1; // ~18 units reposted by several agencies
    const decorative = idx % 23 === 5;
    const src: Source = chance(0.7) ? "divar" : chance(0.6) ? "sheypoor" : "kilid";
    out.push(
      writeRaw(u, {
        id: nextId(src), source: src, priceMult: 1, decorative, postedDaysAgo: int(0, 20),
        omitForm: src !== "divar" && chance(0.3), photoNoise: 0,
      }),
    );
    if (isDupCluster) {
      const copies = int(1, 3);
      const used = new Set<string>();
      for (let c = 0; c < copies; c++) {
        let agency = pick(AGENCIES);
        while (used.has(agency)) agency = pick(AGENCIES);
        used.add(agency);
        const csrc: Source = pick(["divar", "divar", "sheypoor", "kilid"]);
        const ownerCopy = c === 0 && idx % 4 === 1;
        out.push(
          writeRaw(u, {
            id: nextId(csrc), source: csrc, agency, owner: ownerCopy,
            priceMult: ownerCopy ? between(0.9, 0.96) : between(1.0, 1.14),
            postedDaysAgo: int(0, 25), omitForm: csrc !== "divar" && chance(0.4), photoNoise: int(0, 2),
          }),
        );
      }
    }
  });

  // Noise and bait that a naive aggregator would show at the top of a cheapest-first list.
  const noise: Partial<RawListing>[] = [
    { title: "هم خونه خانم رایگان و موجه", priceText: { deposit: "۱,۰۰۰ تومان", rent: "۱,۰۰۰ تومان" }, neighborhoodText: "صادقیه", description: "یک اتاق در آپارتمان دو خوابه برای خانم شاغل و موجه" },
    { title: "پارکینگ خودرو", priceText: { deposit: "رایگان", rent: "۴,۰۰۰,۰۰۰ تومان" }, neighborhoodText: "یوسف آباد", description: "پارکینگ مسقف برای یک خودرو" },
    { title: "آپارتمان ۹۰ متری تهرانپارس قیمت توافقی", priceText: { deposit: "۱,۰۰۰ تومان", rent: "۱,۰۰۰ تومان" }, neighborhoodText: "تهرانپارس", description: "۹۰ متر دو خواب. قیمت در تماس. ⛔️ فقط تماس" },
    { title: "اتاق اجاره ای مجردی پونک", priceText: { deposit: "۵۰ میلیون", rent: "۸ میلیون" }, neighborhoodText: "پونک", description: "اتاق با سرویس مشترک" },
  ];
  for (const n of noise) {
    out.push({
      id: nextId("divar"), source: "divar", url: "", title: "", description: "", priceText: {}, formFields: {}, badges: [],
      advertiser: { kind: "owner" }, neighborhoodText: "", postedAt: "2026-11-18T10:00:00.000Z", fetchedAt: "2026-11-18T20:00:00.000Z", isSeed: true,
      ...n,
    } as RawListing);
  }

  const file = path.join(process.cwd(), "data", "seed-raw.json");
  writeFileSync(file, JSON.stringify(out, null, 1));
  console.log(`wrote ${out.length} raw listings to ${file}`);
}

main();
