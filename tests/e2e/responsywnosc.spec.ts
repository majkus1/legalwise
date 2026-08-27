import { expect, test, type Page } from "@playwright/test";
import { DEMO, login } from "./helpers";

/**
 * Nic nie może wystawać poza ekran ani wymagać przewijania w bok.
 *
 * Wcześniej kontener akcji w nagłówku miał `shrink-0`, więc przyjmował
 * szerokość swojej treści i odmawiał jej oddania — na telefonie przyciski
 * „Dodaj zadanie" czy „Dodaj termin" wychodziły poza krawędź. Tabele kartoteki
 * wymagały z kolei od 450 do 700 px przewijania w bok, przez co status sprawy
 * i kwota faktury były poza zasięgiem wzroku.
 */

const EKRANY = [
  "/",
  "/czas",
  "/klienci",
  "/klienci/nowy",
  "/sprawy",
  "/sprawy/nowa",
  "/zadania",
  "/kalendarz",
  "/rozliczenia",
  "/faktury",
  "/raporty",
  "/ustawienia",
  "/powiadomienia",
];

/**
 * Adresy stron szczegółów, wyszukane w czasie testu.
 *
 * Pierwsza wersja tego zestawu obejmowała wyłącznie listy — i właśnie dlatego
 * przepuściła przepełnienie o 496 px na karcie sprawy, gdzie osiem zakładek
 * nie mieściło się w telefonie. Strony szczegółów mają własne układy i muszą
 * być sprawdzane osobno.
 */
async function stronySzczegolow(page: Page): Promise<string[]> {
  const adresy: string[] = [];

  // `count()` odpowiada od razu, a `getAttribute()` czekałby na element do
  // wyczerpania limitu testu. Faktury bywają wyczyszczone przez testy
  // rozliczeń, więc lista potrafi być pusta — to normalny stan, nie awaria.
  const pierwszyAdres = async (sciezka: string, selektor: string) => {
    await page.goto(sciezka);
    await page.waitForLoadState("networkidle").catch(() => {});
    const odnosnik = page.locator(selektor).first();
    return (await odnosnik.count()) > 0 ? odnosnik.getAttribute("href") : null;
  };

  const sprawa = await pierwszyAdres("/sprawy", 'a[href^="/sprawy/"]:not([href$="/nowa"])');
  if (sprawa) adresy.push(sprawa);

  const klient = await pierwszyAdres("/klienci", 'a[href^="/klienci/"]:not([href$="/nowy"])');
  if (klient) adresy.push(klient);

  const faktura = await pierwszyAdres("/faktury", 'a[href^="/faktury/"]');
  if (faktura) adresy.push(faktura);

  return adresy;
}

/** Elementy sterujące widoczne w treści strony, wraz z ich wysokością. */
const celeDotyku = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("main button, main select, main [role='tab']")]
      .map((el) => ({
        wysokosc: Math.round(el.getBoundingClientRect().height),
        opis: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 24),
      }))
      .filter((x) => x.wysokosc > 0),
  );

