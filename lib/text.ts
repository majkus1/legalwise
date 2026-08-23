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
