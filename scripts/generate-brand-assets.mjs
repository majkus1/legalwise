/**
 * Wytwarza wszystkie warianty logo kancelarii z jednego pliku źródłowego.
 *
 * Uruchomienie: npm run generate:brand (wywoływane automatycznie przed buildem)
 *
 * ZASADA: niczego tu nie rysujemy od nowa. Znak firmowy kancelarii jest ich
 * własnością i każde „odtworzenie go z pamięci" daje kształt, który nie jest
 * ich znakiem. Wszystkie warianty powstają wyłącznie przez kadrowanie
 * i przebarwienie tuszu w oryginalnym pliku — proporcje, kształty i krój liter
 * zostają nietknięte.
 *
 * Plik źródłowy ma przezroczyste tło i dokładnie dwie barwy: granat #191E39
 * i złoto #C08F48. Krawędzie wygładza sam kanał alfa, a nie półtony barw,
 * więc podmiana koloru jest bezstratna — nie powstają obwódki.
 *
 * Gdy kancelaria przyśle poprawione logo, wystarczy podmienić plik źródłowy
 * i uruchomić ten skrypt ponownie.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(dirname, "..", "public");
const iconsDir = path.join(publicDir, "icons");
const logoPath = path.join(publicDir, "logo-legal-wise.png");

/** Granat z logo — tło ikon i panelu bocznego. */
const NAVY = { r: 0x19, g: 0x1e, b: 0x39 };
/** Złoto z logo. Zostaje złotem w każdym wariancie. */
const GOLD = { r: 0xc0, g: 0x8f, b: 0x48 };

/**
 * Obszar samego znaku graficznego w pliku źródłowym.
 *
 * Wartości zmierzone na kanale alfa: znak zajmuje x 21–263, y 21–272,
 * a od bloku tekstowego dzieli go 52-pikselowa przerwa. Kadrujemy po niej,
 * więc do znaku nie wchodzi żaden fragment liter.
 */
const MARK = { left: 21, top: 21, width: 243, height: 252 };

/**
 * Zamienia OKLCH na sRGB.
 *
 * Tusz wersji rewersowej bierzemy wprost z tokenu `--sidebar-foreground`,
 * żeby logo w panelu bocznym miało dokładnie tę samą biel co podpisy obok
 * niego. Czysta biel byłaby o włos jaśniejsza od reszty i logo odcinałoby się
 * od interfejsu jak wklejka.
 */
function oklchToRgb(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const bb = C * Math.sin(h);

  const l = (L + 0.3963377774 * a + 0.2158037573 * bb) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * bb) ** 3;
  const s = (L - 0.089484178 * a - 1.291485548 * bb) ** 3;

  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];

  const toSrgb = (v) => {
    const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    return Math.max(0, Math.min(255, Math.round(c * 255)));
  };

  return { r: toSrgb(linear[0]), g: toSrgb(linear[1]), b: toSrgb(linear[2]) };
}

/** Biel z tokenu --sidebar-foreground: oklch(0.93 0.008 274.04). */
const REVERSED_INK = oklchToRgb(0.93, 0.008, 274.04);

/**
 * Przebarwia granatowy tusz na zadany kolor, zostawiając złoto bez zmian.
 *
 * Świadomie NIE używamy `negate()`: odwraca ono wszystkie kanały, więc złoto
 * #C08F48 wychodzi jako niebieski #3F70B7 — logo traci barwę marki.
 * Tu klasyfikujemy każdy piksel po odległości od dwóch barw źródłowych
 * i ruszamy wyłącznie granat.
 */
async function recolorInk(inputBuffer, ink) {
  const { data, info } = await sharp(inputBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const odleglosc = (i, c) =>
    (data[i] - c.r) ** 2 + (data[i + 1] - c.g) ** 2 + (data[i + 2] - c.b) ** 2;

  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i + 3] === 0) continue;
    if (odleglosc(i, NAVY) <= odleglosc(i, GOLD)) {
      data[i] = ink.r;
      data[i + 1] = ink.g;
      data[i + 2] = ink.b;
    }
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  })
    .png()
    .toBuffer();
}

/** Osadza znak na granatowym kwadracie — ikona aplikacji. */
async function squareIcon(markBuffer, size, outName, { safeArea = 0.66 } = {}) {
  const glyph = Math.round(size * safeArea);
  const scaled = await sharp(markBuffer)
    .resize(glyph, glyph, { fit: "inside", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background: NAVY },
  })
    .composite([{ input: scaled, gravity: "center" }])
    .png()
    .toFile(path.join(iconsDir, outName));
}

async function main() {
  if (!fs.existsSync(logoPath)) {
    throw new Error(`Nie znaleziono logo: ${logoPath}`);
  }
  fs.mkdirSync(iconsDir, { recursive: true });

  const zrodlo = await sharp(logoPath).ensureAlpha().png().toBuffer();

  // 1. Pełne logo w wersji rewersowej — na granatowy panel i ciemny motyw.
  const pelneRewers = await recolorInk(zrodlo, REVERSED_INK);
  await sharp(pelneRewers).toFile(path.join(publicDir, "logo-legal-wise-rewers.png"));

  // 2. Sam znak graficzny, w obu wersjach. Przydaje się tam, gdzie na napis
  //    nie ma miejsca — w wąskim panelu i w ikonie aplikacji.
  const znak = await sharp(zrodlo).extract(MARK).png().toBuffer();
  await sharp(znak).toFile(path.join(publicDir, "logo-legal-wise-znak.png"));

  const znakRewers = await recolorInk(znak, REVERSED_INK);
  await sharp(znakRewers).toFile(path.join(publicDir, "logo-legal-wise-znak-rewers.png"));

  // 3. Ikony PWA — prawdziwy znak kancelarii na granatowym tle.
  await squareIcon(znakRewers, 192, "icon-192.png");
  await squareIcon(znakRewers, 512, "icon-512.png");
  // Android przycina ikonę maskowalną do koła lub zaokrąglonego kwadratu,
  // więc znak musi zmieścić się w bezpiecznej strefie 80%.
  await squareIcon(znakRewers, 512, "maskable-512.png", { safeArea: 0.52 });
  await squareIcon(znakRewers, 180, "apple-touch-icon.png");
  await squareIcon(znakRewers, 32, "favicon-32.png", { safeArea: 0.78 });

  const ink = `rgb(${REVERSED_INK.r}, ${REVERSED_INK.g}, ${REVERSED_INK.b})`;
  console.log(`Warianty logo i ikony gotowe. Tusz wersji rewersowej: ${ink}`);
}

main().catch((error) => {
  console.error("Generowanie materiałów marki nie powiodło się:", error.message);
  process.exit(1);
});
