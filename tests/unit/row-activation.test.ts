import { describe, expect, it } from "vitest";
import { ROW_DRAG_TOLERANCE_PX, shouldActivateRow } from "@/lib/row-activation";

describe("shouldActivateRow", () => {
  it("zwykłe kliknięcie otwiera rekord", () => {
    expect(shouldActivateRow({ dx: 0, dy: 0, selectedText: "" })).toBe(true);
  });

  it("zaznaczony tekst blokuje otwarcie", () => {
    // Sedno sprawy: kopiowanie sygnatury z wiersza nie może kończyć się
    // przejściem do sprawy.
    expect(shouldActivateRow({ dx: 0, dy: 0, selectedText: "XVI GC 1120/25" })).toBe(false);
  });

  it("samo przeciągnięcie blokuje otwarcie, nawet bez zaznaczenia", () => {
    // Zaznaczenie potrafi zniknąć albo objąć pusty obszar — wtedy jedynym
    // śladem po próbie zaznaczania jest przebyta droga kursora.
    expect(
      shouldActivateRow({ dx: ROW_DRAG_TOLERANCE_PX + 1, dy: 0, selectedText: "" }),
    ).toBe(false);
    expect(
      shouldActivateRow({ dx: 0, dy: -(ROW_DRAG_TOLERANCE_PX + 1), selectedText: "" }),
    ).toBe(false);
  });

  it("drobne drgnięcie myszy to nadal kliknięcie", () => {
    // Bez tolerancji trafienie w wiersz wymagałoby nieruchomej ręki.
    expect(
      shouldActivateRow({ dx: ROW_DRAG_TOLERANCE_PX, dy: ROW_DRAG_TOLERANCE_PX, selectedText: "" }),
    ).toBe(true);
  });

  it("same białe znaki nie liczą się jako zaznaczenie", () => {
    // Kliknięcie w odstęp między kolumnami potrafi zaznaczyć spację —
    // to nie jest próba kopiowania.
    expect(shouldActivateRow({ dx: 0, dy: 0, selectedText: "   \n" })).toBe(true);
  });
});
