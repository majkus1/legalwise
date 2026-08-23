import { expect, type Page } from "@playwright/test";
import { Client as PgClient } from "pg";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });

const DB_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";

/**
 * Cofa stan rozliczeń do punktu wyjścia: usuwa faktury, zwalnia godziny
 * i zeruje licznik numerów.
 *
 * Testy fakturowania zużywają godziny — bez tego drugi przebieg tego samego
 * zestawu zastawałby klienta bez niczego do zafakturowania i wyglądałoby to
 * jak usterka aplikacji, choć byłoby jej poprawnym zachowaniem.
 *
 * Świadomie NIE ruszamy kont, klientów, spraw ani wpisów czasu — pełny
 * `db:reset` wylogowałby wszystkich i wymagał ponownego zasiania danych.
 */
export async function resetInvoicing(): Promise<void> {
  const client = new PgClient({ connectionString: DB_URL });
  await client.connect();
  try {
    // session_replication_role = replica wyłącza triggery na czas sesji.
    // Jest to potrzebne, bo trigger invoice_items_guard_approved słusznie
    // blokuje zmianę pozycji zatwierdzonej faktury — również przed zapytaniem
    // wykonanym wprost w bazie. To sprzątanie po testach, a nie obejście
    // reguły biznesowej.
    await client.query(`
      set session_replication_role = replica;
      update public.time_entries set invoice_id = null, locked_at = null;
      delete from public.invoice_items;
      delete from public.invoices;
      delete from public.invoice_sequences;
      set session_replication_role = default;
    `);
  } finally {
    await client.end();
  }
}

/** Konta z danych demonstracyjnych (`npm run db:seed`). */
export const DEMO = {
  password: "Kancelaria2026!",
  owner: "bartosz@legal-wise.test",
  partner: "michal@legal-wise.test",
  lawyer: "anna@legal-wise.test",
  staff: "katarzyna@legal-wise.test",
} as const;

export async function login(page: Page, email: string): Promise<void> {
  await page.goto("/logowanie");
  await page.getByLabel("Adres e-mail").fill(email);
  await page.getByLabel("Hasło", { exact: true }).fill(DEMO.password);
  await page.getByRole("button", { name: "Zaloguj się" }).click();

  // Asercja musi sprawdzać, że NIE jesteśmy już na ekranie logowania.
  // Wzorzec dopasowujący „dowolny adres” przepuszczałby nieudane logowanie
  // i ukrywał prawdziwą przyczynę błędów w kolejnych krokach.
  await expect(page).not.toHaveURL(/\/logowanie/, { timeout: 20_000 });
  await expect(page.getByRole("navigation")).toBeVisible();
}

export async function logout(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Wyloguj się" }).click();
  await expect(page).toHaveURL(/\/logowanie/);
}
