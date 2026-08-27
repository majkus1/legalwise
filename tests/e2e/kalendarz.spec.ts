import { expect, test } from "@playwright/test";
import { clickWhenReady, DEMO, login } from "./helpers";

/**
 * Siatka miesiąca ma być narzędziem, a nie obrazkiem.
 *
 * Pierwotnie dni były zwykłym tekstem: kliknięcie nic nie dawało, a szczegóły
 * trzeba było wyszukiwać wzrokiem w liście całego miesiąca pod spodem.
 *
 * Wybrany dzień trzymamy w adresie, a nie w stanie komponentu — dzięki temu
 * widok przeżywa odświeżenie, działa przycisk „wstecz" i da się wysłać link
 * współpracownikowi.
 */
test.describe("Kalendarz — wybór dnia", () => {
  test("kliknięcie w dzień zawęża listę do tego dnia", async ({ page }) => {
    await login(page, DEMO.owner);
    await page.goto("/kalendarz");

    const wszystkie = await page.locator("ul.divide-y > li").count();
    expect(wszystkie, "brak terminów w danych demonstracyjnych").toBeGreaterThan(1);

    const dzienZTerminem = page.getByRole("link", { name: /terminów: [1-9]/ }).first();
    await clickWhenReady(dzienZTerminem);

    await expect(page).toHaveURL(/dzien=\d{4}-\d{2}-\d{2}/);
    await expect(page.getByRole("heading", { name: /^Terminy — / })).toBeVisible();

    const wybrane = await page.locator("ul.divide-y > li").count();
    expect(wybrane, "lista nie zawęziła się do jednego dnia").toBeLessThan(wszystkie);
  });

  test("ponowne kliknięcie zdejmuje zaznaczenie", async ({ page }) => {
    await login(page, DEMO.owner);
    await page.goto("/kalendarz");

    const wszystkie = await page.locator("ul.divide-y > li").count();
    await clickWhenReady(page.getByRole("link", { name: /terminów: [1-9]/ }).first());
    await expect(page).toHaveURL(/dzien=/);

    // Po nawigacji lokator musi zostać wyznaczony na nowo — poprzedni wskazuje
    // węzeł sprzed przerysowania.
    await clickWhenReady(page.locator('a[aria-current="date"]'));

    await expect(page).not.toHaveURL(/dzien=/);
    await expect(page.getByRole("heading", { name: "Lista terminów" })).toBeVisible();
    expect(await page.locator("ul.divide-y > li").count()).toBe(wszystkie);
  });

  test("dzień bez terminów mówi wprost, że jest pusty", async ({ page }) => {
    await login(page, DEMO.owner);
    await page.goto("/kalendarz");

    await clickWhenReady(page.getByRole("link", { name: /brak terminów/ }).first());
    await expect(page).toHaveURL(/dzien=/);

    // Tytuł stanu pustego to akapit, a nie nagłówek — celujemy w tekst.
    await expect(page.getByText(/^Brak terminów \d{2}\./)).toBeVisible();
    await expect(page.getByRole("link", { name: "Pokaż cały miesiąc" })).toBeVisible();
  });

  test("wybór dnia przeżywa odświeżenie strony", async ({ page }) => {
    await login(page, DEMO.owner);
    await page.goto("/kalendarz");

    await clickWhenReady(page.getByRole("link", { name: /terminów: [1-9]/ }).first());
    // Adres odczytujemy dopiero po dojściu nawigacji: wcześniej zapisalibyśmy
    // ten sprzed kliknięcia i test przechodziłby, niczego nie sprawdzając.
    await expect(page).toHaveURL(/dzien=\d{4}-\d{2}-\d{2}/);
    const adres = page.url();

    await page.reload();

    expect(page.url()).toBe(adres);
    await expect(page.getByRole("heading", { name: /^Terminy — / })).toBeVisible();
    await expect(page.locator('a[aria-current="date"]')).toHaveCount(1);
  });
});
