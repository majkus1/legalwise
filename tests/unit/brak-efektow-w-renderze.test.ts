import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Komunikat nie może być pokazywany z ciała renderu.
 *
 * Ciało komponentu wykonuje się przy każdym renderze, a `toast` wywołuje
 * kolejny render — powstaje pętla. W formularzu sprawy dało to trzydzieści
 * nakładających się potwierdzeń zapisu, rosnących z każdą sekundą.
 *
 * Wzorzec `if (state.message) toast.success(...)` wygląda niewinnie i łatwo
 * trafia do nowego formularza przez skopiowanie z sąsiedniego pliku, dlatego
 * pilnuje go test, a nie sama pamięć.
 *
 * Właściwe miejsce to `useActionFeedback`, który obsługuje wynik akcji raz.
 */

const KATALOGI = ["app", "components"];
const WYJATKI = ["components/use-action-feedback.ts"];

function zbierzPliki(katalog: string, wynik: string[] = []): string[] {
  for (const wpis of readdirSync(katalog)) {
    const pelna = path.join(katalog, wpis);
    if (statSync(pelna).isDirectory()) {
      zbierzPliki(pelna, wynik);
    } else if (/\.(tsx?|jsx?)$/.test(wpis)) {
      wynik.push(pelna);
    }
  }
  return wynik;
}

describe("skutki uboczne poza renderem", () => {
  it("żaden komponent nie wywołuje toast w ciele renderu", () => {
    const pliki = KATALOGI.flatMap((k) => zbierzPliki(path.join(process.cwd(), k)));
    const winowajcy: string[] = [];

    for (const plik of pliki) {
      const wzgledna = path.relative(process.cwd(), plik).replace(/\\/g, "/");
      if (WYJATKI.includes(wzgledna)) continue;

      const linie = readFileSync(plik, "utf8").split("\n");
      linie.forEach((linia, index) => {
        // Wcięcie dwóch spacji to poziom ciała komponentu. Wywołania wewnątrz
        // `useEffect` czy procedur obsługi zdarzeń są głębiej i są poprawne.
        if (/^ {2}(if \(.*\) )?toast\.(success|error|info|warning)\(/.test(linia)) {
          winowajcy.push(`${wzgledna}:${index + 1} → ${linia.trim().slice(0, 70)}`);
        }
      });
    }

    expect(winowajcy, `użyj useActionFeedback zamiast:\n${winowajcy.join("\n")}`).toEqual([]);
  });
});
