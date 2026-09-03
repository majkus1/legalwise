import { expect, test, type Page } from "@playwright/test";
import { DEMO, login } from "./helpers";

/**
 * Kliknięcie w menu musi natychmiast dać znać, że coś się dzieje.
 *
 * Strony renderują się na serwerze, więc do nadejścia odpowiedzi widać
 * poprzedni ekran. Bez żadnego sygnału wyglądało to jak brak reakcji na klik,
 * a przy wolniejszym łączu jak zawieszenie.
 *
 * Same `loading.tsx` nie wystarczą: ich szkielet pochodzi ze wstępnego
 * pobierania tras, a to według dokumentacji Next działa WYŁĄCZNIE na produkcji.
 * Dlatego sprawdzamy tu mechanizm niezależny od niego — pasek postępu pod
 * belką i kółko przy klikniętej pozycji.
 */

/** Opóźnia wyłącznie żądanie treści trasy; pliki statyczne przepuszcza. */
async function spowolnijNawigacje(page: Page, ms: number): Promise<void> {
  await page.route(/_rsc=/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
    await route.continue();
  });
}

const pasekWidoczny = (page: Page) =>
  page.evaluate(
    () => document.querySelector("[data-slot=nav-progress]")?.getAttribute("data-widoczny") === "true",
  );

test.describe("Sygnał wczytywania przy zmianie ekranu", () => {
  test("pasek postępu i kółko pojawiają się zaraz po kliknięciu", async ({ page }) => {
    await login(page, DEMO.owner);
    await spowolnijNawigacje(page, 2000);

    await page.getByRole("navigation").getByRole("link", { name: "Sprawy", exact: true }).click();

    // Próbkujemy krótko po kliknięciu — sygnał ma być natychmiastowy,
    // a nie pojawiać się dopiero razem z treścią.
    let pasek = false;
    let kolko = false;
    for (let proba = 0; proba < 10; proba += 1) {
      pasek = pasek || (await pasekWidoczny(page));
      kolko = kolko || (await page.locator("nav .animate-spin").count()) > 0;
      if (pasek && kolko) break;
      await page.waitForTimeout(120);
    }

    expect(pasek, "pasek postępu się nie pokazał").toBe(true);
    expect(kolko, "brak kółka przy klikniętej pozycji menu").toBe(true);
  });

  test("sygnał gaśnie po wczytaniu ekranu", async ({ page }) => {
    await login(page, DEMO.owner);
    await spowolnijNawigacje(page, 1200);

    await page.getByRole("navigation").getByRole("link", { name: "Klienci", exact: true }).click();
    await expect(page).toHaveURL(/\/klienci/);
    await expect(page.getByRole("heading", { name: "Klienci" })).toBeVisible();

    // Licznik zajętości musi zejść do zera, inaczej pasek zostałby na stałe.
    await expect
      .poll(() => pasekWidoczny(page), { message: "pasek postępu nie zgasł po wczytaniu" })
      .toBe(false);
    await expect(page.locator("nav .animate-spin")).toHaveCount(0);
  });

  test("każda trasa ma własny szkielet wczytywania", async ({ page }) => {
    await login(page, DEMO.owner);

    // Jedna wspólna granica w grupie `(app)` nie wystarcza: przy przejściu
    // między siostrzanymi stronami nie jest odmontowywana, więc się nie
    // pokazuje. Sprawdzamy, że pliki istnieją tam, gdzie mają.
    const braki: string[] = [];
    for (const path of ["/sprawy", "/klienci", "/zadania", "/kalendarz", "/faktury", "/raporty"]) {
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      // Ekran musi się wczytać bez błędu — szkielet znika po nadejściu treści.
      if ((await page.locator("[data-slot=skeleton]").count()) > 0) braki.push(path);
    }
    expect(braki, `szkielet nie zniknął po wczytaniu: ${braki.join(", ")}`).toEqual([]);
  });
});
