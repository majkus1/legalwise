/**
 * Rozróżnienie „kliknąłem wiersz" od „zaznaczałem w nim tekst".
 *
 * Wiersze kartoteki są klikalne w całości, co jest wygodne — ale przez to próba
 * skopiowania sygnatury albo nazwy klienta kończyłaby się otwarciem sprawy,
 * bo puszczenie myszy po zaznaczeniu też jest kliknięciem.
 *
 * Sprawdzamy dwie rzeczy naraz, bo żadna sama nie wystarcza:
 *  - czy coś zostało zaznaczone — łapie zaznaczanie wolne i dwuklikiem,
 *  - czy kursor przejechał kawałek drogi — łapie przeciągnięcie, po którym
 *    zaznaczenie zdążyło już zniknąć albo objęło pusty obszar.
 *
 * Ta sama zasada działa w panelu GolBud, na liście zleceń.
 */

/** Ile pikseli wolno „drgnąć" myszy, żeby to nadal było kliknięcie. */
export const ROW_DRAG_TOLERANCE_PX = 4;

export interface RowActivationInput {
  /** Przesunięcie kursora między wciśnięciem a puszczeniem przycisku. */
  dx: number;
  dy: number;
  /** Tekst zaznaczony w chwili puszczenia przycisku. */
  selectedText: string;
}

export function shouldActivateRow({ dx, dy, selectedText }: RowActivationInput): boolean {
  if (selectedText.trim().length > 0) return false;
  return Math.abs(dx) <= ROW_DRAG_TOLERANCE_PX && Math.abs(dy) <= ROW_DRAG_TOLERANCE_PX;
}
