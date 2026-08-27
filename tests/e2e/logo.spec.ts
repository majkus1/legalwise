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

  test("panel boczny pokazuje pełne logo, a nie rysunek ani napis z czcionki", async ({ page }) => {
    await login(page, DEMO.owner);

    const wPanelu = await page.evaluate(() => {
      const aside = document.querySelector("aside");
      return [...(aside?.querySelectorAll("img") ?? [])].map((img) => {
        const u = new URL(img.currentSrc || img.src, location.href);
        return u.searchParams.get("url") ?? u.pathname;
      });
    });

    expect(wPanelu, "w panelu bocznym nie ma logo z pliku klienta").not.toHaveLength(0);

    // Pełne logo, czyli z napisem „LEGALWISE" — nie sam znak graficzny.
    expect(
      wPanelu.some((a) => a.includes("logo-legal-wise-rewers")),
      `w panelu jest ${wPanelu.join(", ")} zamiast pełnego logo`,
    ).toBe(true);

    // Panel jest granatowy w obu motywach, więc logo zawsze jest rewersowe —
    // oryginał z granatowym tuszem zlałby się z tłem.
    expect(wPanelu.every((a) => a.includes("rewers"))).toBe(true);
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

  test("logo w panelu zostaje czytelne po przełączeniu motywu", async ({ page }) => {
    await login(page, DEMO.owner);
    await clickWhenReady(page.getByRole("button", { name: "Włącz motyw ciemny" }));
    await expect(page.locator("html")).toHaveClass(/dark/);

    const wPanelu = await page.evaluate(() => {
      const aside = document.querySelector("aside");
      return [...(aside?.querySelectorAll("img") ?? [])].map((img) => {
        const u = new URL(img.currentSrc || img.src, location.href);
        return u.searchParams.get("url") ?? u.pathname;
      });
    });
    expect(wPanelu.every((a) => a.includes("rewers"))).toBe(true);
  });
});
