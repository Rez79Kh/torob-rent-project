import { describe, expect, it } from "vitest";
import { parseIntentRules } from "@/lib/intent/rules";

describe("parseIntentRules", () => {
  it("parses the canonical demo query", () => {
    const i = parseIntentRules("۲ میلیارد نقد دارم، ماهی تا ۴۰ تومن، نزدیک مترو، پارکینگ لازمه");
    expect(i.cash).toBe(2e9);
    expect(i.maxRent).toBe(40e6);
    expect(i.must).toContain("parking");
    expect(i.nice).toContain("near_metro");
    expect(i.parsedBy).toBe("rules");
  });

  it("handles Finglish", () => {
    const i = parseIntentRules("1.5 milyard naghd daram, mahi 30 toman, punak, parking");
    expect(i.cash).toBe(1.5e9);
    expect(i.maxRent).toBe(30e6);
    expect(i.neighborhoods).toEqual(["punak"]);
    expect(i.must).toContain("parking");
  });

  it("combines billion and million parts", () => {
    const i = parseIntentRules("رهن ۲ میلیارد و ۵۰۰ میلیون، اجاره ۲۰ میلیون");
    expect(i.cash).toBe(2.5e9);
    expect(i.maxRent).toBe(20e6);
  });

  it("does not mistake area and rooms for money", () => {
    const i = parseIntentRules("حداقل ۷۰ متر دو خواب در صادقیه، ۱ میلیارد نقد، ماهی ۲۵");
    expect(i.minArea).toBe(70);
    expect(i.minRooms).toBe(2);
    expect(i.cash).toBe(1e9);
    expect(i.maxRent).toBe(25e6);
    expect(i.neighborhoods).toEqual(["sadeghiyeh"]);
  });

  it("detects household and preferences", () => {
    const i = parseIntentRules("دانشجوی مجردم، ترجیحا آسانسور داشته باشه، ارزون باشه");
    expect(i.household).toBe("single");
    expect(i.nice).toContain("elevator");
    expect(i.weights.cost).toBeGreaterThan(0.35);
  });

  it("assigns context per amount within one clause", () => {
    const i = parseIntentRules("دو و نیم میلیارد دارم ماهی ۲۰ تومن");
    expect(i.cash).toBe(2.5e9);
    expect(i.maxRent).toBe(20e6);
  });

  it("assigns unlabeled amounts by magnitude", () => {
    const i = parseIntentRules("۳ میلیارد، ۱۵ میلیون، یوسف آباد");
    expect(i.cash).toBe(3e9);
    expect(i.maxRent).toBe(15e6);
    expect(i.neighborhoods).toEqual(["yousef-abad"]);
  });
});
