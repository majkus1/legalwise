import { expect, test } from "@playwright/test";
import { clickWhenReady, DEMO, login } from "./helpers";

test.describe("Powiadomienia", () => {
  test("strona powiadomień pokazuje skrzynkę i ustawienia", async ({ page }) => {
    await login(page, DEMO.owner);
    await page.goto("/powiadomienia");

    // Lokatory zawężamy do treści strony: nazwy sekcji powtarzają się
    // w menu bocznym, co bez tego daje kolizję w trybie ścisłym.
    const main = page.getByRole("main");

    await expect(main.getByRole("heading", { name: "Powiadomienia" })).toBeVisible();
    await expect(main.getByRole("tab", { name: /Skrzynka/ })).toBeVisible();

    await clickWhenReady(main.getByRole("tab", { name: "Ustawienia" }));
    await expect(main.getByRole("heading", { name: "Poranny przegląd" })).toBeVisible();
    await expect(main.getByRole("checkbox", { name: "Braki formalne", exact: true })).toBeVisible();
  });

  test("sekcja rozliczeń w ustawieniach jest ukryta przed prawnikiem", async ({ page }) => {
    await login(page, DEMO.lawyer);
    await page.goto("/powiadomienia");

    const main = page.getByRole("main");
    await clickWhenReady(main.getByRole("tab", { name: "Ustawienia" }));

    await expect(main.getByRole("checkbox", { name: "Zadania", exact: true })).toBeVisible();
    // Ta sama reguła co w interfejsie i w politykach RLS.
    await expect(main.getByRole("checkbox", { name: "Rozliczenia", exact: true })).toBeHidden();
  });

  test("zapis preferencji działa", async ({ page }) => {
    await login(page, DEMO.owner);
    await page.goto("/powiadomienia");
    const main = page.getByRole("main");
    await clickWhenReady(main.getByRole("tab", { name: "Ustawienia" }));

    await main.getByRole("button", { name: "Zapisz ustawienia" }).click();
    // Sonner renderuje komunikat w kilku warstwach (m.in. dla czytników
    // ekranu), więc bierzemy pierwsze wystąpienie.
    await expect(page.getByText("Zapisano ustawienia powiadomień").first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test("dzwonek prowadzi do powiadomień", async ({ page }) => {
    await login(page, DEMO.owner);
    await page.getByRole("link", { name: /Powiadomienia/ }).click();
    await expect(page).toHaveURL(/\/powiadomienia/);
  });
});

test.describe("Cron porannego przeglądu", () => {
  test("bez nagłówka autoryzacji odmawia obsługi", async ({ request }) => {
    const response = await request.get("/api/cron/poranny-przeglad");
    expect(response.status()).toBe(401);
  });

  test("z błędnym sekretem odmawia obsługi", async ({ request }) => {
    const response = await request.get("/api/cron/poranny-przeglad", {
      headers: { Authorization: "Bearer nieprawidlowy" },
    });
    expect(response.status()).toBe(401);
  });
});

test.describe("PWA", () => {
  test("manifest jest dostępny bez logowania i opisuje aplikację", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.status()).toBe(200);

    const manifest = await response.json();
    expect(manifest.name).toContain("Legal-Wise");
    expect(manifest.display).toBe("standalone");
    expect(manifest.lang).toBe("pl");
    expect(manifest.theme_color).toBe("#191E39");

    // Ikona maskowalna jest wymagana, żeby Android nie przyciął logo.
    const purposes = manifest.icons.map((icon: { purpose: string }) => icon.purpose);
    expect(purposes).toContain("maskable");

    // Skróty aplikacji widoczne po przytrzymaniu ikony.
    expect(manifest.shortcuts.length).toBeGreaterThanOrEqual(3);
  });

  test("service worker jest serwowany bez przekierowania na logowanie", async ({ request }) => {
    // Przepuszczony przez warstwę sesji kończyłby się przekierowaniem
    // i nigdy by się nie zarejestrował.
    const response = await request.get("/sw.js");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("javascript");

    const body = await response.text();
    expect(body).toContain("addEventListener(\"push\"");
    expect(body).toContain("notificationclick");
  });

  test("strona zastępcza działa bez sesji", async ({ page }) => {
    await page.goto("/offline");
    await expect(page).toHaveURL(/\/offline/);
    await expect(page.getByText("Brak połączenia z internetem")).toBeVisible();
  });

  test("nagłówek CSP przepuszcza service workera i manifest", async ({ request }) => {
    const response = await request.get("/logowanie");
    const csp = response.headers()["content-security-policy"];

    expect(csp).toContain("worker-src 'self'");
    expect(csp).toContain("manifest-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  test("ikony PWA są dostępne", async ({ request }) => {
    for (const icon of ["/icons/icon-192.png", "/icons/icon-512.png", "/icons/maskable-512.png"]) {
      const response = await request.get(icon);
      expect(response.status(), icon).toBe(200);
      expect(response.headers()["content-type"], icon).toContain("image/png");
    }
  });
});

test.describe("Odświeżanie zasobów przez service workera", () => {
  test("podmieniona ikona wraca do właściwej wersji sama", async ({ page }) => {
    await page.goto("/logowanie");
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, {
      timeout: 20_000,
    });

    const NAZWA = "legal-wise-v2";
    const ADRES = "/icons/icon-192.png";

    const rozmiarZSieci = await page.evaluate(async (adres) => {
      const r = await fetch(adres, { cache: "no-store" });
      return (await r.arrayBuffer()).byteLength;
    }, ADRES);
    expect(rozmiarZSieci).toBeGreaterThan(0);

    // Podkładamy udawaną, „starą" zawartość — tak jak zostałaby po poprzednim
    // wydaniu z nieaktualnym logo.
    await page.evaluate(
      async ([nazwa, adres]) => {
        const cache = await caches.open(nazwa);
        await cache.put(adres, new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
      },
      [NAZWA, ADRES],
    );

    // Pierwsze wejście może jeszcze oddać kopię z pamięci — to dozwolone,
    // byle równolegle poszło odświeżenie.
    await page.evaluate((adres) => fetch(adres), ADRES);
    await page.waitForFunction(
      async ([nazwa, adres]) => {
        const cache = await caches.open(nazwa);
        const wpis = await cache.match(adres);
        if (!wpis) return false;
        return (await wpis.arrayBuffer()).byteLength > 3;
      },
      [NAZWA, ADRES],
      { timeout: 15_000 },
    );

    const rozmiarPoOdswiezeniu = await page.evaluate(
      async ([nazwa, adres]) => {
        const cache = await caches.open(nazwa);
        const wpis = await cache.match(adres);
        return (await wpis!.arrayBuffer()).byteLength;
      },
      [NAZWA, ADRES],
    );

    // Bez odświeżania w tle ikona zostałaby na zawsze tą podłożoną —
    // dokładnie tak zamroziłoby się logo sprzed poprawki.
    expect(rozmiarPoOdswiezeniu).toBe(rozmiarZSieci);
  });

  test("stare wersje pamięci podręcznej są kasowane", async ({ page }) => {
    await page.goto("/logowanie");
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, {
      timeout: 20_000,
    });

    const klucze = await page.evaluate(() => caches.keys());
    expect(klucze, `zostały nieaktualne pamięci: ${klucze.join(", ")}`).toEqual(["legal-wise-v2"]);
  });
});
