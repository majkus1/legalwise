/**
 * Walidacja polskich identyfikatorów.
 *
 * NIP trafia na fakturę i do struktury FA(3) wysyłanej do KSeF. Literówka
 * w numerze oznacza fakturę odrzuconą przez system albo — gorzej — przyjętą
 * na cudzy podmiot. Suma kontrolna wyłapuje większość pomyłek przy przepisywaniu.
 */

/** Wagi cyfr NIP przy liczeniu sumy kontrolnej. */
const NIP_WEIGHTS = [6, 5, 7, 2, 3, 4, 5, 6, 7] as const;

/** Usuwa myślniki i spacje — użytkownicy wpisują NIP na różne sposoby. */
export function normalizeTaxId(value: string): string {
  return value.replace(/[\s-]/g, "");
}

/**
 * Sprawdza poprawność NIP wraz z sumą kontrolną.
 *
 * Reszta z dzielenia przez 11 równa 10 oznacza numer niepoprawny — taki NIP
 * nie istnieje i nie da się dla niego wyliczyć cyfry kontrolnej.
 */
export function isValidTaxId(value: string): boolean {
  const digits = normalizeTaxId(value);
  if (!/^\d{10}$/.test(digits)) return false;

  const checksum = NIP_WEIGHTS.reduce(
    (sum, weight, index) => sum + weight * Number(digits[index]),
    0,
  );
  const remainder = checksum % 11;
  if (remainder === 10) return false;

  return remainder === Number(digits[9]);
}

/** NIP w postaci czytelnej: 1234567890 → 123-456-78-90. */
export function formatTaxId(value: string): string {
  const digits = normalizeTaxId(value);
  if (!/^\d{10}$/.test(digits)) return value;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`;
}

/**
 * Sprawdza format sygnatury akt, np. „I C 1234/25”, „XVI GC 1120/25”, „VII Pa 214/26”.
 *
 * Świadomie łagodna: sądy stosują wiele wariantów oznaczeń wydziałów, a zbyt
 * ostra walidacja blokowałaby wpisanie prawidłowej sygnatury. Odrzucamy tylko
 * to, co ewidentnie sygnaturą nie jest.
 */
export function looksLikeCourtSignature(value: string): boolean {
  return /^[IVXLC]+\s+[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]{1,4}\s+\d+\/\d{2,4}$/.test(value.trim());
}
