import { beforeEach, describe, expect, it, vi } from "vitest";

const chatJSON = vi.fn();
vi.mock("@/lib/llm/client", () => ({ chatJSON: (...a: unknown[]) => chatJSON(...a), llmConfig: () => ({ provider: "test" }) }));

const { parseIntentLlm } = await import("@/lib/intent/llm");
const { refineWithLlm } = await import("@/lib/extract/llm");
const { extractListingRules } = await import("@/lib/extract/rules");
const { DEFAULT_INTENT } = await import("@/lib/intent/rules");

beforeEach(() => chatJSON.mockReset());

describe("parseIntentLlm", () => {
  it("merges LLM fields over rules and drops invalid values", async () => {
    chatJSON.mockResolvedValue({
      data: { cash: 2.5e9, maxRent: -5, neighborhoods: ["punak", "narmak"], must: ["parking"], emphasis: ["trust"] },
      model: "m",
    });
    const i = await parseIntentLlm("دو و نیم میلیارد دارم ماهی ۲۰ تومن پونک پارکینگ", DEFAULT_INTENT);
    expect(i.cash).toBe(2.5e9);
    expect(i.maxRent).toBe(20e6);
    expect(i.neighborhoods).toEqual(["punak"]);
    expect(i.must).toEqual(["parking"]);
    expect(i.weights.trust).toBeGreaterThan(DEFAULT_INTENT.weights.trust);
    expect(i.parsedBy).toBe("llm");
  });
});

describe("refineWithLlm", () => {
  const raw = {
    id: "x1",
    source: "divar" as const,
    url: "",
    title: "۷۰ متر دو خواب پونک",
    description: "واحد تمیز. با توافق، رهن بیشتر هم قبول می‌کنیم. پارکینگ مشاع",
    priceText: { deposit: "۱ میلیارد", rent: "۳۰ میلیون" },
    formFields: { متراژ: "۷۰", اتاق: "۲" },
    badges: [],
    advertiser: { kind: "agency" as const },
    neighborhoodText: "پونک",
    postedAt: "",
    fetchedAt: "",
    isSeed: true,
  };

  it("accepts quoted evidence and drops hallucinated flags", async () => {
    chatJSON.mockResolvedValue({
      data: {
        convertible: { convertible: true, evidence: "رهن بیشتر هم قبول می‌کنیم", ratePerMonth: 0.03 },
        redFlags: [
          { code: "shared_parking", evidence: "پارکینگ مشاع" },
          { code: "family_only", evidence: "فقط خانواده" },
        ],
      },
      model: "m",
    });
    const base = extractListingRules(raw)!;
    expect(base.convert.mode).toBe("none");
    const out = await refineWithLlm(raw, base);
    expect(out.convert.mode).toBe("text");
    expect(out.convert.maxDeposit).toBe(2e9);
    const codes = out.redFlags.map((f) => f.code);
    expect(codes).toContain("shared_parking");
    expect(codes).not.toContain("family_only");
    expect(out.extraction.method).toBe("llm");
  });
});
