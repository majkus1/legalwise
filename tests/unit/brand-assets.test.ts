import { describe, expect, it } from "vitest";
import path from "node:path";
import sharp from "sharp";

/**
 * Warianty logo są wytwarzane skryptem, więc łatwo je zepsuć niepostrzeżenie.
 *
 * Poprzednia wersja generatora rozjaśniała logo przez `negate()`, co odwraca
 * wszystkie kanały naraz — złoto kancelarii #C08F48 wychodziło jako niebieski
 * #3F70B7. Na małej ikonie nikt tego nie zauważył. Te testy pilnują, że barwa
 * marki przeżywa każdą przeróbkę.
 */

const PUBLIC_DIR = path.join(process.cwd(), "public");

const GRANAT = { r: 0x19, g: 0x1e, b: 0x39 };
const ZLOTO = { r: 0xc0, g: 0x8f, b: 0x48 };

/** Zlicza piksele według barwy, pomijając przezroczyste. */
async function barwy(plik: string): Promise<Map<string, number>> {
  const { data, info } = await sharp(path.join(PUBLIC_DIR, plik))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const licznik = new Map<string, number>();
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i + 3] < 16) continue;
    const klucz = `${data[i]},${data[i + 1]},${data[i + 2]}`;
    licznik.set(klucz, (licznik.get(klucz) ?? 0) + 1);
  }
  return licznik;
}

const udzial = (licznik: Map<string, number>, c: { r: number; g: number; b: number }) => {
  const suma = [...licznik.values()].reduce((a, b) => a + b, 0);
  return (licznik.get(`${c.r},${c.g},${c.b}`) ?? 0) / suma;
};

describe("warianty logo", () => {
  it("oryginał zachowuje obie barwy marki", async () => {
    const licznik = await barwy("logo-legal-wise.png");
    expect(udzial(licznik, GRANAT)).toBeGreaterThan(0.5);
    expect(udzial(licznik, ZLOTO)).toBeGreaterThan(0.1);
  });

  it("wersja rewersowa rozjaśnia granat, ale NIE rusza złota", async () => {
    const licznik = await barwy("logo-legal-wise-rewers.png");

    // Złoto zostaje złotem — to jest sedno tego testu.
    expect(udzial(licznik, ZLOTO)).toBeGreaterThan(0.1);
    // Granatu nie może już być, inaczej logo znika na ciemnym tle.
    expect(udzial(licznik, GRANAT)).toBe(0);
  });

  it("wersja rewersowa nie odwraca złota na niebieski", async () => {
    const licznik = await barwy("logo-legal-wise-rewers.png");

    // Dokładnie ten kolor produkowało `negate()` z barwy złota.
    const poNegacji = { r: 255 - ZLOTO.r, g: 255 - ZLOTO.g, b: 255 - ZLOTO.b };
    expect(udzial(licznik, poNegacji)).toBe(0);
  });

  it("znak graficzny jest wycięty z oryginału i ma obie barwy", async () => {
    const znak = await barwy("logo-legal-wise-znak.png");
    expect(udzial(znak, GRANAT)).toBeGreaterThan(0.3);
    expect(udzial(znak, ZLOTO)).toBeGreaterThan(0.1);

    // Kadr kończy się przed napisem, więc znak jest prawie kwadratowy.
    const meta = await sharp(path.join(PUBLIC_DIR, "logo-legal-wise-znak.png")).metadata();
    expect((meta.width ?? 0) / (meta.height ?? 1)).toBeGreaterThan(0.8);
    expect((meta.width ?? 0) / (meta.height ?? 1)).toBeLessThan(1.2);
  });

  it("ikona aplikacji niesie prawdziwy znak w barwach marki", async () => {
    const licznik = await barwy("icons/icon-192.png");

    // Granatowe tło ikony plus złoto ze znaku — czyli znak, a nie sam kwadrat.
    expect(udzial(licznik, GRANAT)).toBeGreaterThan(0.4);
    expect(udzial(licznik, ZLOTO)).toBeGreaterThan(0.02);
  });
});
