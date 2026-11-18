/**
 * Live Divar ingestion for the five MVP neighborhoods -> data/raw.json (then run `npm run data`).
 *
 *   npm run ingest                      # all neighborhoods, ~60 posts each
 *   npm run ingest -- --limit 20 punak  # quick run
 *
 * Polite by design: one request every ~1.5s with jitter, exponential backoff on 429/5xx,
 * resumable checkpoint (data/.ingest-checkpoint.json). Divar often returns 502 to datacenter and
 * some residential IPs; the app never depends on this script succeeding, data/seed-raw.json is the fallback.
 * Photo dHashes are computed when the optional `sharp` package is installed (npm i -D sharp).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { RawListing } from "../lib/types";

const SEARCH_URL = "https://api.divar.ir/v8/postlist/w/search";
const POST_URL = (token: string) => `https://api.divar.ir/v8/posts-v2/web/${token}`;
const DISTRICTS: Record<string, string> = {
  punak: "punak",
  sadeghiyeh: "sadeghiyeh",
  "saadat-abad": "saadat-abad",
  tehranpars: "tehranpars-west",
  "yousef-abad": "yousef-abad",
};

const DATA = path.join(process.cwd(), "data");
const OUT = path.join(DATA, "raw.json");
const CHECKPOINT = path.join(DATA, ".ingest-checkpoint.json");
const HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36",
  Origin: "https://divar.ir",
  Referer: "https://divar.ir/",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const polite = () => sleep(1500 + Math.random() * 700);

async function request(url: string, init: RequestInit, attempt = 0): Promise<unknown> {
  const res = await fetch(url, { ...init, headers: HEADERS, signal: AbortSignal.timeout(15000) }).catch((e) => {
    if (attempt < 4) return null;
    throw e;
  });
  if (res && res.ok) return res.json();
  const status = res?.status ?? 0;
  if (attempt < 4 && (status === 0 || status === 429 || status >= 500)) {
    const wait = 2000 * 2 ** attempt + Math.random() * 1000;
    console.warn(`  ${status || "network"} on ${url.slice(0, 60)}… retry in ${Math.round(wait / 1000)}s`);
    await sleep(wait);
    return request(url, init, attempt + 1);
  }
  throw new Error(`HTTP ${status} for ${url}`);
}

/** Walk any JSON tree; Divar's widget schema changes often, so we search by shape instead of hard-coding paths. */
function walk(node: unknown, visit: (obj: Record<string, unknown>) => void) {
  if (Array.isArray(node)) node.forEach((n) => walk(n, visit));
  else if (node && typeof node === "object") {
    visit(node as Record<string, unknown>);
    Object.values(node).forEach((v) => walk(v, visit));
  }
}

async function searchTokens(district: string, limit: number): Promise<string[]> {
  const tokens = new Set<string>();
  let pagination: unknown = undefined;
  for (let page = 0; page < 10 && tokens.size < limit; page++) {
    const body = {
      city_ids: ["1"],
      ...(pagination ? { pagination_data: pagination } : {}),
      search_data: {
        form_data: {
          data: {
            category: { str: { value: "apartment-rent" } },
            districts: { repeated_string: { value: [district] } },
          },
        },
      },
    };
    const json = (await request(SEARCH_URL, { method: "POST", body: JSON.stringify(body) })) as Record<string, unknown>;
    const before = tokens.size;
    walk(json.list_widgets ?? json, (o) => {
      if (typeof o.token === "string" && /^[A-Za-z0-9_-]{8}$/.test(o.token)) tokens.add(o.token);
    });
    pagination = (json.pagination as Record<string, unknown> | undefined)?.data;
    if (tokens.size === before || !pagination) break;
    await polite();
  }
  return [...tokens].slice(0, limit);
}

async function dHashFromUrl(url: string): Promise<string | null> {
  try {
    const mod = await import(/* webpackIgnore: true */ "sharp" as string).catch(() => null);
    if (!mod) return null;
    const sharp = (mod.default ?? mod) as (buf: Buffer) => {
      grayscale(): { resize(w: number, h: number, o: object): { raw(): { toBuffer(): Promise<Buffer> } } };
    };
    const buf = Buffer.from(await (await fetch(url, { signal: AbortSignal.timeout(10000) })).arrayBuffer());
    const px = await sharp(buf).grayscale().resize(9, 8, { fit: "fill" }).raw().toBuffer();
    let bits = "";
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += px[y * 9 + x] > px[y * 9 + x + 1] ? "1" : "0";
    return BigInt(`0b${bits}`).toString(16).padStart(16, "0");
  } catch {
    return null;
  }
}

