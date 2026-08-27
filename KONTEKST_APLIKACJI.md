# Legal-Wise — kontekst aplikacji

> Dokument referencyjny do pracy nad kodem: architektura, model danych, uprawnienia,
> pułapki. Aktualizować przy zmianach schematu lub reguł dostępu.

Kancelaria **Legal-Wise (Śliwiński & Kucharski)** — 6 adwokatów i radców prawnych.
System zastępuje arkusze kalkulacyjne w ewidencji czasu i przygotowaniu rozliczeń.

**Rdzeń wartości:** łańcuch *wpis timesheet → zestawienie godzin dla klienta → projekt faktury*.
Reszta modułów buduje wokół niego kontekst.

---

## 1. Stack

| Warstwa | Wybór |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript `strict` |
| UI | shadcn/ui na **Base UI** (nie Radix!), Tailwind v4 |
| Baza / Auth / Storage | Supabase (PostgreSQL + RLS) |
| PDF | `@react-pdf/renderer` + osadzone Roboto (WOFF) |
| Push | `web-push` (VAPID), `public/sw.js` |
| Poczta | interfejs `Mailer`: Resend albo SMTP; lokalnie Mailpit |
| Testy | Vitest (jednostkowe + RLS), Playwright (e2e) |
| Deploy | Vercel; cron w `vercel.json` |

### Środowisko lokalne

```bash
npm run db:start        # Supabase na portach 553xx (543xx zajmuje buildflow-mvp)
npm run db:seed:fresh   # reset + dane demonstracyjne
npm run dev
```

### Wersja pokazowa dla kancelarii

| Komenda | Co robi |
|---|---|
| `npm run db:seed` | zasiew lokalny; na bazie zdalnej **odmawia** |
| `npm run demo:seed` | zasiew bazy pokazowej — czyta `.env.produkcja`, nie `.env.local` |
| `npm run demo:purge` | usuwa kancelarię z całą zawartością i konta pokazowe |

`--produkcja` wskazuje plik z konfiguracją, `--tak-usun-dane` potwierdza kasowanie.
Świadomie NIE podmieniamy kluczy w `.env.local` — łatwo zapomnieć to cofnąć,
a wtedy `npm run dev` uderza w bazę kancelarii.

Dane pokazowe usuń, zanim kancelaria zacznie prowadzić prawdziwe sprawy.

Konta demonstracyjne — hasło w `DEMO_PASSWORD` w `.env.local`:
`bartosz@` (owner), `michal@` (partner), `anna@` / `piotr@` (lawyer), `katarzyna@` (staff),
wszystkie w domenie `legal-wise.test`.

Adresy: API `55321`, baza `55322`, Studio `55323`, **Mailpit `55324`** (SMTP `55325`).

---

## 2. Model uprawnień

### Role (`organization_members.role`)

| Rola | Zakres |
|---|---|
| `owner` | wszystko + zespół + dane kancelarii + rentowność całego zespołu |
| `partner` | pełny wgląd w sprawy i finanse |
| `lawyer` | sprawy prowadzone i przypisane, własny timesheet, wyłącznie własna rentowność |
| `staff` | kalendarz, zadania, kartoteka; **bez finansów i bez ewidencji czasu** |

### Zasady, których nie wolno cofać

1. **`organization_members` nie przyjmuje INSERT/UPDATE/DELETE od roli `authenticated`.**
   Członkostwo zakłada wyłącznie RPC `set_member_role(org, email, role)` / `deactivate_member`.
   To jedyne wejście do kancelarii.
2. **Polityki RLS na `organization_members` nie mogą odpytywać tej tabeli** — rekurencja.
   Cały dostęp idzie przez funkcje `SECURITY DEFINER`: `is_member_of`, `my_role_in`,
   `has_role_in`, `is_owner_of`, `can_see_finances`, `can_access_case`, `my_org_ids`.
3. **Nigdy nie budować widoku czytającego `auth.users`.** Jest `user_directory_profiles`
   synchronizowany triggerem.
4. **Nowa tabela → `organization_id` + RLS + `force row level security` + grant + polityki.**
   Bez wyjątków.
5. **Rola `anon` nie ma żadnych uprawnień w schemacie `public`** (migracja `0009`).
   Domyślki Supabase dawały jej m.in. `TRUNCATE`, które nie podlega RLS.
6. **UI nie jest zabezpieczeniem.** Rozstrzyga RLS albo trasa serwerowa sprawdzająca rolę.

### Kod działający z kluczem serwisowym

`lib/supabase/admin.ts` omija RLS. Używany wyłącznie w cronie i wysyłce powiadomień.
**Zakres dostępu trzeba tam odtworzyć ręcznie** — patrz `accessibleCaseIds()`
w `app/api/cron/poranny-przeglad/route.ts`.

---

## 3. Zasady inżynierskie

- **Kwoty wyłącznie w groszach** (`bigint`), czas w minutach (`integer`). Nigdy `float`.
- **Migawki stawek** (`time_entries.rate_snapshot_grosz`) — zmiana cennika nie może
  zmieniać przeszłych rozliczeń. Stawkę wypełnia trigger w bazie, nie klient.
