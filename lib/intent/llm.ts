import { z } from "zod";
import { chatJSON } from "../llm/client";
import { NEIGHBORHOODS } from "../geo";
import type { UserIntent } from "../types";
import { parseIntentRules } from "./rules";

const MUST = ["parking", "elevator", "storage", "balcony", "renovated", "near_metro"] as const;

const Schema = z.object({
  cash: z.number().nullable().optional(),
  maxRent: z.number().nullable().optional(),
  neighborhoods: z.array(z.string()).optional(),
  minArea: z.number().nullable().optional(),
  minRooms: z.number().nullable().optional(),
  maxBuildAge: z.number().nullable().optional(),
  must: z.array(z.enum(MUST)).optional(),
  nice: z.array(z.enum(MUST)).optional(),
  household: z.enum(["single", "couple", "family"]).nullable().optional(),
  emphasis: z.array(z.enum(["cost", "fairness", "fit", "trust", "commute"])).optional(),
});

const SYSTEM = `You convert a Tehran renter's Persian/Finglish request into JSON constraints.
Amounts are in toman. Colloquially "ماهی ۴۰ تومن" means 40,000,000 toman per month and "۲ تا نقد" means 2,000,000,000.
cash = total money available for the deposit (رهن/ودیعه/نقد). maxRent = max monthly rent.
neighborhoods must be slugs from: ${NEIGHBORHOODS.map((n) => `${n.slug} (${n.fa})`).join(", ")}.
must = hard requirements ("لازم", "حتما", "باید"); nice = preferences ("ترجیحا", "بهتره").
emphasis = which ranking factors the user stresses: cost (cheap), fairness (not overpaying), fit (space/new), trust (real/safe listing), commute (metro).
Use null or omit when not stated. Return JSON only with keys: cash, maxRent, neighborhoods, minArea, minRooms, maxBuildAge, must, nice, household, emphasis.`;

/** LLM parse merged over the rules parse; anything the LLM omits or gets wrong-shaped keeps the rules value. */
export async function parseIntentLlm(query: string, base: UserIntent): Promise<UserIntent> {
  const rules = parseIntentRules(query, base);
  const { data } = await chatJSON([
    { role: "system", content: SYSTEM },
    { role: "user", content: query },
  ]);
  const p = Schema.safeParse(data);
  if (!p.success) return rules;
  const x = p.data;
  const validHoods = new Set(NEIGHBORHOODS.map((n) => n.slug));
  const weights = { ...rules.weights };
  for (const e of x.emphasis ?? []) weights[e] = Math.max(weights[e], base.weights[e] + 0.15);
  const sane = (v: number | null | undefined, lo: number, hi: number) => (v != null && v >= lo && v <= hi ? v : undefined);
  return {
    ...rules,
    cash: sane(x.cash, 1e7, 1e12) ?? rules.cash,
    maxRent: sane(x.maxRent, 0, 1e10) ?? rules.maxRent,
    neighborhoods: x.neighborhoods ? x.neighborhoods.filter((s) => validHoods.has(s)) : rules.neighborhoods,
    minArea: sane(x.minArea, 15, 1000) ?? rules.minArea,
    minRooms: sane(x.minRooms, 0, 10) ?? rules.minRooms,
    maxBuildAge: sane(x.maxBuildAge, 0, 80) ?? rules.maxBuildAge,
    must: x.must ?? rules.must,
    nice: (x.nice ?? rules.nice).filter((n) => !(x.must ?? rules.must).includes(n)),
    household: x.household ?? rules.household,
    weights,
    parsedBy: "llm",
  };
}
