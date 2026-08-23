/**
 * Operacje na kwotach pieniężnych.
 *
 * Kwoty w całym systemie są przechowywane i przeliczane WYŁĄCZNIE w groszach,
 * jako liczby całkowite. Typ float nigdy nie dotyka pieniędzy — 0.1 + 0.2 nie
 * daje 0.3 i przy fakturach kończy się to rozjazdem sum kontrolnych.
 */

/** Liczba miejsc dziesiętnych ilości na pozycji faktury — odpowiada numeric(12,4) w bazie. */
export const QUANTITY_SCALE = 10_000;

/**
 * Zaokrąglenie połówek "od zera", zgodne z funkcją round() dla typu numeric
 * w PostgreSQL. Math.round() zaokrągla połówki w stronę plus nieskończoności,
 * więc dla wartości ujemnych dałby inny wynik niż baza danych.
 */
export function roundHalfAwayFromZero(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

/**
 * Kwota netto pozycji faktury.
 *
 * Mnożenie idzie po liczbach całkowitych (ilość przeskalowana o 10^4), żeby
 * uniknąć dryfu zmiennoprzecinkowego przy typowych ilościach godzin.
 * Wynik musi być identyczny z tym, co wylicza trigger invoice_items_compute().
 */
export function computeNetGrosz(quantity: number, unitPriceNetGrosz: number): number {
  const scaledQuantity = roundHalfAwayFromZero(quantity * QUANTITY_SCALE);
  return roundHalfAwayFromZero((scaledQuantity * unitPriceNetGrosz) / QUANTITY_SCALE);
}

/** Kwota VAT od podanej kwoty netto. `vatRate` podawana w procentach, np. 23. */
export function computeVatGrosz(netGrosz: number, vatRate: number): number {
  return roundHalfAwayFromZero((netGrosz * vatRate) / 100);
}

export interface LineAmounts {
  netGrosz: number;
  vatGrosz: number;
  grossGrosz: number;
}

/**
 * Komplet kwot pozycji faktury. Zaokrąglamy raz, na poziomie pozycji —
 * suma faktury jest sumą zaokrąglonych pozycji, dzięki czemu suma kontrolna
 * zawsze się zgadza.
 */
export function computeLineAmounts(
  quantity: number,
  unitPriceNetGrosz: number,
  vatRate: number,
): LineAmounts {
  const netGrosz = computeNetGrosz(quantity, unitPriceNetGrosz);
  const vatGrosz = computeVatGrosz(netGrosz, vatRate);
  return { netGrosz, vatGrosz, grossGrosz: netGrosz + vatGrosz };
}

/** Suma kwot pozycji. */
export function sumLineAmounts(lines: readonly LineAmounts[]): LineAmounts {
  return lines.reduce<LineAmounts>(
    (acc, line) => ({
      netGrosz: acc.netGrosz + line.netGrosz,
      vatGrosz: acc.vatGrosz + line.vatGrosz,
      grossGrosz: acc.grossGrosz + line.grossGrosz,
    }),
    { netGrosz: 0, vatGrosz: 0, grossGrosz: 0 },
  );
}

// useGrouping: "always" jest tu świadomym odejściem od domyślnego zachowania
// lokalizacji pl-PL, która grupuje dopiero od pięciu cyfr ("1234,56 zł", ale
// "12 345,67 zł"). W zestawieniu finansowym kwoty stoją jedna pod drugą
// i niespójne grupowanie utrudnia porównywanie rzędów wielkości.
const currencyFormatter = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: "always",
});

const decimalFormatter = new Intl.NumberFormat("pl-PL", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: "always",
});

/** Kwota do wyświetlenia, np. 123456 → „1 234,56 zł”. */
export function formatGrosz(grosz: number): string {
  return currencyFormatter.format(grosz / 100);
}

/** Kwota bez symbolu waluty — do tabel, gdzie waluta jest w nagłówku kolumny. */
export function formatGroszPlain(grosz: number): string {
  return decimalFormatter.format(grosz / 100);
}

/**
 * Zamiana kwoty wpisanej przez użytkownika na grosze.
 * Przyjmuje zarówno przecinek, jak i kropkę, oraz spacje jako separator tysięcy.
 * Zwraca null, gdy wejścia nie da się zinterpretować.
 */
export function parseAmountToGrosz(input: string): number | null {
  const normalized = input
    .replace(/\s/g, "")
    .replace(/zł/gi, "")
    .replace(",", ".")
    .trim();

  if (normalized === "" || !/^-?\d+(\.\d+)?$/.test(normalized)) return null;

  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;

  return roundHalfAwayFromZero(value * 100);
}