- **Numeracja faktur i spraw** — sekwencje w bazie, atomowy upsert. Numer faktury
  nadawany dopiero przy **zatwierdzaniu**, żeby porzucone szkice nie robiły dziur.
- **Brak twardych usunięć** rekordów merytorycznych — `archived_at`, anulowanie ze
  statusem, nigdy `DELETE`.
- **Czas warszawski** — `warsawLocalToUtc()` w `lib/time.ts` liczy przesunięcie
  z faktycznej strefy, nie ze stałej. Terminy procesowe to `date`, nie `timestamptz`.
- **Dziennik audytu** (`log_audit`) przy operacjach na rolach, fakturach i dokumentach.

---

## 4. Struktura bazy (migracje `0001`–`0012`)

| Obszar | Tabele |
|---|---|
| Organizacja | `organizations`, `organization_members`, `user_directory_profiles`, `member_rates`, `audit_log` |
| Kartoteka | `clients`, `cases`, `case_parties`, `case_assignees`, `case_notes`, `case_documents` |
| Czas | `time_entries` |
| Praca | `tasks`, `calendar_events` |
| Rozliczenia | `invoices`, `invoice_items`, `invoice_sequences`, `case_sequences` |
| Powiadomienia | `user_notifications`, `push_subscriptions`, `notification_preferences`, `notification_dispatch_events` |

`notification_dispatch_events` i `invoice_sequences` / `case_sequences` mają **zero polityk**
i zero uprawnień dla `authenticated` — dostęp wyłącznie przez `SECURITY DEFINER` albo klucz serwisowy.

### Kluczowe funkcje i RPC

| Funkcja | Rola |
|---|---|
| `bootstrap_organization(name)` | jednorazowa konfiguracja; odmawia, gdy organizacja istnieje |
| `set_member_role(org, email, role)` | nadanie dostępu; blokuje usunięcie ostatniego właściciela |
| `next_invoice_number(org, year)` / `next_case_number(org)` | szczelna numeracja |
| `approve_invoice(id)` | numer, migawki stron, blokada wpisów czasu |
| `cancel_invoice(id, reason)` | numer zostaje zajęty, godziny wracają do puli |
| `resolve_hourly_rate_internal` | wariant **bez** kontroli uprawnień, wyłącznie dla triggera |
| `set_own_push_enabled(org, bool)` | użytkownik włącza push sam |

---

## 5. Rozliczenia

Łańcuch rozstrzygania:
- **model**: sprawa → klient
- **stawka**: sprawa → klient → standardowa stawka prawnika

Ryczałt z opcjonalnym limitem godzin; nadwyżka rozliczana godzinowo **per wpis**
(`allocateFlatFeeOverage`), a nie po stawce uśrednionej — godzina partnera i godzina
aplikanta nie mogą kosztować tyle samo.

Cała logika w `lib/billing.ts` jako funkcje czyste. **Podgląd w kreatorze i tworzenie
faktury używają tego samego kodu** — to, co użytkownik widzi, jest tym, co powstanie.

### KSeF

`lib/ksef/fa3.ts` generuje XML w strukturze FA(3)
(namespace `http://crd.gov.pl/wzor/2025/06/25/13775/`, element `Faktura`, wariant 3).

`lib/ksef/client.ts` odwzorowuje realny przebieg sesji interaktywnej KSeF 2.0:
otwarcie sesji → szyfrowanie AES-256-CBC → wysyłka → zamknięcie → zbiorcze UPO.
Implementacja sieciowa **świadomie odłożona** — wymaga certyfikatu kancelarii.

> **Status prawny:** dopóki wysyłka nie działa, faktura z tego modułu **nie wchodzi
> do obiegu prawnego** (KSeF obowiązkowy od 1.04.2026). Informacja o tym jest
> drukowana wprost na PDF-ie faktury — patrz `ksefNotice()`.

---

## 6. Powiadomienia

Trzy kanały: skrzynka w aplikacji, Web Push, e-mail. Wszystkie przechodzą przez
`dispatchNotification()` i **wspólną księgę wysyłek** z unikalnym `dedupe_key`.

> **Pułapka, która już raz wystąpiła:** wysyłka poczty z pominięciem księgi powoduje,
> że ponowne uruchomienie crona dubluje maile, mimo poprawnej deduplikacji powiadomień
> w skrzynce. Każdy kanał musi przejść przez `claimDispatch`.

Cron: `GET /api/cron/poranny-przeglad`, harmonogram `0 5 * * 1-5` (UTC → 07:00 latem,
06:00 zimą). Autoryzacja **fail-closed**: brak `CRON_SECRET` = 401.

Treść przeglądu buduje `lib/notifications/digest.ts` — funkcje czyste, w pełni pokryte
testami. Sekcja finansowa trafia wyłącznie do `owner` i `partner`.

**Granica:** maile do klientów kancelarii nigdy nie wychodzą automatycznie.
Automatyczne są tylko powiadomienia wewnętrzne.

