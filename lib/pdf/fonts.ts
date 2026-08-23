import path from "node:path";
import { Font } from "@react-pdf/renderer";

/**
 * Rejestracja fontu dla dokumentów PDF.
 *
 * Wbudowane fonty PDF (Helvetica i pokrewne) używają kodowania WinAnsi, które
 * NIE zawiera polskich znaków diakrytycznych — „ą", „ę", „ł" wyszłyby jako
 * puste miejsca albo przypadkowe glify. Dokument dla klienta kancelarii musi
 * mieć poprawną polszczyznę, więc osadzamy pełny krój.
 *
 * Roboto pochodzi z pakietu roboto-fontface (licencja Apache 2.0), a pliki są
 * skopiowane do repozytorium, żeby budowanie nie zależało od sieci.
 */
const FONT_DIR = path.join(process.cwd(), "assets", "fonts");

let registered = false;

export const PDF_FONT_FAMILY = "Roboto";

export function registerPdfFonts(): void {
  if (registered) return;

  Font.register({
    family: PDF_FONT_FAMILY,
    fonts: [
      { src: path.join(FONT_DIR, "Roboto-Regular.woff"), fontWeight: 400 },
      { src: path.join(FONT_DIR, "Roboto-Medium.woff"), fontWeight: 500 },
      { src: path.join(FONT_DIR, "Roboto-Bold.woff"), fontWeight: 700 },
    ],
  });

  // Domyślny podział wyrazów rozcina polskie słowa w przypadkowych miejscach.
  // W dokumencie księgowym wolimy dłuższy wiersz niż błędny przenośnik.
  Font.registerHyphenationCallback((word) => [word]);

  registered = true;
}

/** Kolory marki użyte w dokumentach — te same co w interfejsie. */
export const PDF_COLORS = {
  navy: "#191E39",
  gold: "#C08F48",
  text: "#191E39",
  muted: "#6D7181",
  border: "#E3E4EA",
  subtleBackground: "#F3F4F7",
} as const;
