import { describe, expect, it } from "vitest";
import {
  buildFa3Xml,
  escapeXml,
  formatQuantity,
  groszToDecimal,
  summarizeVat,
  FA3_NAMESPACE,
  type Fa3Invoice,
} from "@/lib/ksef/fa3";

const seller = {
  taxId: "5213874116",
  name: "Legal-Wise Śliwiński & Kucharski",
  countryCode: "PL",
  addressLine1: "ul. Emilii Plater 53",
  addressLine2: "00-113 Warszawa",
};

const buyer = {
  taxId: "7010234565",
  name: "Acme Polska Sp. z o.o.",
  countryCode: "PL",
  addressLine1: "ul. Domaniewska 44",
  addressLine2: "02-672 Warszawa",
};

function invoice(overrides: Partial<Fa3Invoice> = {}): Fa3Invoice {
  return {
    number: "FV/7/2026",
    issueDate: "2026-08-31",
    saleDate: "2026-08-31",
    dueDate: "2026-09-14",
    currency: "PLN",
    seller,
    buyer,
    lines: [
      {
        name: "Pomoc prawna — 2026/001 Acme przeciwko Beta Trade",
        unit: "godz.",
        quantity: 12.5,
        unitPriceNetGrosz: 45_000,
        netGrosz: 562_500,
        vatRate: 23,
      },
    ],
    generatedAt: new Date("2026-08-31T09:15:00Z"),
    ...overrides,
  };
}

describe("escapeXml", () => {
  it("zabezpiecza znaki specjalne", () => {
    expect(escapeXml('Kowalski & Wspólnicy "S.A."')).toBe(
      "Kowalski &amp; Wspólnicy &quot;S.A.&quot;",
    );
    expect(escapeXml("a < b > c")).toBe("a &lt; b &gt; c");
  });

  it("zostawia polskie znaki bez zmian", () => {
    expect(escapeXml("Śliwiński Żółć")).toBe("Śliwiński Żółć");
  });
});

describe("groszToDecimal", () => {
  it("zapisuje kwotę z dwoma miejscami po kropce", () => {
    expect(groszToDecimal(123_456)).toBe("1234.56");
    expect(groszToDecimal(100)).toBe("1.00");
    expect(groszToDecimal(5)).toBe("0.05");
    expect(groszToDecimal(0)).toBe("0.00");
  });

  it("obsługuje wartości ujemne (faktury korygujące)", () => {
    expect(groszToDecimal(-123_456)).toBe("-1234.56");
  });
});

describe("formatQuantity", () => {
  it("nie zostawia zbędnych zer", () => {
    expect(formatQuantity(12.5)).toBe("12.5");
    expect(formatQuantity(1)).toBe("1");
  });

  it("ogranicza do sześciu miejsc dziesiętnych", () => {
    expect(formatQuantity(0.3333333333)).toBe("0.333333");
  });
});

describe("summarizeVat", () => {
  it("sumuje wartości w rozbiciu na stawki", () => {
    const summary = summarizeVat([
      { name: "a", unit: "godz.", quantity: 1, unitPriceNetGrosz: 100_000, netGrosz: 100_000, vatRate: 23 },
      { name: "b", unit: "godz.", quantity: 1, unitPriceNetGrosz: 50_000, netGrosz: 50_000, vatRate: 23 },
      { name: "c", unit: "szt.", quantity: 1, unitPriceNetGrosz: 20_000, netGrosz: 20_000, vatRate: 8 },
    ]);

    expect(summary).toEqual([
      { vatRate: 23, netGrosz: 150_000, vatGrosz: 34_500 },
      { vatRate: 8, netGrosz: 20_000, vatGrosz: 1_600 },
    ]);
  });

  it("liczy VAT od sumy netto stawki, a nie jako sumę podatku z pozycji", () => {
    // Dwie pozycje po 0,01 zł netto: podatek z każdej osobno zaokrągliłby się
    // do zera, a od sumy wynosi już 1 grosz przy odpowiedniej wartości.
    const summary = summarizeVat([
      { name: "a", unit: "szt.", quantity: 1, unitPriceNetGrosz: 3, netGrosz: 3, vatRate: 23 },
      { name: "b", unit: "szt.", quantity: 1, unitPriceNetGrosz: 3, netGrosz: 3, vatRate: 23 },
    ]);
    expect(summary[0].netGrosz).toBe(6);
    expect(summary[0].vatGrosz).toBe(1);
  });
});

