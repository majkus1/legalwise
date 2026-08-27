import { expect, test, type Page } from "@playwright/test";
import { clickWhenReady, DEMO, login } from "./helpers";

/**
 * Wiersz kartoteki otwiera rekord kliknięciem w dowolne miejsce, ale nie
 * odbiera możliwości skopiowania z niego tekstu.
 *
 * To dwa wymagania, które łatwo pogodzić źle: puszczenie myszy po zaznaczeniu
 * też jest kliknięciem, więc naiwny `onClick` na wierszu otwierałby sprawę
 * przy każdej próbie skopiowania sygnatury.
 */

/** Przeciąga myszą przez wskazany element, tak jak przy zaznaczaniu tekstu. */
async function zaznaczPrzeciagajac(page: Page, selektor: string): Promise<void> {
  const ramka = await page.locator(selektor).first().boundingBox();
  if (!ramka) throw new Error(`brak elementu ${selektor}`);

  await page.mouse.move(ramka.x + 4, ramka.y + ramka.height / 2);
  await page.mouse.down();
  await page.mouse.move(ramka.x + ramka.width - 4, ramka.y + ramka.height / 2, { steps: 12 });
  await page.mouse.up();
}

test.describe("Klikalny wiersz kartoteki", () => {
  test("kliknięcie w dowolne miejsce wiersza otwiera sprawę", async ({ page }) => {
    await login(page, DEMO.owner);
    await page.goto("/sprawy");

    // Celujemy w komórkę statusu — daleko od odnośnika z numerem sprawy,
    // żeby sprawdzić wiersz, a nie sam odnośnik.
    const wiersz = page.getByRole("row").filter({ hasText: "2026/001" }).first();
    // Wiersz otwiera sprawę przez obsługę Reacta, więc klik przed hydratacją
    // przepada — inaczej niż na odnośniku w pierwszej kolumnie, który działa
    // od razu jako zwykły odnośnik.
    await clickWhenReady(wiersz.getByRole("cell").last());

    await expect(page).toHaveURL(/\/sprawy\/[0-9a-f-]{36}/);
    await expect(page.getByRole("heading", { name: /2026\/001/ })).toBeVisible();
  });

  test("zaznaczanie tekstu w wierszu NIE otwiera sprawy", async ({ page }) => {
    await login(page, DEMO.owner);
    await page.goto("/sprawy");
    const adresListy = page.url();

    await zaznaczPrzeciagajac(page, 'tr:has-text("2026/001") td:nth-child(2)');

    await expect(page.getByRole("heading", { name: "Sprawy" })).toBeVisible();
    expect(page.url(), "przeciągnięcie po tekście otworzyło sprawę").toBe(adresListy);

    const zaznaczony = await page.evaluate(() => window.getSelection()?.toString() ?? "");
    expect(zaznaczony.trim().length, "nic się nie zaznaczyło — test niczego nie sprawdził").toBeGreaterThan(0);
  });

  test("odnośnik w wierszu nadal działa i prowadzi do klienta", async ({ page }) => {
    await login(page, DEMO.owner);
    await page.goto("/klienci");

    // Wiersz klienta jest klikalny w całości, ale kliknięcie w odnośnik
    // obsługuje sam odnośnik — wiersz nie może mu wchodzić w drogę.
    await page.getByRole("link", { name: "Acme Polska Sp. z o.o." }).first().click();
    await expect(page).toHaveURL(/\/klienci\/[0-9a-f-]{36}/);
  });

  test("wiersz pokazuje kursor wskazujący klikalność", async ({ page }) => {
    await login(page, DEMO.owner);
    await page.goto("/sprawy");

    const kursor = await page
      .getByRole("row")
      .filter({ hasText: "2026/001" })
      .first()
      .evaluate((el) => getComputedStyle(el).cursor);
    expect(kursor).toBe("pointer");
  });
});
