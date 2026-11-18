import { describe, expect, it } from "vitest";
import { extractConvertibility, extractListingRules, extractRedFlags } from "@/lib/extract/rules";
import { normalizeFa } from "@/lib/persian";
import type { RawListing } from "@/lib/types";

function raw(p: Partial<RawListing>): RawListing {
  return {
    id: "t1",
    source: "divar",
    url: "",
    title: "",
    description: "",
    priceText: {},
    formFields: {},
    badges: [],
    advertiser: { kind: "agency" },
    neighborhoodText: "پونک",
    postedAt: "",
    fetchedAt: "",
    isSeed: true,
    ...p,
  };
}

describe("extractConvertibility", () => {
  it("finds convertibility hidden in free text with an explicit cap", () => {
    const c = extractConvertibility(normalizeFa("ودیعه قابل تبدیل تا ۲ میلیارد"), 1e9, 45e6);
    expect(c.mode).toBe("text");
    expect(c.maxDeposit).toBe(2e9);
  });

  it("derives the owner's real rate from a full-deposit price", () => {
    const c = extractConvertibility(normalizeFa("یا رهن کامل ۲.۵ میلیارد"), 1e9, 30e6);
    expect(c.maxDeposit).toBe(2.5e9);
    expect(c.rate).toBe(0.02);
  });

  it("parses an explicit per-100M rate", () => {
    const c = extractConvertibility(normalizeFa("قابل تبدیل، هر ۱۰۰ میلیون ۳.۵ میلیون"), 1e9, 40e6);
    expect(c.rate).toBe(0.035);
  });

  it("respects explicit non-convertible text", () => {
    expect(extractConvertibility(normalizeFa("غیر قابل تبدیل"), 1e9, 40e6).mode).toBe("none");
  });

  it("uses the form toggle with Divar's slider endpoint", () => {
    const c = extractConvertibility("", 800e6, 60e6, true);
    expect(c.mode).toBe("form");
    expect(c.maxDeposit).toBe(2.8e9);
  });
});

describe("extractRedFlags", () => {
  it.each([
    ["فقط به خانواده محترم اجاره داده می‌شود", "family_only"],
    ["به مجرد داده نمی‌شود", "no_single"],
    ["پارکینگ مزاحم دار", "mozahem_parking"],
    ["تخلیه آخر آذر", "evict_end_of_month"],
    ["کمیسیون جداگانه دریافت می‌شود", "commission_extra"],
  ])("%s", (text, code) => {
    expect(extractRedFlags(normalizeFa(text)).map((f) => f.code)).toContain(code);
  });
});

describe("extractListingRules", () => {
  it("normalizes a Divar-style post", () => {
    const l = extractListingRules(
      raw({
        title: "۸۰متر دو خواب/خوش‌نقشه/شخصی/عکس واقعی",
        description: "پونک عدل، طبقه اول، پارکینگ و انباری. ساختمان دارای لابی",
        priceText: { deposit: "۸۰۰,۰۰۰,۰۰۰ تومان", rent: "۶۰,۰۰۰,۰۰۰ تومان" },
        formFields: { متراژ: "۸۰", ساخت: "۱۳۹۱", اتاق: "۲", طبقه: "۱ از ۵", "ویژگی‌ها": "آسانسور ندارد، پارکینگ، انباری" },
        convertibleFlag: true,
      }),
    )!;
    expect(l.neighborhood).toBe("punak");
    expect(l.areaM2).toBe(80);
    expect(l.floor).toBe(1);
    expect(l.totalFloors).toBe(5);
    expect(l.amenities.parking).toBe(true);
    expect(l.amenities.elevator).toBe(false);
    expect(l.realPhotos).toBe("yes");
    expect(l.convert.maxDeposit).toBe(2.8e9);
  });

  it("extracts fields from text when the form is empty", () => {
    const l = extractListingRules(
      raw({
        title: "۶۵ متری یک خواب صادقیه",
        description: "طبقه سوم از ۴، آسانسور دارد، ساخت ۱۳۹۸",
        neighborhoodText: "صادقیه",
        priceText: { deposit: "۱ میلیارد", rent: "۲۵ میلیون" },
      }),
    )!;
    expect(l.areaM2).toBe(65);
    expect(l.rooms).toBe(1);
    expect(l.floor).toBe(3);
    expect(l.buildYear).toBe(1398);
    expect(l.extraction.fieldsFromText).toEqual(expect.arrayContaining(["areaM2", "rooms", "floor", "buildYear"]));
  });

  it("places every listing at a finite point inside its neighborhood", () => {
    for (let i = 0; i < 300; i++) {
      const l = extractListingRules(raw({ id: `geo-${i}`, title: "۶۰ متر", priceText: { deposit: "۱ میلیارد" } }))!;
      expect(Number.isFinite(l.geo.lat) && Number.isFinite(l.geo.lng)).toBe(true);
      expect(Number.isFinite(l.nearestMetro!.distanceM)).toBe(true);
    }
  });

  it("flags placeholder-price bait posts", () => {
    const l = extractListingRules(raw({ title: "هم خونه خانم", priceText: { deposit: "۱,۰۰۰ تومان", rent: "۱,۰۰۰ تومان" } }))!;
    expect(l.redFlags.map((f) => f.code)).toEqual(expect.arrayContaining(["placeholder_price", "non_apartment"]));
  });
});
