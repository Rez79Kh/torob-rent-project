import { describe, expect, it } from "vitest";
import { effectiveMonthly, fitToCash, fullDepositOf } from "@/lib/convert";
import type { Convertibility } from "@/lib/types";

// The real Punak listing on Divar: 800M deposit + 60M rent, slider to 2.8B + ~0.
const punak: Convertibility = { mode: "form", minDeposit: 800e6, maxDeposit: fullDepositOf(800e6, 60e6), rate: 0.03 };

describe("fullDepositOf", () => {
  it("matches Divar's slider endpoint", () => {
    expect(fullDepositOf(800e6, 60e6, 0.03)).toBe(2_800_000_000);
  });
});

describe("fitToCash", () => {
  it("unlocks a convertible listing Divar's filters would hide", () => {
    const fit = fitToCash(800e6, 60e6, punak, 2e9, 30e6);
    expect(fit.feasible).toBe(true);
    expect(fit.deposit).toBe(2e9);
    expect(fit.rent).toBe(24e6);
    expect(fit.unlockedByConversion).toBe(true);
  });

  it("caps deposit at the owner's maximum", () => {
    const fit = fitToCash(800e6, 60e6, punak, 5e9, 30e6);
    expect(fit.deposit).toBe(2.8e9);
    expect(fit.rent).toBe(0);
  });

  it("keeps cash out of the deposit when the owner's rate is worse than the user's", () => {
    const cheapOwner: Convertibility = { mode: "text", minDeposit: 1e9, maxDeposit: 2.5e9, rate: 0.02 };
    const fit = fitToCash(1e9, 30e6, cheapOwner, 3e9, 25e6, 0.025);
    expect(fit.deposit).toBe(1.25e9);
    expect(fit.rent).toBe(25e6);
    const greedy = fitToCash(1e9, 30e6, cheapOwner, 3e9, 25e6, 0.015);
    expect(greedy.deposit).toBe(2.5e9);
  });

  it("rejects when cash is below the minimum deposit", () => {
    const fit = fitToCash(800e6, 60e6, punak, 500e6, 100e6);
    expect(fit.feasible).toBe(false);
    expect(fit.reason).toBe("cash");
  });

  it("rejects non-convertible listings outside the budget", () => {
    const none: Convertibility = { mode: "none", minDeposit: 800e6, maxDeposit: 800e6, rate: 0.03 };
    expect(fitToCash(800e6, 60e6, none, 2e9, 30e6).feasible).toBe(false);
    expect(fitToCash(800e6, 60e6, none, 2e9, 30e6).reason).toBe("rent");
  });
});

describe("effectiveMonthly", () => {
  it("adds the user's opportunity cost of the deposit", () => {
    expect(effectiveMonthly(2e9, 24e6, 0.025)).toBe(74e6);
  });
});
