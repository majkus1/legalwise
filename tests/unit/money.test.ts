import { describe, expect, it } from "vitest";
import {
  computeLineAmounts,
  computeNetGrosz,
  computeVatGrosz,
  formatGrosz,
  formatGroszPlain,
  parseAmountToGrosz,
  roundHalfAwayFromZero,
  sumLineAmounts,
} from "@/lib/money";

/** Intl wstawia twardą spację jako separator tysięcy i przed symbolem waluty. */
const normalize = (value: string) => value.replace(/ /g, " ");

describe("roundHalfAwayFromZero", () => {
  it("zaokrągla połówki w górę dla wartości dodatnich", () => {
    expect(roundHalfAwayFromZero(0.5)).toBe(1);
    expect(roundHalfAwayFromZero(1.5)).toBe(2);
    expect(roundHalfAwayFromZero(2.5)).toBe(3);
  });

  it("zaokrągla połówki od zera dla wartości ujemnych, jak round() w PostgreSQL", () => {
    // Math.round(-0.5) daje -0, co rozjechałoby się z bazą przy korektach.
    expect(roundHalfAwayFromZero(-0.5)).toBe(-1);
    expect(roundHalfAwayFromZero(-1.5)).toBe(-2);
  });

  it("nie zmienia liczb całkowitych", () => {
    expect(roundHalfAwayFromZero(7)).toBe(7);
    expect(roundHalfAwayFromZero(0)).toBe(0);
  });
});

describe("computeNetGrosz", () => {
  it("liczy pełne godziny", () => {
    // 10 h po 450,00 zł = 4 500,00 zł
    expect(computeNetGrosz(10, 45_000)).toBe(450_000);
  });

  it("liczy godziny ułamkowe", () => {
    // 1,5 h po 450,00 zł = 675,00 zł
    expect(computeNetGrosz(1.5, 45_000)).toBe(67_500);
  });

  it("radzi sobie z ilościami, które w zmiennym przecinku dają dryf", () => {
    // 0,1 + 0,2 !== 0,3 — mnożenie po liczbach całkowitych musi to znieść.
    expect(computeNetGrosz(0.3, 33_333)).toBe(10_000);
    expect(computeNetGrosz(12.35, 45_000)).toBe(555_750);
  });

  it("obsługuje cztery miejsca dziesiętne ilości, jak numeric(12,4)", () => {
    // 20 minut = 0,3333 h
    expect(computeNetGrosz(0.3333, 45_000)).toBe(14_999);
  });

  it("zwraca zero przy zerowej stawce", () => {
    expect(computeNetGrosz(8, 0)).toBe(0);
  });
});

describe("computeVatGrosz", () => {
  it("liczy podstawową stawkę 23%", () => {
    expect(computeVatGrosz(100_000, 23)).toBe(23_000);
  });

  it("zaokrągla do pełnych groszy", () => {
    // 1 234,57 zł * 23% = 283,9511 zł → 283,95 zł
    expect(computeVatGrosz(123_457, 23)).toBe(28_395);
  });

  it("obsługuje stawkę zero", () => {
    expect(computeVatGrosz(100_000, 0)).toBe(0);
  });
});

describe("computeLineAmounts", () => {
  it("składa netto, VAT i brutto", () => {
    const amounts = computeLineAmounts(10, 45_000, 23);
    expect(amounts).toEqual({
      netGrosz: 450_000,
      vatGrosz: 103_500,
      grossGrosz: 553_500,
    });
  });

  it("brutto jest zawsze sumą netto i VAT", () => {
    for (const hours of [0.25, 1, 1.5, 3.75, 12.3333]) {
      const amounts = computeLineAmounts(hours, 38_000, 23);
      expect(amounts.grossGrosz).toBe(amounts.netGrosz + amounts.vatGrosz);
    }
  });
});

describe("sumLineAmounts", () => {
  it("sumuje pozycje faktury", () => {
    const total = sumLineAmounts([
      computeLineAmounts(10, 45_000, 23),
      computeLineAmounts(5, 30_000, 23),
    ]);
    expect(total.netGrosz).toBe(450_000 + 150_000);
    expect(total.grossGrosz).toBe(total.netGrosz + total.vatGrosz);
  });

  it("suma faktury jest sumą ZAOKRĄGLONYCH pozycji", () => {
    // Gdyby VAT liczyć od sumy netto zamiast sumować VAT pozycji,
    // suma kontrolna na fakturze mogłaby się różnić o grosz.
    const lines = [
      computeLineAmounts(0.3333, 45_000, 23),
      computeLineAmounts(0.6667, 45_000, 23),
      computeLineAmounts(1.1666, 38_000, 23),
    ];
    const total = sumLineAmounts(lines);
    expect(total.vatGrosz).toBe(lines.reduce((sum, l) => sum + l.vatGrosz, 0));
    expect(total.grossGrosz).toBe(total.netGrosz + total.vatGrosz);
  });

  it("zwraca zera dla pustej listy", () => {
    expect(sumLineAmounts([])).toEqual({ netGrosz: 0, vatGrosz: 0, grossGrosz: 0 });
  });
});

describe("formatGrosz", () => {
  it("formatuje po polsku z symbolem waluty", () => {
    expect(normalize(formatGrosz(123_456))).toBe("1 234,56 zł");
  });

  it("zawsze pokazuje dwa miejsca po przecinku", () => {
    expect(normalize(formatGrosz(100_000))).toBe("1 000,00 zł");
    expect(normalize(formatGrosz(5))).toBe("0,05 zł");
  });

  it("wariant bez waluty nadaje się do kolumn tabeli", () => {
    expect(normalize(formatGroszPlain(123_456))).toBe("1 234,56");
  });
});

describe("parseAmountToGrosz", () => {
  it("przyjmuje przecinek jako separator dziesiętny", () => {
    expect(parseAmountToGrosz("1234,56")).toBe(123_456);
  });

  it("przyjmuje kropkę", () => {
    expect(parseAmountToGrosz("1234.56")).toBe(123_456);
  });

  it("ignoruje spacje i symbol waluty", () => {
    expect(parseAmountToGrosz("1 234,56 zł")).toBe(123_456);
    expect(parseAmountToGrosz("450 zł")).toBe(45_000);
  });

  it("przyjmuje liczbę całkowitą", () => {
    expect(parseAmountToGrosz("450")).toBe(45_000);
  });

  it("zwraca null dla wejścia, którego nie da się zinterpretować", () => {
    expect(parseAmountToGrosz("")).toBeNull();
    expect(parseAmountToGrosz("abc")).toBeNull();
    expect(parseAmountToGrosz("12,34,56")).toBeNull();
  });
});
