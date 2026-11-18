import { extractListingRules } from "../lib/extract/rules";
import { refineWithLlm } from "../lib/extract/llm";
import { llmConfig } from "../lib/llm/client";
import type { NormalizedListing, RawListing } from "../lib/types";

export interface NormalizeResult {
  listings: NormalizedListing[];
  skipped: { id: string; reason: string }[];
}

/** Rules first (always), then an optional LLM pass with bounded concurrency. Any LLM failure keeps the rules result. */
export async function normalizeAll(raw: RawListing[], opts: { llm?: boolean } = {}): Promise<NormalizeResult> {
  const skipped: NormalizeResult["skipped"] = [];
  const base: { raw: RawListing; l: NormalizedListing }[] = [];
  for (const r of raw) {
    const l = extractListingRules(r);
    if (!l) skipped.push({ id: r.id, reason: "neighborhood_unknown" });
    else base.push({ raw: r, l });
  }

  const useLlm = (opts.llm ?? true) && !!llmConfig();
  if (!useLlm) return { listings: base.map((b) => b.l), skipped };

  console.log(`LLM refinement with ${llmConfig()!.provider}/${llmConfig()!.model} on ${base.length} listings`);
  const out: NormalizedListing[] = new Array(base.length);
  let next = 0;
  let failures = 0;
  async function worker() {
    while (next < base.length) {
      const i = next++;
      try {
        out[i] = await refineWithLlm(base[i].raw, base[i].l);
      } catch {
        failures++;
        out[i] = base[i].l;
      }
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));
  if (failures) console.warn(`LLM failed on ${failures} listings; kept rule-based extraction for those.`);
  return { listings: out, skipped };
}
