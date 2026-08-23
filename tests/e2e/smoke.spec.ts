import { expect, test } from "@playwright/test";
import { DEMO, login } from "./helpers";

test.describe("Podstawowa ścieżka użytkownika", () => {
  test("właściciel loguje się i widzi pulpit z danymi", async ({ page }) => {
    await login(page, DEMO.owner);

    await expect(page.getByRole("heading", { name: /Dzień dobry/ })).toBeVisible();
    await expect(page.getByText("Ten tydzień")).toBeVisible();
    // Nazwa kancelarii w panelu bocznym.
    await expect(page.getByRole("navigation")).toBeVisible();
  });

  test("kartoteka klientów pokazuje dane i pozwala szukać", async ({ page }) => {
    await login(page, DEMO.owner);
    await page.goto("/klienci");

    await expect(page.getByRole("heading", { name: "Klienci" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Acme Polska Sp. z o.o." })).toBeVisible();

    await page.getByLabel("Szukaj klienta").fill("Nordwind");
    await page.getByRole("button", { name: "Szukaj" }).click();

    await expect(page.getByRole("link", { name: /Nordwind/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Acme Polska Sp. z o.o." })).toBeHidden();
  });

  test("karta klienta pokazuje jego sprawy", async ({ page }) => {
    await login(page, DEMO.owner);
    await page.goto("/klienci");
    await page.getByRole("link", { name: "Acme Polska Sp. z o.o." }).click();

    await expect(page.getByRole("heading", { name: "Acme Polska Sp. z o.o." })).toBeVisible();
    await page.getByRole("tab", { name: /Sprawy/ }).click();
    await expect(page.getByRole("link", { name: "2026/001" })).toBeVisible();
  });

  test("stawki klienta są ukryte przed sekretariatem", async ({ page }) => {
    await login(page, DEMO.staff);
    await page.goto("/klienci");

    await expect(page.getByRole("columnheader", { name: "Nazwa" })).toBeVisible();
    // Kolumna ze stawką jest zarezerwowana dla ról z wglądem w finanse.
    await expect(page.getByRole("columnheader", { name: "Stawka" })).toBeHidden();
  });

  test("prawnik nie widzi pozycji finansowych w menu", async ({ page }) => {
    await login(page, DEMO.lawyer);

    const nav = page.getByRole("navigation");
    await expect(nav.getByRole("link", { name: "Ewidencja czasu" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Faktury" })).toBeHidden();
    await expect(nav.getByRole("link", { name: "Raporty" })).toBeHidden();
    await expect(nav.getByRole("link", { name: "Zamknięcie okresu" })).toBeHidden();
  });

  test("sekretariat nie ma przycisku rejestracji czasu", async ({ page }) => {
    await login(page, DEMO.staff);

    await expect(page.getByRole("button", { name: /Dodaj czas/ })).toBeHidden();
    await expect(page.getByRole("navigation").getByRole("link", { name: "Kalendarz" })).toBeVisible();
  });

  test("niezalogowany trafia na ekran logowania", async ({ page }) => {
    await page.goto("/klienci");
    await expect(page).toHaveURL(/\/logowanie/);
  });
});