/** O ile pikseli strona daje się przewinąć w bok. Zero znaczy: mieści się. */
const przewijaniePoziome = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe("Responsywność", () => {
  // Każdy z tych testów przechodzi kilkanaście ekranów i bada każdy element
  // na stronie. Domyślne 120 s wystarcza na bezczynnej maszynie, ale nie wtedy,
  // gdy obok chodzą inne serwery deweloperskie — a wynik testu ma zależeć od
  // kodu, nie od tego, co jeszcze jest uruchomione.
  test.describe.configure({ timeout: 300_000 });

  for (const width of [320, 390, 768]) {
    test(`nic nie wystaje poza ekran przy ${width} px`, async ({ page }) => {
      await login(page, DEMO.owner);
      await page.setViewportSize({ width, height: 800 });

      const doSprawdzenia = [...EKRANY, ...(await stronySzczegolow(page))];

      for (const path of doSprawdzenia) {
        await page.goto(path);
        await page.waitForLoadState("networkidle").catch(() => {});

        expect(await przewijaniePoziome(page), `${path} przewija się w bok`).toBeLessThanOrEqual(1);

        // Sam brak przewijania nie wystarcza: element może wystawać poza
        // krawędź, gdy przodek go przycina. Szukamy więc tego, co widać.
        const wystajace = await page.evaluate((width) => {
          const win: string[] = [];
          for (const el of document.querySelectorAll("body *")) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            if (r.right <= width + 1 && r.left >= -1) continue;

            let rodzic = el.parentElement;
            let przyciety = false;
            while (rodzic && rodzic !== document.body) {
              if (getComputedStyle(rodzic).overflowX !== "visible") {
                przyciety = true;
                break;
              }
              rodzic = rodzic.parentElement;
            }
            if (!przyciety) {
              win.push(`<${el.tagName.toLowerCase()}> "${(el.textContent || "").trim().slice(0, 24)}"`);
            }
          }
          return [...new Set(win)];
        }, width);

        expect(wystajace, `${path}: poza ekranem ${wystajace.join(", ")}`).toEqual([]);
      }
    });
  }

  test("elementy sterujące dają się trafić palcem", async ({ page }) => {
    await login(page, DEMO.owner);
    await page.setViewportSize({ width: 390, height: 800 });

    for (const path of EKRANY) {
      await page.goto(path);
      await page.waitForLoadState("networkidle").catch(() => {});

      const male = (await celeDotyku(page)).filter((c) => c.wysokosc < 32);
      expect(
        male,
        `${path}: za małe cele — ${male.map((m) => `„${m.opis}" ${m.wysokosc}px`).join(", ")}`,
      ).toEqual([]);
    }
  });

  test("pasek zakładek przewija się, zamiast wypychać stronę", async ({ page }) => {
    await login(page, DEMO.owner);
    await page.setViewportSize({ width: 390, height: 800 });

    const [sprawa] = await stronySzczegolow(page);
    expect(sprawa, "brak sprawy w danych — test nie ma czego sprawdzić").toBeTruthy();
    await page.goto(sprawa);

    const stan = await page.evaluate(() => {
      const lista = document.querySelector("[role=tablist]")!;
      const pierwsza = document.querySelector("[role=tab]")!;
      return {
        pasekPrzewijalny: lista.scrollWidth > lista.clientWidth,
        przewinieciePoczatkowe: lista.scrollLeft,
        pierwszaWidoczna:
          pierwsza.getBoundingClientRect().left >= lista.getBoundingClientRect().left - 1,
      };
    });

    expect(stan.pasekPrzewijalny, "osiem zakładek ma się nie mieścić — to warunek testu").toBe(true);
    // `justify-center` przy przepełnieniu ucina treść po lewej i nie da się
    // do niej doscrollować: pasek startowałby przewinięty, z pierwszymi
    // zakładkami poza zasięgiem.
    expect(stan.przewinieciePoczatkowe, "pasek startuje przewinięty").toBe(0);
    expect(stan.pierwszaWidoczna, "pierwsza zakładka poza zasięgiem").toBe(true);
  });

  test("kartoteka zamienia tabelę na kafelki, gdy ekran jest wąski", async ({ page }) => {
    await login(page, DEMO.owner);

    // Świadomie opieramy się na danych z zasiewu, których żaden test nie kasuje:
    // sprawy są stałe, a faktury bywają czyszczone przez testy rozliczeń.
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/sprawy");

    await expect(page.getByRole("table"), "na telefonie tabela ma ustąpić").toBeHidden();

    // Sygnatura to pole, po którym prawnik rozpoznaje sprawę — w tabeli była
    // dopiero po 536 px przewijania w bok, w kafelku widać ją od razu.
    await expect(page.getByText("Sygnatura").first()).toBeVisible();
    await expect(page.getByRole("link", { name: /2026\/001/ }).first()).toBeVisible();

    // Na szerokim ekranie wraca tabela — porównywanie wierszy w kolumnach
    // jest tam właśnie tym, czego się oczekuje.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/sprawy");
    await expect(page.getByRole("table")).toBeVisible();
  });
});
