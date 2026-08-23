import { expect, test } from "@playwright/test";
import { DEMO, login, resetInvoicing } from "./helpers";

/**
 * Pełna ścieżka rozliczeniowa — rdzeń wartości systemu.
 *
 * Zamiast ręcznego przepisywania godzin z arkusza kalkulacyjnego:
 * zamknięcie okresu → projekt faktury → zatwierdzenie → PDF faktury,
 * PDF zestawienia godzin i plik XML w strukturze FA(3).
 */
test.describe("Zamknięcie okresu i faktura", () => {
  // Zestaw zużywa godziny wystawiając faktury, więc zaczyna od czystego stanu
  // rozliczeń. Bez tego drugi przebieg zastałby klientów bez czego fakturować.
  test.beforeAll(async () => {
    await resetInvoicing();
  });

  test("kreator wycenia okres i tworzy projekt faktury", async ({ page }) => {
    await login(page, DEMO.owner);
    await page.goto("/rozliczenia");

    await expect(page.getByRole("heading", { name: "Zamknięcie okresu" })).toBeVisible();

    await page.getByLabel("Klient").click();
    await page.getByRole("option", { name: "Acme Polska Sp. z o.o." }).click();

    // Okres obejmujący cały zakres danych demonstracyjnych.
    await page.getByLabel("Okres od").fill("2026-01-01");
    await page.getByLabel("Okres do").fill("2026-12-31");

    // Podgląd liczy się tym samym kodem, co utworzenie faktury.
    await expect(page.getByText("Razem brutto")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/wpisów czasu|wpisu czasu/)).toBeVisible();

    await page.getByRole("button", { name: "Utwórz projekt faktury" }).click();

    await expect(page).toHaveURL(/\/faktury\/[0-9a-f-]{36}/, { timeout: 25_000 });
    await expect(page.getByRole("heading", { name: "Projekt faktury" })).toBeVisible();
    await expect(page.getByText(/Dokument roboczy/)).toBeVisible();
  });

  test("PDF faktury i zestawienia godzin generują się poprawnie", async ({ page }) => {
    await login(page, DEMO.owner);
    await page.goto("/faktury");

    const firstInvoice = page.locator("tbody tr").first().getByRole("link");
    await firstInvoice.click();
    await expect(page).toHaveURL(/\/faktury\/[0-9a-f-]{36}/);

    const invoiceId = page.url().split("/faktury/")[1].split("?")[0];

    for (const [path, label] of [
      [`/faktury/${invoiceId}/pdf`, "faktura"],
      [`/faktury/${invoiceId}/zestawienie`, "zestawienie godzin"],
    ] as const) {
      const response = await page.request.get(path);
      expect(response.status(), `${label}: nieoczekiwany status`).toBe(200);
      expect(response.headers()["content-type"]).toContain("application/pdf");

      const body = await response.body();
      // Sygnatura pliku PDF.
      expect(body.subarray(0, 4).toString("latin1"), `${label}: to nie jest PDF`).toBe("%PDF");
      // Pusty dokument miałby kilkaset bajtów; poprawny z osadzonym fontem
      // jest znacznie większy.
      expect(body.length, `${label}: dokument podejrzanie mały`).toBeGreaterThan(5_000);
    }
  });

  test("szkic nie ma jeszcze pliku XML", async ({ page }) => {
    await login(page, DEMO.owner);
    await page.goto("/rozliczenia");

    await page.getByLabel("Klient").click();
    await page.getByRole("option", { name: "Medica Clinic Sp. z o.o." }).click();
    await page.getByLabel("Okres od").fill("2026-01-01");
    await page.getByLabel("Okres do").fill("2026-12-31");
    await expect(page.getByText("Razem brutto")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Utwórz projekt faktury" }).click();
    await expect(page).toHaveURL(/\/faktury\/[0-9a-f-]{36}/, { timeout: 25_000 });

    const invoiceId = page.url().split("/faktury/")[1];
    const response = await page.request.get(`/faktury/${invoiceId}/xml`);
    expect(response.status()).toBe(409);
  });

  test("zatwierdzenie nadaje numer i udostępnia XML FA(3)", async ({ page }) => {
    await login(page, DEMO.owner);
    await page.goto("/rozliczenia");

    await page.getByLabel("Klient").click();
    await page.getByRole("option", { name: /Granit/ }).click();
    await page.getByLabel("Okres od").fill("2026-01-01");
    await page.getByLabel("Okres do").fill("2026-12-31");
    await expect(page.getByText("Razem brutto")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Utwórz projekt faktury" }).click();
    await expect(page).toHaveURL(/\/faktury\/[0-9a-f-]{36}/, { timeout: 25_000 });

    const invoiceId = page.url().split("/faktury/")[1];

    await page.getByRole("button", { name: "Zatwierdź fakturę" }).click();
    await page.getByRole("button", { name: "Zatwierdź i nadaj numer" }).click();

    // Numer w formacie z ustawień kancelarii: FV/{nr}/{rok}
    await expect(page.getByRole("heading", { name: /^FV\/\d+\/\d{4}$/ })).toBeVisible({
      timeout: 25_000,
    });

    const response = await page.request.get(`/faktury/${invoiceId}/xml`);
    expect(response.status()).toBe(200);

    const xml = await response.text();
    expect(xml).toContain('<Faktura xmlns="http://crd.gov.pl/wzor/2025/06/25/13775/">');
    expect(xml).toContain("<WariantFormularza>3</WariantFormularza>");
    expect(xml).toContain("<Podmiot1>");
    expect(xml).toContain("<Podmiot2>");
    expect(xml).toContain("<Adnotacje>");
  });

  test("prawnik nie ma dostępu do rozliczeń", async ({ page }) => {
    await login(page, DEMO.lawyer);
    await page.goto("/rozliczenia");
    await expect(page).toHaveURL(/brak-uprawnien/);
  });

  test("sekretariat nie ma dostępu do faktur", async ({ page }) => {
    await login(page, DEMO.staff);
    await page.goto("/faktury");
    await expect(page).toHaveURL(/brak-uprawnien/);
  });
});
