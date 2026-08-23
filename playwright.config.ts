import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });

/**
 * Testy end-to-end prowadzone przez prawdziwą przeglądarkę.
 *
 * Zakładają działający lokalny Supabase (`npm run db:start`) i dane
 * demonstracyjne (`npm run db:refresh`). Serwer deweloperski Playwright
 * uruchamia sam, na porcie 3100, żeby nie kolidować z ręcznie
 * uruchomionym `npm run dev`.
 */
/**
 * Gdy serwer deweloperski już działa (np. uruchomiony ręcznie), wskazujemy go
 * przez E2E_BASE_URL. Next 16 nie pozwala uruchomić drugiego serwera w tym
 * samym katalogu, więc próba wystartowania własnego skończyłaby się błędem.
 */
const EXISTING_URL = process.env.E2E_BASE_URL;
const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = EXISTING_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  // Testy dzielą jedną bazę danych, więc muszą iść po kolei.
  fullyParallel: false,
  workers: 1,
  // W trybie deweloperskim pierwsze wejście na trasę płaci za jej kompilację,
  // co potrafi zająć ponad minutę. To nie jest wada aplikacji.
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    locale: "pl-PL",
    timezoneId: "Europe/Warsaw",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: EXISTING_URL
    ? undefined
    : {
        command: `npm run dev -- --port ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 180_000,
        env: {
          NEXT_PUBLIC_SITE_URL: BASE_URL,
        },
      },
});
