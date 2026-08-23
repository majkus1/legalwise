import { expect, test, type Page } from "@playwright/test";
import { DEMO, login } from "./helpers";

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

async function setTheme(page: Page, label: string): Promise<void> {
  await page.getByRole("button", { name: "Zmień motyw" }).click();
  await page.getByRole("menuitem", { name: label }).click();
}

test.describe("Motyw jasny i ciemny", () => {
  test("przełącznik zmienia motyw i wybór przetrwa przeładowanie", async ({ page }) => {
    await login(page, DEMO.owner);

    const html = page.locator("html");
    await setTheme(page, "Ciemny");
    await expect(html).toHaveClass(/dark/);

    // Wybór zapisuje się w przeglądarce — po odświeżeniu nie wraca jasny.
    await page.reload();
    await expect(html).toHaveClass(/dark/);
  });

  test("w trybie ciemnym tło faktycznie ciemnieje", async ({ page }) => {
    await login(page, DEMO.owner);

    const background = () =>
      page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    await setTheme(page, "Jasny");
    const light = await toRgb(page, await background());

    await setTheme(page, "Ciemny");
    const dark = await toRgb(page, await background());

    const brightness = ([r, g, b]: [number, number, number]) => (r + g + b) / 3;

    expect(brightness(dark)).toBeLessThan(60);
    expect(brightness(light)).toBeGreaterThan(200);
  });

  test("można wrócić do ustawienia systemowego", async ({ page }) => {
    await login(page, DEMO.owner);

    await setTheme(page, "Ciemny");
    await expect(page.locator("html")).toHaveClass(/dark/);

    await setTheme(page, "Jak w systemie");
    // Playwright działa domyślnie w schemacie jasnym, więc klasa znika.
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });

  test("tekst pozostaje czytelny w trybie ciemnym", async ({ page }) => {
    await login(page, DEMO.owner);
    await setTheme(page, "Ciemny");

    const heading = page.getByRole("heading", { name: /Dzień dobry/ });
    await expect(heading).toBeVisible();

    const textColor = await heading.evaluate((element) => getComputedStyle(element).color);
    const backgroundColor = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );

    const text = relativeLuminance(await toRgb(page, textColor));
    const background = relativeLuminance(await toRgb(page, backgroundColor));
    const [hi, lo] = text > background ? [text, background] : [background, text];

    // WCAG AA dla zwykłego tekstu.
    expect((hi + 0.05) / (lo + 0.05)).toBeGreaterThan(4.5);
  });

  test("złoty akcent marki pozostaje widoczny na ciemnym tle", async ({ page }) => {
    await login(page, DEMO.owner);
    await setTheme(page, "Ciemny");
    await page.goto("/klienci");

    const buttonColor = await page
      .getByRole("link", { name: "Dodaj klienta" })
      .evaluate((element) => getComputedStyle(element).backgroundColor);

    const button = relativeLuminance(await toRgb(page, buttonColor));
    const background = relativeLuminance(
      await toRgb(page, await page.evaluate(() => getComputedStyle(document.body).backgroundColor)),
    );
    const [hi, lo] = button > background ? [button, background] : [background, button];

    // Element interfejsu wobec tła — próg WCAG dla elementów nietekstowych.
    expect((hi + 0.05) / (lo + 0.05)).toBeGreaterThan(3);
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
    expect(await cursorOf(page, "button", "Zmień motyw")).toBe("pointer");
  });

  test("zakładki i pola wyboru renderowane jako przyciski też je mają", async ({ page }) => {
    await login(page, DEMO.owner);
    await page.goto("/powiadomienia");

    expect(await cursorOf(page, "tab", "Ustawienia")).toBe("pointer");

    await page.getByRole("tab", { name: "Ustawienia" }).click();
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
