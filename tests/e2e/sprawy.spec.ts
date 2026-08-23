import { expect, test } from "@playwright/test";
import { DEMO, login } from "./helpers";

test.describe("Kartoteka spraw", () => {
  test("lista pokazuje sprawy z metryką sądową", async ({ page }) => {
    await login(page, DEMO.owner);
    await page.goto("/sprawy");

    await expect(page.getByRole("heading", { name: "Sprawy" })).toBeVisible();
    await expect(page.getByRole("link", { name: "2026/001" })).toBeVisible();
    // Sygnatura w prawidłowym formacie — element, po którym prawnik rozpoznaje sprawę.
    await expect(page.getByText("XVI GC 1120/25")).toBeVisible();
  });

  test("wyszukiwanie działa po sygnaturze", async ({ page }) => {
    await login(page, DEMO.owner);
    await page.goto("/sprawy");

    await page.getByLabel("Szukaj sprawy").fill("I C 1234/25");
    await page.getByRole("button", { name: "Szukaj" }).click();

    await expect(page.getByRole("link", { name: "2026/005" })).toBeVisible();
    await expect(page.getByRole("link", { name: "2026/001" })).toBeHidden();
  });

  test("strona sprawy pokazuje komplet zakładek i metrykę", async ({ page }) => {
    await login(page, DEMO.owner);
    await page.goto("/sprawy");
    await page.getByRole("link", { name: "2026/001" }).click();

    await expect(page.getByRole("heading", { name: /2026\/001/ })).toBeVisible();
    await expect(page.getByText("XVI GC 1120/25").first()).toBeVisible();
    await expect(page.getByText("Sąd Okręgowy w Warszawie")).toBeVisible();

    for (const tab of ["Przegląd", "Zadania", "Kalendarz", "Strony", "Notatki", "Dokumenty"]) {
      await expect(page.getByRole("tab", { name: new RegExp(tab) })).toBeVisible();
    }
  });

  test("zakładka Strony pokazuje pełnomocnika drugiej strony", async ({ page }) => {
    await login(page, DEMO.owner);
    await page.goto("/sprawy");
    await page.getByRole("link", { name: "2026/001" }).click();
    await page.getByRole("tab", { name: /Strony/ }).click();

    await expect(page.getByText("Pełnomocnik drugiej strony").first()).toBeVisible();
    await expect(page.getByText(/Lewandowski/)).toBeVisible();
  });

  test("notatka ze zdarzeniem jest widoczna w sprawie", async ({ page }) => {
    await login(page, DEMO.owner);
    await page.goto("/sprawy");
    await page.getByRole("link", { name: "2026/001" }).click();
    await page.getByRole("tab", { name: /Notatki/ }).click();

    await expect(page.getByText(/sekretariatem wydziału/)).toBeVisible();
  });

  test("prawnik nie widzi sprawy, której nie prowadzi", async ({ page }) => {
    // Anna prowadzi 2026/001 i 2026/007; sprawy 2026/003 prowadzi Michał
    // i Anna nie jest do niej przypisana.
    await login(page, DEMO.lawyer);
    await page.goto("/sprawy");

    await expect(page.getByRole("link", { name: "2026/001" })).toBeVisible();
    await expect(page.getByRole("link", { name: "2026/003" })).toBeHidden();
  });

  test("zakładanie sprawy nadaje numer automatycznie", async ({ page }) => {
    await login(page, DEMO.owner);
    await page.goto("/sprawy/nowa");

    await page.getByLabel("Klient").click();
    await page.getByRole("option", { name: "Acme Polska Sp. z o.o." }).click();

    await page.getByLabel("Nazwa sprawy").fill("Sprawa testowa z testu e2e");

    await page.getByLabel("Prawnik prowadzący").click();
    await page.getByRole("option", { name: "Bartosz Śliwiński" }).click();

    await page.getByRole("button", { name: "Załóż sprawę" }).click();

    // Po zapisaniu trafiamy na stronę sprawy z nadanym numerem w formacie RRRR/NNN.
    await expect(page).toHaveURL(/\/sprawy\/[0-9a-f-]{36}/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: /\d{4}\/\d{3} — Sprawa testowa/ })).toBeVisible();
  });
});
