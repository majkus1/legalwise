import { describe, expect, it } from "vitest";
import {
  formatTaxId,
  isValidTaxId,
  looksLikeCourtSignature,
  normalizeTaxId,
} from "@/lib/validation";

describe("normalizeTaxId", () => {
  it("usuwa myślniki i spacje", () => {
    expect(normalizeTaxId("123-456-78-90")).toBe("1234567890");
    expect(normalizeTaxId("123 456 78 90")).toBe("1234567890");
  });
});

describe("isValidTaxId", () => {
  it("przyjmuje NIP z poprawną sumą kontrolną", () => {
    // NIP-y użyte w danych demonstracyjnych — wszystkie z prawidłową cyfrą kontrolną.
    expect(isValidTaxId("5213874116")).toBe(true);
    expect(isValidTaxId("7010234565")).toBe(true);
  });

  it("przyjmuje NIP zapisany z myślnikami", () => {
    expect(isValidTaxId("521-387-41-16")).toBe(true);
  });

  it("odrzuca NIP z błędną cyfrą kontrolną", () => {
    // Ta sama liczba z podmienioną ostatnią cyfrą — najczęstsza literówka.
    expect(isValidTaxId("5213874115")).toBe(false);
  });

  it("odrzuca niepoprawną długość", () => {
    expect(isValidTaxId("52138741")).toBe(false);
    expect(isValidTaxId("52138741160")).toBe(false);
  });

  it("odrzuca wartości nieliczbowe", () => {
    expect(isValidTaxId("PL52138741")).toBe(false);
    expect(isValidTaxId("")).toBe(false);
  });

  it("odrzuca numery, dla których reszta z dzielenia wynosi 10", () => {
    // Dla bazy 100000016 suma ważona wynosi 54, a 54 % 11 = 10 — dla takiego
    // zestawu cyfr nie istnieje ŻADNA poprawna cyfra kontrolna.
    for (let checkDigit = 0; checkDigit <= 9; checkDigit += 1) {
      expect(isValidTaxId(`100000016${checkDigit}`)).toBe(false);
    }
  });

  it("przyjmuje NIP, w którym wszystkie cyfry są takie same, jeśli suma się zgadza", () => {
    // 1111111111 wygląda podejrzanie, ale suma ważona daje 45, a 45 % 11 = 1,
    // co zgadza się z cyfrą kontrolną. Walidacja sumy kontrolnej nie jest
    // wykrywaczem numerów zmyślonych — i nie należy jej za taki brać.
    expect(isValidTaxId("1111111111")).toBe(true);
  });
});

describe("formatTaxId", () => {
  it("formatuje do postaci czytelnej", () => {
    expect(formatTaxId("5213874116")).toBe("521-387-41-16");
  });

  it("zostawia bez zmian wartość, która nie jest dziesięciocyfrowa", () => {
    expect(formatTaxId("brak")).toBe("brak");
  });
});

describe("looksLikeCourtSignature", () => {
  it("przyjmuje typowe sygnatury", () => {
    expect(looksLikeCourtSignature("I C 1234/25")).toBe(true);
    expect(looksLikeCourtSignature("XVI GC 1120/25")).toBe(true);
    expect(looksLikeCourtSignature("VII Pa 214/26")).toBe(true);
    expect(looksLikeCourtSignature("VIII GC 89/26")).toBe(true);
  });

  it("odrzuca tekst, który sygnaturą nie jest", () => {
    expect(looksLikeCourtSignature("brak sygnatury")).toBe(false);
    expect(looksLikeCourtSignature("1234/25")).toBe(false);
    expect(looksLikeCourtSignature("")).toBe(false);
  });
});
