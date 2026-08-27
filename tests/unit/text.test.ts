import { describe, expect, it } from "vitest";
import { countLabel, plural } from "@/lib/text";

const SPRAWA: [string, string, string] = ["sprawa", "sprawy", "spraw"];

describe("plural", () => {
  it("używa trzech form, a nie dwóch", () => {
    expect(plural(1, SPRAWA)).toBe("sprawa");
    expect(plural(2, SPRAWA)).toBe("sprawy");
    expect(plural(5, SPRAWA)).toBe("spraw");
  });

  it("nastolatki biorą formę „wielu”", () => {
    // 12–14 to pułapka: końcówka 2–4, a mimo to „spraw”, nie „sprawy”.
    expect(plural(12, SPRAWA)).toBe("spraw");
    expect(plural(13, SPRAWA)).toBe("spraw");
    expect(plural(14, SPRAWA)).toBe("spraw");
    expect(plural(112, SPRAWA)).toBe("spraw");
  });

  it("dziesiątki z końcówką 2–4 biorą formę „kilku”", () => {
    expect(plural(22, SPRAWA)).toBe("sprawy");
    expect(plural(103, SPRAWA)).toBe("sprawy");
  });

  it("końcówka 1 poza samą jedynką bierze formę „wielu”", () => {
    // 21 spraw, nie „21 sprawa”.
    expect(plural(21, SPRAWA)).toBe("spraw");
    expect(plural(101, SPRAWA)).toBe("spraw");
  });

  it("zero bierze formę „wielu”", () => {
    expect(plural(0, SPRAWA)).toBe("spraw");
  });

  it("countLabel skleja liczbę z odmianą", () => {
    expect(countLabel(0, SPRAWA)).toBe("0 spraw");
    expect(countLabel(3, SPRAWA)).toBe("3 sprawy");
  });
});
