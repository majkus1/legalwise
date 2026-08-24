import { expect, test, type Page } from "@playwright/test";
import { clickWhenReady, DEMO, login } from "./helpers";

/**
 * Rozkłada dowolny zapis koloru CSS na kanały RGB.
 *
 * Przeglądarka serializuje kolory zdefiniowane w `oklch()` bez konwersji na
 * `rgb()`, więc wyciąganie liczb wyrażeniem regularnym daje bezsensowne wyniki.
 * Rysowanie koloru na płótnie działa niezależnie od zapisu.
 */
async function toRgb(page: Page, color: string): Promise<[number, number, number]> {
  return page.evaluate((value) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d")!;
    context.fillStyle = value;
    context.fillRect(0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    return [r, g, b] as [number, number, number];
  }, color);
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const toLinear = (channel: number) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

const enableDark = (page: Page) =>
  clickWhenReady(page.getByRole("button", { name: "Włącz motyw ciemny" }));
const enableLight = (page: Page) =>
  clickWhenReady(page.getByRole("button", { name: "Włącz motyw jasny" }));

const bodyBackground = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test.describe("Motyw jasny i ciemny", () => {
  test("przełącznik działa w obie strony", async ({ page }) => {
    await login(page, DEMO.owner);
    const html = page.locator("html");

    // Domyślnie jasny — bez opcji „jak w systemie".
    await expect(html).not.toHaveClass(/dark/);

    await enableDark(page);
    await expect(html).toHaveClass(/dark/);

    await enableLight(page);
    await expect(html).not.toHaveClass(/dark/);
  });

  test("wybór przetrwa przeładowanie", async ({ page }) => {
    await login(page, DEMO.owner);
    await enableDark(page);
    await expect(page.locator("html")).toHaveClass(/dark/);

    await page.reload();
    await expect(page.locator("html")).toHaveClass(/dark/);
  });

  test("w trybie ciemnym tło faktycznie ciemnieje", async ({ page }) => {
    await login(page, DEMO.owner);

    const light = await toRgb(page, await bodyBackground(page));
    await enableDark(page);
    const dark = await toRgb(page, await bodyBackground(page));

    const brightness = ([r, g, b]: [number, number, number]) => (r + g + b) / 3;

    expect(brightness(light)).toBeGreaterThan(200);
    expect(brightness(dark)).toBeLessThan(60);
  });

  test("tekst pozostaje czytelny w trybie ciemnym", async ({ page }) => {
    await login(page, DEMO.owner);
    await enableDark(page);

    const heading = page.getByRole("heading", { name: /Dzień dobry/ });
    await expect(heading).toBeVisible();

    const text = relativeLuminance(
      await toRgb(page, await heading.evaluate((el) => getComputedStyle(el).color)),
    );
    const background = relativeLuminance(await toRgb(page, await bodyBackground(page)));
    const [hi, lo] = text > background ? [text, background] : [background, text];

    // WCAG AA dla zwykłego tekstu.
    expect((hi + 0.05) / (lo + 0.05)).toBeGreaterThan(4.5);
  });

  test("złoty akcent marki pozostaje widoczny na ciemnym tle", async ({ page }) => {
    await login(page, DEMO.owner);
    await enableDark(page);
    await page.goto("/klienci");

    const button = relativeLuminance(
      await toRgb(
        page,
        await page
          .getByRole("link", { name: "Dodaj klienta" })
          .evaluate((el) => getComputedStyle(el).backgroundColor),
      ),
    );
    const background = relativeLuminance(await toRgb(page, await bodyBackground(page)));
    const [hi, lo] = button > background ? [button, background] : [background, button];

    // Element interfejsu wobec tła — próg WCAG dla elementów nietekstowych.
    expect((hi + 0.05) / (lo + 0.05)).toBeGreaterThan(3);
  });

  test("motyw ciemny obowiązuje na wszystkich ekranach aplikacji", async ({ page }) => {
    await login(page, DEMO.owner);
    await enableDark(page);

    for (const path of [
      "/",
      "/czas",
      "/klienci",
      "/sprawy",
      "/zadania",
      "/kalendarz",
      "/rozliczenia",
      "/faktury",
      "/raporty",
      "/ustawienia",
      "/powiadomienia",
    ]) {
      await page.goto(path);
      await expect(page.locator("html"), `motyw zgubiony na ${path}`).toHaveClass(/dark/);

      const brightness = ((rgb: [number, number, number]) => (rgb[0] + rgb[1] + rgb[2]) / 3)(
        await toRgb(page, await bodyBackground(page)),
      );
      expect(brightness, `jasne tło na ${path}`).toBeLessThan(60);

      // Przełącznik musi być dostępny z każdego ekranu, nie tylko z pulpitu.
      await expect(
        page.getByRole("button", { name: "Włącz motyw jasny" }),
        `brak przełącznika na ${path}`,
      ).toBeVisible();
    }
  });

  test("motyw ciemny obejmuje też ekran logowania", async ({ page }) => {
    await login(page, DEMO.owner);
    await enableDark(page);

    await page.getByRole("button", { name: "Wyloguj się" }).click();
    await expect(page).toHaveURL(/\/logowanie/);

    // Ekran logowania jest poza powłoką aplikacji, ale klasa motywu siedzi
    // na <html>, więc nie może tam wracać jasne tło.
    await expect(page.locator("html")).toHaveClass(/dark/);
    const brightness = ((rgb: [number, number, number]) => (rgb[0] + rgb[1] + rgb[2]) / 3)(
      await toRgb(page, await bodyBackground(page)),
    );
    expect(brightness).toBeLessThan(60);
  });
});

test.describe("Wskaźnik kliknięcia", () => {
  const cursorOf = (page: Page, role: Parameters<Page["getByRole"]>[0], name: string) =>
    page.getByRole(role, { name }).evaluate((element) => getComputedStyle(element).cursor);

  test("przyciski i odnośniki mają kursor łapki", async ({ page }) => {
    await login(page, DEMO.owner);
    await page.goto("/klienci");

    expect(await cursorOf(page, "button", "Szukaj")).toBe("pointer");
    expect(await cursorOf(page, "link", "Dodaj klienta")).toBe("pointer");
    expect(await cursorOf(page, "button", "Włącz motyw ciemny")).toBe("pointer");
  });

  test("zakładki i pola wyboru renderowane jako przyciski też je mają", async ({ page }) => {
    await login(page, DEMO.owner);
    await page.goto("/powiadomienia");

    expect(await cursorOf(page, "tab", "Ustawienia")).toBe("pointer");

    await clickWhenReady(page.getByRole("tab", { name: "Ustawienia" }));
    const checkbox = await page
      .getByRole("checkbox", { name: "Zadania", exact: true })
      .evaluate((element) => getComputedStyle(element).cursor);
    expect(checkbox).toBe("pointer");
  });

  test("pole tekstowe zachowuje kursor tekstowy", async ({ page }) => {
    await login(page, DEMO.owner);
    await page.goto("/klienci");

    // „Łapka" na polu do pisania sugerowałaby akcję zamiast miejsca na tekst.
    const cursor = await page
      .getByLabel("Szukaj klienta")
      .evaluate((element) => getComputedStyle(element).cursor);
    expect(cursor).not.toBe("pointer");
  });

  test("przycisk wyłączony pokazuje kursor blokady", async ({ page }) => {
    await login(page, DEMO.owner);

    const cursor = await page.evaluate(() => {
      const button = document.createElement("button");
      button.disabled = true;
      document.body.append(button);
      const value = getComputedStyle(button).cursor;
      button.remove();
      return value;
    });
    expect(cursor).toBe("not-allowed");
  });
});
