import { expect, test } from "@playwright/test";
import { DEMO, login } from "./helpers";

/**
 * Stopka panelu — Ustawienia, dane użytkownika i wylogowanie — musi być
 * widoczna zawsze, niezależnie od wysokości okna.
 *
 * Wcześniej cały panel miał `overflow-y-auto`, więc przy niższym oknie lista
 * pozycji wypychała stopkę poza ekran i „Wyloguj się" dało się znaleźć dopiero
 * po przewinięciu. Laptopy 1366×768 przy skalowaniu Windows na 125% mają około
 * 600 px wysokości w pikselach CSS, czyli dokładnie w tym zakresie.
 */
test.describe("Panel boczny", () => {
  test("stopka zostaje widoczna także na niskich ekranach", async ({ page }) => {
    await login(page, DEMO.owner);

    for (const height of [900, 720, 650, 600, 550, 500]) {
      await page.setViewportSize({ width: 1280, height });

      const wyloguj = page.getByRole("button", { name: "Wyloguj się" });
      await expect(wyloguj, `„Wyloguj się" niewidoczny przy oknie ${height} px`).toBeVisible();

      const ramka = await wyloguj.boundingBox();
      expect(ramka, `brak wymiarów przycisku przy ${height} px`).not.toBeNull();
      // Przycisk ma mieścić się w oknie, a nie tylko istnieć poniżej krawędzi.
      expect(ramka!.y + ramka!.height, `przycisk poniżej krawędzi przy ${height} px`).toBeLessThanOrEqual(height + 1);

      await expect(
        page.getByRole("link", { name: "Ustawienia" }),
        `Ustawienia niewidoczne przy ${height} px`,
      ).toBeVisible();
    }
  });

  test("to lista pozycji się przewija, a nie cały panel", async ({ page }) => {
    await login(page, DEMO.owner);
    await page.setViewportSize({ width: 1280, height: 550 });

    const stan = await page.evaluate(() => {
      const aside = document.querySelector("aside")!;
      const nav = aside.querySelector("nav")!;
      return {
        panelPrzewijany: aside.scrollHeight > aside.clientHeight,
        listaPrzewijana: nav.scrollHeight > nav.clientHeight,
      };
    });

    expect(stan.panelPrzewijany, "przewija się cały panel — stopka ucieknie").toBe(false);
    expect(stan.listaPrzewijana, "lista pozycji powinna przewijać się sama").toBe(true);
  });
});

/**
 * Skrót klawiszowy „N" został usunięty na życzenie kancelarii: pojedynczy
 * klawisz bez modyfikatora otwierał okno rejestracji czasu z każdego miejsca,
 * co zaskakiwało zamiast pomagać.
 */
test.describe("Brak skrótu klawiszowego", () => {
  test("klawisz N niczego nie otwiera", async ({ page }) => {
    await login(page, DEMO.owner);

    await page.keyboard.press("n");
    await page.waitForTimeout(500);

    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("nigdzie nie ma już znacznika klawisza", async ({ page }) => {
    await login(page, DEMO.owner);

    for (const path of ["/", "/czas"]) {
      await page.goto(path);
      await expect(page.locator("kbd"), `znacznik klawisza na ${path}`).toHaveCount(0);
    }
  });
});
