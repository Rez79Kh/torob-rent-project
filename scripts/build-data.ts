/**
 * raw posts (seed + optional live ingest) -> normalized listings -> duplicate clusters + neighborhood medians
 * -> data/listings.json (committed; the deployed app never needs network or an LLM).
 *
 *   npm run data            # rules + LLM if LLM_API_KEY is set
 *   npm run data -- --no-llm
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { RawListing } from "../lib/types";
import { buildDataset } from "./cluster";
import { normalizeAll } from "./normalize";

async function main() {
  const dir = path.join(process.cwd(), "data");
  const seed = JSON.parse(readFileSync(path.join(dir, "seed-raw.json"), "utf8")) as RawListing[];
  const livePath = path.join(dir, "raw.json");
  const live = existsSync(livePath) ? (JSON.parse(readFileSync(livePath, "utf8")) as RawListing[]) : [];
  const seen = new Set<string>();
  const raw = [...live, ...seed].filter((r) => !seen.has(r.id) && seen.add(r.id));
  console.log(`raw: ${seed.length} seed + ${live.length} live`);

  const rate = Number(process.env.CONVERSION_RATE ?? 0.03);
  const { listings, skipped } = await normalizeAll(raw, { llm: !process.argv.includes("--no-llm") });
  if (skipped.length) console.log(`skipped ${skipped.length} (unknown neighborhood)`);

  const data = buildDataset(raw, listings, rate);
  writeFileSync(path.join(dir, "listings.json"), JSON.stringify(data));
  const multi = data.clusters.filter((c) => c.memberIds.length > 1);
  console.log(
    `listings: ${data.listings.length}, properties: ${data.clusters.length}, duplicate groups: ${multi.length} ` +
      `(${data.stats.mergedDuplicates} merged), noise dropped: ${data.stats.droppedNoise}, text-only convertible: ${data.stats.textOnlyConvertible}`,
  );
  for (const n of data.neighborhoods) console.log(`  ${n.slug}: median ${Math.round(n.medianEffPerM2 / 1000)}k/m², n=${n.n}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
