import type { Convertibility, Toman } from "./types";

export const DEFAULT_RATE = 0.03;
export const DEFAULT_USER_RATE = 0.025;

/** Divar's own slider endpoint: the deposit at which rent reaches zero. */
export function fullDepositOf(deposit: Toman, rent: Toman, rate = DEFAULT_RATE): Toman {
  return deposit + rent / rate;
}

export interface Fit {
  feasible: boolean;
  deposit: Toman;
  rent: Toman;
  /** Feasible only because the deposit/rent can be converted. */
  unlockedByConversion: boolean;
  reason?: "cash" | "rent";
}

/**
 * Pick the deposit the user should actually pay for this listing, and the rent that results.
 * Effective cost is linear in the deposit with slope (userRate - ownerRate): if the owner converts at a better rate
 * than the user's money earns elsewhere, put in as much cash as allowed; otherwise the smallest deposit that keeps
 * rent under the cap. Non-convertible listings are take-it-or-leave-it.
 */
export function fitToCash(
  deposit: Toman,
  rent: Toman,
  convert: Convertibility,
  cash: Toman,
  maxRent: Toman,
  userRate: number = 0,
): Fit {
  const plainOk = deposit <= cash && rent <= maxRent;
  if (convert.mode === "none") {
    return {
      feasible: plainOk,
      deposit,
      rent,
      unlockedByConversion: false,
      reason: plainOk ? undefined : deposit > cash ? "cash" : "rent",
    };
  }
  const { minDeposit, maxDeposit, rate } = convert;
  if (cash < minDeposit) {
    return { feasible: false, deposit: minDeposit, rent: rentAt(deposit, rent, minDeposit, rate), unlockedByConversion: false, reason: "cash" };
  }
  const ceiling = Math.min(cash, maxDeposit);
  const floorForRent = Math.max(minDeposit, deposit + (rent - maxRent) / rate);
  const d = userRate > rate && floorForRent <= ceiling ? Math.ceil(floorForRent / 1e6) * 1e6 : ceiling;
  const r = rentAt(deposit, rent, d, rate);
  const feasible = r <= maxRent;
  return {
    feasible,
    deposit: d,
    rent: r,
    unlockedByConversion: feasible && !plainOk,
    reason: feasible ? undefined : "rent",
  };
}

export function rentAt(baseDeposit: Toman, baseRent: Toman, newDeposit: Toman, rate: number): Toman {
  return Math.max(0, Math.round(baseRent - (newDeposit - baseDeposit) * rate));
}

/** Monthly cost to this user: rent paid plus what their deposit would have earned elsewhere. */
export function effectiveMonthly(deposit: Toman, rent: Toman, userRate: number): Toman {
  return Math.round(rent + deposit * userRate);
}

/** User-independent market cost, used for neighborhood fair-price comparison. */
export function marketMonthly(deposit: Toman, rent: Toman, rate = DEFAULT_RATE): Toman {
  return Math.round(rent + deposit * rate);
}
