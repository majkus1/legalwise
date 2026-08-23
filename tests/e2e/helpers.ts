import { expect, type Page } from "@playwright/test";

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
