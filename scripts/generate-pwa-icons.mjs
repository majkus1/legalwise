/**
 * Generuje ikony PWA z logo kancelarii.
 *
 * Uruchomienie: npm run generate:icons (wywoływane automatycznie przed buildem)
 *
 * Logo jest szerokie (proporcje ok. 4:1), więc skalujemy je po szerokości
 * i osadzamy na granatowym tle marki. Kwadratowa ikona z wpisanym w nią
 * szerokim znakiem słownym wygląda źle, dlatego dla małych rozmiarów
 * używamy samego znaku graficznego.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(dirname, "..", "public");
const iconsDir = path.join(publicDir, "icons");
const logoPath = path.join(publicDir, "logo-legal-wise.png");

/** Granat z logo — tło ikony. */
const BACKGROUND = "#191E39";
/** Złoto z logo — akcent w znaku graficznym. */
const GOLD = "#C08F48";

fs.mkdirSync(iconsDir, { recursive: true });

/**
 * Znak graficzny odtworzony jako SVG — schodkowa forma z logo.
 * Dla małych ikon czytelniejszy niż pomniejszony napis.
 */
function markSvg(size, { maskable = false } = {}) {
  // Android przycina ikonę maskowalną do kształtu; bezpieczna strefa to 80%.
  const scale = maskable ? 0.52 : 0.66;
  const glyph = Math.round(size * scale);
  const offset = Math.round((size - glyph) / 2);

  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <rect width="${size}" height="${size}" fill="${BACKGROUND}"/>
      <g transform="translate(${offset} ${offset}) scale(${glyph / 32})">
        <path d="M3 3h7v20h9v6H3V3Z" fill="#FFFFFF"/>
        <path d="M15 3h14v7h-7v13h-7V3Z" fill="${GOLD}"/>
      </g>
    </svg>
  `);
}

/** Ikona z pełnym logo — używana tam, gdzie jest miejsce na napis. */
async function wordmarkIcon(size, outName) {
  const logo = await sharp(logoPath).trim({ threshold: 12 }).png().toBuffer();
  const meta = await sharp(logo).metadata();
  const aspect = (meta.width ?? 1) / (meta.height ?? 1);

  const targetWidth = Math.round(size * 0.86);
  const targetHeight = Math.round(targetWidth / aspect);

  // Logo ma granatowy napis, więc na granatowym tle byłoby niewidoczne —
  // rozjaśniamy je do bieli, zachowując przezroczystość.
  const lightened = await sharp(logo)
    .resize(targetWidth, targetHeight, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .negate({ alpha: false })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BACKGROUND,
    },
  })
    .composite([{ input: lightened, gravity: "center" }])
    .png()
    .toFile(path.join(iconsDir, outName));
}

async function markIcon(size, outName, options) {
  await sharp(markSvg(size, options)).png().toFile(path.join(iconsDir, outName));
}

async function main() {
  if (!fs.existsSync(logoPath)) {
    throw new Error(`Nie znaleziono logo: ${logoPath}`);
  }

  await markIcon(192, "icon-192.png");
  await markIcon(512, "icon-512.png");
  // Ikona maskowalna: mniejszy znak, żeby przycięcie do koła lub kwadratu
  // z zaokrąglonymi rogami niczego nie ucięło.
  await markIcon(512, "maskable-512.png", { maskable: true });
  await markIcon(180, "apple-touch-icon.png");
  await markIcon(32, "favicon-32.png");
  await wordmarkIcon(512, "icon-wordmark-512.png");

  console.log("Wygenerowano ikony PWA w public/icons/");
}

main().catch((error) => {
  console.error("Generowanie ikon nie powiodło się:", error.message);
  process.exit(1);
});
