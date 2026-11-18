import { z } from "zod";
import { fullDepositOf } from "../convert";
import { chatJSON } from "../llm/client";
import { parseToman } from "../money";
import { normalizeFa } from "../persian";
import type { NormalizedListing, RawListing, RedFlagCode } from "../types";

const FLAG_CODES = [
  "family_only", "couple_only", "no_single", "shared_parking", "mozahem_parking", "evict_end_of_month",
  "commission_extra", "short_contract", "basement_unit",
] as const;

const Schema = z.object({
  areaM2: z.number().nullable().optional(),
  rooms: z.number().nullable().optional(),
  floor: z.number().nullable().optional(),
  totalFloors: z.number().nullable().optional(),
  buildYear: z.number().nullable().optional(),
  amenities: z
    .object({
      parking: z.boolean().nullable().optional(),
      elevator: z.boolean().nullable().optional(),
      storage: z.boolean().nullable().optional(),
      balcony: z.boolean().nullable().optional(),
      renovated: z.boolean().nullable().optional(),
    })
    .partial()
    .optional(),
  convertible: z
    .object({
      convertible: z.boolean(),
      maxDepositText: z.string().nullable().optional(),
      ratePerMonth: z.number().nullable().optional(),
      evidence: z.string().nullable().optional(),
    })
    .optional(),
  redFlags: z.array(z.object({ code: z.enum(FLAG_CODES), evidence: z.string() })).optional(),
});

const SYSTEM = `You extract structured facts from Persian Tehran rental listings (Divar/Sheypoor/Kilid).
Return JSON only, with keys: areaM2, rooms, floor, totalFloors, buildYear (Jalali), amenities {parking, elevator, storage, balcony, renovated},
convertible {convertible, maxDepositText, ratePerMonth, evidence}, redFlags [{code, evidence}].
Rules: use null when unknown; never guess. "evidence" must be an exact substring copied from the listing text.
Convertible means the owner accepts trading deposit (رهن/ودیعه) for monthly rent. ratePerMonth is the monthly rent reduction per toman of extra deposit (e.g. 0.03).
Red flag codes: ${FLAG_CODES.join(", ")}.`;

/** LLM pass layered on top of the rules result. Every LLM flag must quote text that actually exists, or it is dropped. */
export async function refineWithLlm(raw: RawListing, base: NormalizedListing): Promise<NormalizedListing> {
  const text = `${raw.title}\n${raw.description}`;
  const { data, model } = await chatJSON(
    [
      { role: "system", content: SYSTEM },
      { role: "user", content: `عنوان: ${raw.title}\nفیلدها: ${JSON.stringify(raw.formFields)}\nقیمت: ${JSON.stringify(raw.priceText)}\nتوضیحات:\n${raw.description}` },
    ],
    { timeoutMs: 20000 },
  );
  const parsed = Schema.safeParse(data);
  if (!parsed.success) return base;
  const x = parsed.data;
  const nText = normalizeFa(text);
  const quoted = (ev?: string | null) => !!ev && nText.includes(normalizeFa(ev));

  const out: NormalizedListing = { ...base, amenities: { ...base.amenities }, redFlags: [...base.redFlags] };
  const fromText = new Set(base.extraction.fieldsFromText);
  const fill = <K extends "areaM2" | "rooms" | "floor" | "totalFloors" | "buildYear">(k: K) => {
    const v = x[k];
    if (v != null && (out[k] == null || out[k] === 0)) {
      (out as unknown as Record<string, number>)[k] = v;
      fromText.add(k);
    }
  };
  (["areaM2", "rooms", "floor", "totalFloors", "buildYear"] as const).forEach(fill);
  for (const [k, v] of Object.entries(x.amenities ?? {})) {
    if (v === true && !out.amenities[k as keyof typeof out.amenities]) {
      out.amenities[k as keyof typeof out.amenities] = true;
      fromText.add(k);
    }
  }
  if (x.convertible?.convertible && out.convert.mode === "none" && quoted(x.convertible.evidence)) {
    const rate = x.convertible.ratePerMonth && x.convertible.ratePerMonth > 0.005 && x.convertible.ratePerMonth < 0.08 ? x.convertible.ratePerMonth : out.convert.rate;
    const cap = fullDepositOf(out.deposit, out.rent, rate);
    const max = parseToman(x.convertible.maxDepositText ?? "") ?? cap;
    out.convert = { mode: "text", minDeposit: out.deposit, maxDeposit: Math.min(Math.max(max, out.deposit), cap), rate, evidence: x.convertible.evidence ?? undefined };
    fromText.add("convertible");
  }
  for (const f of x.redFlags ?? []) {
    if (quoted(f.evidence) && !out.redFlags.some((r) => r.code === f.code)) out.redFlags.push({ code: f.code as RedFlagCode, evidence: f.evidence });
  }
  out.extraction = { method: "llm", model, confidence: Math.min(1, base.extraction.confidence + 0.1), fieldsFromText: [...fromText] };
  return out;
}
