import { describe, expect, it } from "vitest";
import { cleanForSimilarity, hamming16, imageOverlap, MERGE_THRESHOLD, pairScore, TfIdf } from "@/lib/dedup";
import { listing } from "./fixtures";

describe("dedup primitives", () => {
  it("strips agency boilerplate", () => {
    const t = cleanForSimilarity("پونک ۸۰ متر", "به نام خدا\n✨عرض ادب و احترام✨\nنورگیر عالی\nمشاور: زارعی");
    expect(t).not.toMatch(/زارعی|احترام/);
    expect(t).toMatch(/نورگیر/);
  });

  it("measures dHash distance", () => {
    expect(hamming16("ffffffffffffffff", "fffffffffffffffe")).toBe(1);
    expect(imageOverlap(["0000000000000000", "ffffffffffffffff"], ["0000000000000001"])).toBe(1);
    expect(imageOverlap(undefined, ["0"])).toBeNull();
  });

  it("scores similar text higher than unrelated text", () => {
    const tf = new TfIdf([
      { id: "a", text: "۸۰ متر دو خواب نورگیر عالی کابینت هایگلاس کف پارکت پونک" },
      { id: "b", text: "پونک ۸۰ متری دو خواب کابینت هایگلاس نورگیر عالی پارکت" },
      { id: "c", text: "سوئیت ۴۵ متری تهرانپارس کولر آبی سرامیک" },
    ]);
    expect(tf.cosine("a", "b")).toBeGreaterThan(tf.cosine("a", "c"));
  });
});

describe("pairScore", () => {
  const base = { imageHashes: ["aaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbb", "cccccccccccccccc"] };

  it("merges reposts with shared photos", () => {
    const a = listing({ id: "a", ...base });
    const b = listing({ id: "b", ...base, deposit: 1.2e9, rent: 25e6 });
    expect(pairScore(a, b, 0.7).score).toBeGreaterThanOrEqual(MERGE_THRESHOLD);
  });

  it("vetoes different floors", () => {
    const a = listing({ id: "a", floor: 1 });
    const b = listing({ id: "b", floor: 3 });
    expect(pairScore(a, b, 0.9).vetoed).toBe("floor");
  });

  it("never merges on structural fields alone", () => {
    const a = listing({ id: "a" });
    const b = listing({ id: "b" });
    expect(pairScore(a, b, 0.1).score).toBeLessThan(MERGE_THRESHOLD);
  });
});