---

## 7. Pułapki interfejsu

- **shadcn stoi na Base UI, nie na Radix.** Nie ma `asChild` — jest `render={<Komponent />}`.
  Nie ma `onOpenAutoFocus` — jest `initialFocus`.
- **`onValueChange` w `Select` oddaje `string | null`.**
- **Etykieta `<label for>` nie nadaje nazwy przyciskowi**, którym Base UI renderuje
  `SelectTrigger`. Trzeba `aria-label`. (Checkbox radzi sobie sam przez `aria-labelledby`.)
- **Fonty muszą mieć `latin-ext`**, inaczej polskie znaki lecą na font zastępczy.
- **Wbudowane fonty PDF nie mają polskich znaków** (kodowanie WinAnsi) — stąd osadzone
  Roboto w `assets/fonts/`.
- **Wartości domyślne formularzy nie mogą mieszkać w modułach `"use client"`** —
  komponent serwerowy nie może wywołać funkcji z modułu klienckiego.
- **Plik z `"use server"` eksportuje wyłącznie funkcje asynchroniczne.**
- **PostgREST przy wstawianiu wsadowym** wysyła `NULL` dla kluczy brakujących
  w którymkolwiek obiekcie — wartości domyślne z bazy wtedy nie zadziałają.

---

## 8. Kolory i motyw

Z logo (`public/logo-legal-wise.png`): granat `#191E39`, złoto `#C08F48`.

> **Złoto ma kontrast 2,89:1 na bieli — nie wolno go używać jako koloru tekstu.**
> Służy za wypełnienie, obramowanie i wskaźnik. Do tekstu jest `--brand-gold-text`
> (`#9C6D24`, 4,54:1). Złoty przycisk z granatowym tekstem daje 5,65:1 i jest poprawny.

Paleta wykresów (`--chart-1`, `--chart-2`) jest **osobna** i zwalidowana skryptem
`validate_palette.js` dla obu trybów — kolory z logo są na znaczniki za ciemne
i czytają się jako szarość.

### Logo — nigdy nie odrysowywać

Znak firmowy kancelarii jest ich własnością. Wszystkie warianty powstają
**wyłącznie** ze `public/logo-legal-wise.png` skryptem `npm run generate:brand`,
przez kadrowanie i przebarwienie tuszu:

| Plik | Zastosowanie |
|---|---|
| `logo-legal-wise.png` | oryginał, jasne tło |
| `logo-legal-wise-rewers.png` | ciemne tło (granat → `rgb(230,232,237)`, złoto bez zmian) |
| `logo-legal-wise-znak.png` | sam znak, jasne tło |
| `logo-legal-wise-znak-rewers.png` | sam znak, ciemne tło i panel boczny |
| `icons/*` | ikony PWA — prawdziwy znak na granacie |

> **Panel boczny jest granatowy w OBU motywach**, więc zawsze potrzebuje wersji
> rewersowej. Oryginał ma granatowy tusz i na tym tle po prostu znika.

Dwa błędy, które już popełniono i które pilnują teraz testy:

1. **Znak narysowany ręcznie w SVG.** Wyglądał podobnie, ale nie był ich znakiem.
   Trafił do panelu bocznego i do ikon PWA.
2. **Rozjaśnianie przez `negate()`.** Odwraca wszystkie kanały naraz, więc złoto
   `#C08F48` wychodziło jako niebieski `#3F70B7`. Do przebarwienia służy
   `recolorInk()`, które klasyfikuje piksel po odległości od dwóch barw
   źródłowych i rusza wyłącznie granat.

Strzegą tego `tests/unit/brand-assets.test.ts` (barwy w plikach) oraz
`tests/e2e/logo.spec.ts` (właściwy wariant widoczny w danym motywie).

---

## 9. Testy

```bash
npm run test:all   # typy → jednostkowe → RLS → reseed → e2e (kolejność ma znaczenie)
```

**Testy RLS czyszczą bazę razem z kontami**, więc dane demonstracyjne trzeba zasiać
ponownie, zanim ruszą testy e2e. Robi to `db:seed:fresh` wpięty w `test:all`.

Stan: **142 jednostkowe · 52 RLS · 31 e2e**.

Testy e2e wymagają działającego serwera. Gdy jest już uruchomiony ręcznie:
`E2E_BASE_URL=http://localhost:PORT npx playwright test` (Next 16 nie pozwala
uruchomić drugiego serwera w tym samym katalogu).

---

## 10. Czego nie ma

Wysyłka do KSeF · synchronizacja z Portalem Informacyjnym · faktury korygujące ·
archiwizacja poczty · eksport do księgowości · procedura backupu i odtworzenia.

**Przed produkcją:** projekt Supabase w regionie EU, klucze VAPID, dostawca poczty
z zweryfikowaną domeną, `CRON_SECRET`, oraz **umowa powierzenia przetwarzania danych
podpisana zanim w systemie znajdą się rzeczywiste dane kancelarii**.
