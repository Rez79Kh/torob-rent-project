import { describe, expect, it } from "vitest";
import { neighborhoodStats } from "@/lib/fairPrice";
import { rankMarket } from "@/lib/rank";
import { intent, listing, single } from "./fixtures";

function dataset(ls: ReturnType<typeof listing>[]) {
  return { listings: ls, clusters: ls.map(single), neighborhoods: neighborhoodStats(ls), conversionRate: 0.03 };
}

describe("rankMarket", () => {
  const convertible = listing({
    id: "conv",
    deposit: 800e6,
    rent: 60e6,
    convert: { mode: "text", minDeposit: 800e6, maxDeposit: 2.8e9, rate: 0.03, evidence: "قابل تبدیل" },
  });
  const plain = listing({ id: "plain", deposit: 1.5e9, rent: 35e6 });
  const tooExpensive = listing({ id: "exp", deposit: 3e9, rent: 50e6 });

  it("surfaces convertible listings that plain filters would hide", () => {
    const out = rankMarket(dataset([convertible, plain, tooExpensive]), intent({ cash: 2e9, maxRent: 40e6 }));
    const ids = out.ranked.map((r) => r.listing.id);
    expect(ids).toContain("conv");
    expect(ids).toContain("plain");
    expect(ids).not.toContain("exp");
    expect(out.unlockedCount).toBe(1);
    const conv = out.ranked.find((r) => r.listing.id === "conv")!;
    expect(conv.chosenDeposit).toBe(2e9);
    expect(conv.resultingRent).toBe(24e6);
  });

  it("re-ranks when cash changes", () => {
    const low = rankMarket(dataset([convertible, plain]), intent({ cash: 1.5e9, maxRent: 38e6 }));
    expect(low.ranked.map((r) => r.listing.id)).toEqual(["plain"]);
    const high = rankMarket(dataset([convertible, plain]), intent({ cash: 2.8e9, maxRent: 40e6 }));
    expect(high.ranked.map((r) => r.listing.id)).toContain("conv");
  });

  it("blocks family-only listings for single tenants with an explicit reason", () => {
    const fam = listing({ id: "fam", redFlags: [{ code: "family_only", evidence: "فقط خانواده" }] });
    const out = rankMarket(dataset([fam, plain]), intent({ household: "single" }));
    expect(out.ranked.map((r) => r.listing.id)).toEqual(["plain"]);
    expect(out.rejected[0].rejectReason).toBe("flag");
  });

  it("enforces must-have amenities", () => {
    const noParking = listing({ id: "np", amenities: { parking: false, elevator: true, storage: true, balcony: false, renovated: false } });
    const out = rankMarket(dataset([noParking, plain]), intent({ must: ["parking"] }));
    expect(out.ranked.map((r) => r.listing.id)).toEqual(["plain"]);
  });

  it("picks the cheapest agency within a duplicate cluster", () => {
    const a = listing({ id: "a", deposit: 1e9, rent: 30e6 });
    const b = listing({ id: "b", deposit: 1e9, rent: 36e6 });
    const data = {
      listings: [a, b],
      clusters: [{ ...single(a), memberIds: ["a", "b"] }],
      neighborhoods: neighborhoodStats([a]),
      conversionRate: 0.03,
    };
    const out = rankMarket(data, intent());
    expect(out.ranked[0].listing.id).toBe("a");
  });
});
