/** Zakres znaków łączących (diakrytyków) powstających po rozkładzie NFD. */
const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * Normalizuje tekst do porównań przy wyszukiwaniu.
 *
 * Rozkład NFD oddziela większość polskich diakrytyków od liter bazowych, ale
 * „ł” nie ma postaci rozłożonej i wymaga osobnej podmiany. Bez tego wpisanie
 * „slowacki” nie znalazłoby sprawy „Słowacki”, a przy szybkim wpisywaniu czasu
 * nikt nie sięga po prawidłowe znaki diakrytyczne.
 */
export function normalizeForSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/ł/g, "l")
    .replace(/Ł/g, "l")
    .normalize("NFD")
    .replace(COMBINING_MARKS, "");
}

/** Czy `haystack` zawiera `needle`, ignorując wielkość liter i diakrytyki. */
export function matchesSearch(haystack: string, needle: string): boolean {
  return normalizeForSearch(haystack).includes(normalizeForSearch(needle));
}

/**
 * Odmiana rzeczownika przez liczebnik po polsku.
 *
 * Polski ma trzy formy, nie dwie: 1 sprawa, 2 sprawy, 5 spraw. Warunek
 * `liczba === 1 ? "sprawa" : "spraw"` daje więc „2 spraw" — a takie napisy
 * stoją w nagłówku każdej listy w aplikacji.
 *
 * Reguła: końcówka 2–4 bierze formę „kilku", ale nastolatki (12–14) wracają
 * do formy „wielu", stąd osobny warunek na resztę z dzielenia przez 100.
 */
export function plural(count: number, forms: [one: string, few: string, many: string]): string {
  if (count === 1) return forms[0];

  const withinHundred = Math.abs(count) % 100;
  const lastDigit = withinHundred % 10;

  if (lastDigit >= 2 && lastDigit <= 4 && !(withinHundred >= 12 && withinHundred <= 14)) {
    return forms[1];
  }
  return forms[2];
}

/** Liczba wraz z odmienionym rzeczownikiem, np. „5 spraw". */
export function countLabel(count: number, forms: [string, string, string]): string {
  return `${count} ${plural(count, forms)}`;
}
