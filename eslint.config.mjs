import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    // Domyślne wykluczenia eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Katalog roboczy Supabase CLI — pliki obcego pochodzenia, tworzone
    // przy starcie środowiska lokalnego. Nie piszemy ich i nie utrzymujemy.
    "supabase/.temp/**",

    // Typy generowane ze schematu bazy (npm run db:types).
    "lib/database.types.ts",

    // Artefakty testów Playwright.
    "test-results/**",
    "playwright-report/**",
  ]),
]);

export default eslintConfig;
