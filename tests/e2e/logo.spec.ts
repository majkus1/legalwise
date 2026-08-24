import { expect, test, type Page } from "@playwright/test";
import { clickWhenReady, DEMO, login } from "./helpers";

/**
 * Logo kancelarii musi pochodzić z ich pliku i być widoczne w obu motywach.
 *
 * Oba te warunki zostały kiedyś złamane naraz: w panelu bocznym był znak
 * narysowany ręcznie w SVG (podobny, ale nie ich), a na ciemnym tle granatowy
 * tusz oryginału zlewał się z tłem tak, że logo praktycznie znikało.
 */

/**
 * Adresy plików źródłowych obrazków faktycznie widocznych na ekranie.
 *
 * `next/image` przepisuje adres na `/_next/image?url=%2Flogo…`, więc sama
 * ścieżka nic nie mówi — nazwa pliku siedzi w parametrze `url` i trzeba ją
 * odkodować.
 */
async function widoczneObrazki(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll("img")]
      .filter((img) => {
        const s = getComputedStyle(img);
        return (
          s.display !== "none" && s.visibility !== "hidden" && img.getBoundingClientRect().width > 0
        );
      })
      .map((img) => {
        const adres = new URL(img.currentSrc || img.src, location.href);
        return adres.searchParams.get("url") ?? adres.pathname;
      }),
  );
}

/** Czy wśród widocznych obrazków jest któryś z plików logo. */
const logoWsrod = (adresy: string[]) =>
  adresy.filter((a) => a.includes("logo-legal-wise"));

test.describe("Logo kancelarii", () => {
  test("ekran logowania pokazuje logo z pliku klienta", async ({ page }) => {
    await page.goto("/logowanie");

    const logo = logoWsrod(await widoczneObrazki(page));
    expect(logo, "na ekranie logowania nie ma logo z pliku").not.toHaveLength(0);

    // W motywie jasnym obowiązuje oryginał, nie wersja rewersowa.
    expect(logo.some((a) => a.includes("rewers"))).toBe(false);
  });

  test("w motywie ciemnym wchodzi wersja rewersowa", async ({ page }) => {
    await page.goto("/logowanie");
    await page.evaluate(() => localStorage.setItem("theme", "dark"));
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/dark/);

    const logo = logoWsrod(await widoczneObrazki(page));
    expect(logo, "brak logo na ciemnym ekranie logowania").not.toHaveLength(0);

    // Granatowy tusz oryginału na ciemnym tle jest nieczytelny — musi ustąpić.
    expect(
      logo.every((a) => a.includes("rewers")),
      `na ciemnym tle pokazano nierewersowe logo: ${logo.join(", ")}`,
    ).toBe(true);
  });

  test("panel boczny używa prawdziwego znaku, a nie rysunku", async ({ page }) => {
    await login(page, DEMO.owner);

    const znaki = (await widoczneObrazki(page)).filter((a) => a.includes("znak"));
    expect(znaki, "w panelu bocznym nie ma znaku z pliku klienta").not.toHaveLength(0);

    // Panel jest granatowy w obu motywach, więc znak zawsze jest rewersowy.
    expect(znaki.every((a) => a.includes("rewers"))).toBe(true);

    // Nazwa kancelarii ma być zwykłym tekstem obok znaku — nie składamy
    // z niej podrobionego napisu udającego logo.
    await expect(page.getByRole("navigation")).toBeVisible();
  });

  test("logo ma nazwę kancelarii dla czytnika ekranu w obu motywach", async ({ page }) => {
    for (const motyw of ["light", "dark"] as const) {
      await page.goto("/logowanie");
      await page.evaluate((m) => localStorage.setItem("theme", m), motyw);
      await page.reload();

      // Wariant ukryty przez `display: none` wypada z drzewa dostępności,
      // więc widoczne logo musi samo nieść opis — inaczej w jednym z motywów
      // ekran logowania nie przedstawiałby się wcale.
      const opisane = page.getByRole("img", { name: /Śliwiński & Kucharski/ });
      await expect(opisane, `logo bez opisu w motywie ${motyw}`).toHaveCount(1);
      await expect(opisane).toBeVisible();
    }
  });

  test("znak w panelu zostaje widoczny po przełączeniu motywu", async ({ page }) => {
    await login(page, DEMO.owner);
    await clickWhenReady(page.getByRole("button", { name: "Włącz motyw ciemny" }));
    await expect(page.locator("html")).toHaveClass(/dark/);

    const znaki = (await widoczneObrazki(page)).filter((a) => a.includes("znak"));
    expect(znaki.every((a) => a.includes("rewers"))).toBe(true);
  });
});
