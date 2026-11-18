import { describe, expect, it } from "vitest";
import { fmtToman, parseToman } from "@/lib/money";

describe("parseToman", () => {
  it.each([
    ["۸۰۰ میلیون", 800_000_000],
    ["۸۰۰,۰۰۰,۰۰۰ تومان", 800_000_000],
    ["۱۴,۵۰۰,۰۰۰,۰۰۰ تومان", 14_500_000_000],
    ["۲.۸ میلیارد", 2_800_000_000],
    ["۱/۵ میلیارد", 1_500_000_000],
    ["2 میلیارد و 500 میلیون", 2_500_000_000],
    ["۶۰ م", 60_000_000],
    ["رهن کامل", 0],
    ["رایگان", 0],
    ["نیم میلیارد", 500_000_000],
    ["پانصد میلیون", 500_000_000],
  ])("%s", (input, expected) => {
    expect(parseToman(input)).toBe(expected);
  });

  it("returns null for text without numbers", () => {
    expect(parseToman("بدون قیمت")).toBeNull();
  });
});

describe("fmtToman", () => {
  it("formats in Persian", () => {
    expect(fmtToman(2_800_000_000)).toBe("۲٫۸ میلیارد تومان");
    expect(fmtToman(60_000_000, { unit: false })).toBe("۶۰ میلیون");
  });
});