async function fetchPost(token: string, neighborhoodSlug: string): Promise<RawListing> {
  const json = (await request(POST_URL(token), { method: "GET" })) as Record<string, unknown>;
  const fields: Record<string, string> = {};
  const badges = new Set<string>();
  const images: string[] = [];
  let title = "";
  let description = "";
  let lat: number | undefined;
  let lng: number | undefined;
  let district = "";
  let agencyName: string | undefined;
  let activeAds: number | undefined;
  let convertible = false;

  walk(json, (o) => {
    const wt = typeof o.widget_type === "string" ? o.widget_type : "";
    const data = (o.data ?? {}) as Record<string, unknown>;
    if (wt === "LEGEND_TITLE_ROW" && typeof data.title === "string") title ||= data.title;
    if (wt === "DESCRIPTION_ROW" && typeof data.text === "string") description ||= data.text;
    if (typeof o.title === "string" && (typeof o.value === "string" || typeof o.value === "number")) {
      fields[o.title.trim()] ??= String(o.value);
    }
    if (typeof o.latitude === "number" && typeof o.longitude === "number") {
      lat ??= o.latitude;
      lng ??= o.longitude;
    }
    if (typeof o.url === "string" && /divarcdn\.com\/.*\.(jpg|webp)/.test(o.url) && images.length < 8) images.push(o.url);
    for (const v of Object.values(o)) {
      if (typeof v !== "string") continue;
      if (/عکس تزئینی|تصویر تزئینی/.test(v)) badges.add("عکس تزئینی");
      if (/نردبان شده/.test(v)) badges.add("نردبان شده");
      if (/پله شده/.test(v)) badges.add("پله شده");
      if (/قابل تبدیل است/.test(v)) convertible = true;
      const ads = v.match(/([۰-۹\d]+)\s*آگهی فعال/);
      if (ads) activeAds = Number(ads[1].replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))));
    }
  });

  const seo = (json.seo ?? {}) as Record<string, unknown>;
  title ||= typeof seo.title === "string" ? seo.title : "";
  const web = (json.webengage ?? json.analytics ?? {}) as Record<string, unknown>;
  district = typeof web.district === "string" ? web.district : neighborhoodSlug;
  if (typeof web.business_type === "string" && web.business_type !== "personal") agencyName = fields["آژانس املاک"] ?? fields["مشاور املاک"];

  const imageHashes = (await Promise.all(images.slice(0, 5).map(dHashFromUrl))).filter((h): h is string => !!h);
  const deposit = fields["ودیعه"] ?? fields["رهن"];
  const rent = fields["اجارهٔ ماهانه"] ?? fields["اجاره"] ?? fields["اجارهٔ ماهیانه"];

  return {
    id: `divar-${token}`,
    source: "divar",
    url: `https://divar.ir/v/${token}`,
    token,
    title,
    description,
    priceText: { deposit, rent },
    formFields: fields,
    badges: [...badges],
    convertibleFlag: convertible || undefined,
    advertiser: agencyName || activeAds ? { kind: "agency", name: agencyName, activeAds } : { kind: "owner" },
    neighborhoodText: district,
    approxLocation: lat && lng ? { lat, lng, radiusM: 500 } : undefined,
    imageHashes: imageHashes.length ? imageHashes : undefined,
    postedAt: new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
    isSeed: false,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : 60;
  const only = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--limit");
  const slugs = only.length ? only : Object.keys(DISTRICTS);

  const checkpoint: { done: string[] } = existsSync(CHECKPOINT) ? JSON.parse(readFileSync(CHECKPOINT, "utf8")) : { done: [] };
  const out: RawListing[] = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : [];
  const have = new Set(out.map((r) => r.token));

  for (const slug of slugs) {
    console.log(`\n${slug}: searching…`);
    let tokens: string[] = [];
    try {
      tokens = await searchTokens(DISTRICTS[slug] ?? slug, limit);
    } catch (e) {
      console.error(`  search failed: ${(e as Error).message}. Divar may be blocking this IP; the seed dataset remains in use.`);
      continue;
    }
    console.log(`  ${tokens.length} posts`);
    for (const t of tokens) {
      if (have.has(t) || checkpoint.done.includes(t)) continue;
      try {
        await polite();
        const raw = await fetchPost(t, slug);
        out.push(raw);
        have.add(t);
        checkpoint.done.push(t);
        writeFileSync(OUT, JSON.stringify(out, null, 1));
        writeFileSync(CHECKPOINT, JSON.stringify(checkpoint));
        process.stdout.write(".");
      } catch (e) {
        console.warn(`\n  ${t}: ${(e as Error).message}`);
      }
    }
  }
  console.log(`\nraw.json now has ${out.length} live posts. Run \`npm run data\` to rebuild data/listings.json.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