describe("buildFa3Xml", () => {
  it("używa przestrzeni nazw i elementu głównego zgodnych ze wzorem", () => {
    const xml = buildFa3Xml(invoice());
    expect(xml).toContain(`<Faktura xmlns="${FA3_NAMESPACE}">`);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });

  it("deklaruje wariant formularza 3", () => {
    const xml = buildFa3Xml(invoice());
    expect(xml).toContain("<WariantFormularza>3</WariantFormularza>");
    expect(xml).toContain('kodSystemowy="FA (3)"');
  });

  it("zawiera wszystkie sekcje obowiązkowe", () => {
    const xml = buildFa3Xml(invoice());
    for (const section of ["Naglowek", "Podmiot1", "Podmiot2", "Fa", "Adnotacje"]) {
      expect(xml, `brak sekcji ${section}`).toContain(`<${section}>`);
    }
  });

  it("umieszcza numer, daty i kwoty faktury", () => {
    const xml = buildFa3Xml(invoice());
    expect(xml).toContain("<P_2>FV/7/2026</P_2>");
    expect(xml).toContain("<P_1>2026-08-31</P_1>");
    expect(xml).toContain("<P_6>2026-08-31</P_6>");
    // 5625,00 netto, VAT 23% = 1293,75, brutto 6918,75
    expect(xml).toContain("<P_13_1>5625.00</P_13_1>");
    expect(xml).toContain("<P_14_1>1293.75</P_14_1>");
    expect(xml).toContain("<P_15>6918.75</P_15>");
  });

  it("zapisuje pozycję z ilością godzin i ceną jednostkową", () => {
    const xml = buildFa3Xml(invoice());
    expect(xml).toContain("<NrWierszaFa>1</NrWierszaFa>");
    expect(xml).toContain("<P_8A>godz.</P_8A>");
    expect(xml).toContain("<P_8B>12.5</P_8B>");
    expect(xml).toContain("<P_9A>450.00</P_9A>");
    expect(xml).toContain("<P_11>5625.00</P_11>");
    expect(xml).toContain("<P_12>23</P_12>");
  });

  it("numeruje pozycje kolejno", () => {
    const xml = buildFa3Xml(
      invoice({
        lines: [
          { name: "a", unit: "godz.", quantity: 1, unitPriceNetGrosz: 45_000, netGrosz: 45_000, vatRate: 23 },
          { name: "b", unit: "godz.", quantity: 2, unitPriceNetGrosz: 38_000, netGrosz: 76_000, vatRate: 23 },
        ],
      }),
    );
    expect(xml).toContain("<NrWierszaFa>1</NrWierszaFa>");
    expect(xml).toContain("<NrWierszaFa>2</NrWierszaFa>");
  });

  it("zabezpiecza znaki specjalne w nazwie sprzedawcy", () => {
    const xml = buildFa3Xml(invoice());
    expect(xml).toContain("Legal-Wise Śliwiński &amp; Kucharski");
    expect(xml).not.toContain("Kucharski</Nazwa>&");
  });

  it("oznacza nabywcę bez NIP jako podmiot bez identyfikatora", () => {
    const xml = buildFa3Xml(
      invoice({ buyer: { ...buyer, taxId: null, name: "Jan Kowalski" } }),
    );
    expect(xml).toContain("<BrakID>1</BrakID>");
    expect(xml).toContain("<Nazwa>Jan Kowalski</Nazwa>");
  });

  it("dodaje termin płatności, gdy jest ustalony", () => {
    const xml = buildFa3Xml(invoice());
    expect(xml).toContain("<Termin>2026-09-14</Termin>");
  });

  it("pomija sekcję płatności, gdy terminu nie ma", () => {
    const xml = buildFa3Xml(invoice({ dueDate: null }));
    expect(xml).not.toContain("<Platnosc>");
  });

  it("nie zależy od zegara systemowego", () => {
    // Moment wytworzenia jest przekazywany, nie odczytywany — dzięki temu
    // ten sam dokument wygenerowany dwa razy jest identyczny.
    const first = buildFa3Xml(invoice());
    const second = buildFa3Xml(invoice());
    expect(first).toBe(second);
    expect(first).toContain("<DataWytworzeniaFa>2026-08-31T09:15:00Z</DataWytworzeniaFa>");
  });

  it("obsługuje kilka stawek podatku na jednej fakturze", () => {
    const xml = buildFa3Xml(
      invoice({
        lines: [
          { name: "a", unit: "godz.", quantity: 1, unitPriceNetGrosz: 100_000, netGrosz: 100_000, vatRate: 23 },
          { name: "b", unit: "szt.", quantity: 1, unitPriceNetGrosz: 50_000, netGrosz: 50_000, vatRate: 8 },
        ],
      }),
    );
    expect(xml).toContain("<P_13_1>1000.00</P_13_1>");
    expect(xml).toContain("<P_13_2>500.00</P_13_2>");
    expect(xml).toContain("<P_14_2>40.00</P_14_2>");
    // Brutto: 1000 + 230 + 500 + 40 = 1770,00
    expect(xml).toContain("<P_15>1770.00</P_15>");
  });
});
