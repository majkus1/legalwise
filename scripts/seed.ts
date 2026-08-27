/**
 * Dane demonstracyjne dla środowiska deweloperskiego.
 *
 * Uruchomienie:  npm run db:seed
 *
 * WAŻNE: wszystkie dane są fikcyjne. Do systemu nie wolno wprowadzać danych
 * rzeczywistych klientów przed podpisaniem umowy powierzenia przetwarzania.
 *
 * Dane są jednak realistyczne — sygnatury w prawidłowym formacie, prawdziwe
 * nazwy sądów, typowe opisy czynności. Prawnik ocenia takie demo w kilkanaście
 * sekund po tym, czy „wygląda jak z jego świata”.
 */

import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import type { Database } from "../lib/database.types";

/**
 * Wybór bazy: lokalna czy pokazowa (produkcyjna).
 *
 * Z przełącznikiem `--produkcja` czytamy `.env.produkcja` zamiast `.env.local`.
 * Dzięki temu nie trzeba podmieniać kluczy w konfiguracji deweloperskiej —
 * a właśnie ta podmiana jest niebezpieczna: łatwo ją zapomnieć cofnąć i wtedy
 * `npm run dev` uderza w bazę kancelarii.
 */
const naProdukcje = process.argv.includes("--produkcja");
loadEnv({ path: naProdukcje ? ".env.produkcja" : ".env.local", quiet: true });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
/**
 * Hasło kont demonstracyjnych — wyłącznie ze zmiennej środowiskowej.
 *
 * Wpisane w kodzie trafiało do repozytorium, a stamtąd do skanerów sekretów.
 * Gorsze było jednak to, czego brakowało obok: bez blokady poniżej ten skrypt
 * założyłby konta o publicznie znanym haśle na dowolnej bazie, na którą
 * wskazywał `.env.local` — także produkcyjnej.
 */
const DEMO_PASSWORD = process.env.DEMO_PASSWORD;
if (!DEMO_PASSWORD) {
  throw new Error(
    "Brak DEMO_PASSWORD. Ustaw je w .env.local — dane demonstracyjne nie mają stałego hasła.",
  );
}

/**
 * Dane demonstracyjne wolno zasiewać WYŁĄCZNIE na bazie lokalnej.
 *
 * Kancelaria prowadzi w tym systemie prawdziwe sprawy. Zasiew wstawia
 * zmyślonych klientów i konta z ustalonym hasłem — na produkcji byłoby to
 * jednocześnie zaśmieceniem danych i otwartymi drzwiami.
 */
const seedHost = new URL(SUPABASE_URL).hostname;
const isLocal = seedHost === "127.0.0.1" || seedHost === "localhost";

/**
 * Zasiew na bazie zdalnej wymaga świadomej zgody — `ALLOW_REMOTE_SEED=1`.
 *
 * To NIE jest obejście blokady, tylko druga, celowo niewygodna droga: na wersję
 * pokazową dla kancelarii dane demonstracyjne są potrzebne, bo pusty system
 * niczego nie pokazuje. Zmiennej nie ma w żadnym pliku — trzeba ją podać przy
 * uruchomieniu, więc przypadkiem się to nie stanie.
 *
 * Zanim kancelaria zacznie prowadzić prawdziwe sprawy, dane pokazowe usuwa
 * `npm run db:purge-demo`. Mieszanie zmyślonych klientów z aktami rzeczywistymi
 * byłoby w systemie prawniczym gorsze niż brak danych.
 */
if (!isLocal && !naProdukcje && process.env.ALLOW_REMOTE_SEED !== "1") {
  throw new Error(
    `Odmawiam zasiewu na bazie ${seedHost}. Dane demonstracyjne są domyślnie wyłącznie dla ` +
      "środowiska lokalnego. Zasiew wersji pokazowej: npm run demo:seed",
  );
}

if (!isLocal) {
  console.warn(`\n⚠  ZASIEW NA BAZIE ZDALNEJ: ${seedHost}`);
  console.warn("   Dane pokazowe. Usuniesz je: npm run db:purge-demo\n");
}

const admin = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Generator pseudolosowy z ziarnem — dane muszą być odtwarzalne. */
function makeRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}
const random = makeRandom(20260823);

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(random() * items.length)];
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Dzisiejsza data — punkt odniesienia dla całego zestawu. */
const TODAY = new Date().toISOString().slice(0, 10);

function fail(message: string, error: { message: string } | null): void {
  if (error) throw new Error(`${message}: ${error.message}`);
}

// ---------------------------------------------------------------------------

const PEOPLE = [
  { email: "bartosz@legal-wise.test", name: "Bartosz Śliwiński", role: "owner", rate: 60_000 },
  { email: "michal@legal-wise.test", name: "Michał Kucharski", role: "partner", rate: 55_000 },
  { email: "anna@legal-wise.test", name: "Anna Zielińska", role: "lawyer", rate: 38_000 },
  { email: "piotr@legal-wise.test", name: "Piotr Wójcik", role: "lawyer", rate: 34_000 },
  { email: "katarzyna@legal-wise.test", name: "Katarzyna Nowak", role: "staff", rate: 0 },
] as const;

const ACTIVITIES = [
  "Analiza akt sprawy",
  "Sporządzenie pisma procesowego",
  "Analiza odpowiedzi na pozew",
  "Przygotowanie wniosku dowodowego",
  "Konsultacja telefoniczna z klientem",
  "Korespondencja z pełnomocnikiem drugiej strony",
  "Udział w rozprawie",
  "Analiza dokumentacji przekazanej przez klienta",
  "Sporządzenie opinii prawnej",
  "Analiza projektu umowy",
  "Negocjacje warunków umowy",
  "Przygotowanie apelacji",
  "Ustalenia telefoniczne z sekretariatem sądu",
  "Sporządzenie zażalenia na postanowienie",
  "Analiza orzecznictwa",
  "Przygotowanie protokołu z posiedzenia zarządu",
];

const COURTS = [
  { name: "Sąd Okręgowy w Warszawie", department: "XVI Wydział Gospodarczy" },
  { name: "Sąd Rejonowy dla m.st. Warszawy", department: "VIII Wydział Gospodarczy" },
  { name: "Sąd Okręgowy w Warszawie", department: "I Wydział Cywilny" },
  { name: "Sąd Apelacyjny w Warszawie", department: "VII Wydział Pracy" },
  { name: "Sąd Rejonowy Warszawa-Śródmieście", department: "VI Wydział Cywilny" },
];

async function main() {
  // Skrypt zakłada czystą bazę — uruchamiany po `npm run db:reset`.
  // Świadomie nie czyści danych sam, żeby przypadkowe wywołanie na środowisku
  // z realnymi danymi niczego nie skasowało.
  const { count } = await admin
    .from("organizations")
    .select("id", { count: "exact", head: true });

  if ((count ?? 0) > 0) {
    throw new Error(
      "Baza nie jest pusta. Uruchom najpierw `npm run db:reset`, potem `npm run db:seed`.",
    );
  }

  console.log("Zakładanie kont…");
  const userIds: Record<string, string> = {};
  for (const person of PEOPLE) {
    const { data, error } = await admin.auth.admin.createUser({
      email: person.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: person.name },
    });
    if (error) throw new Error(`Konto ${person.email}: ${error.message}`);
    userIds[person.email] = data.user.id;
  }

  console.log("Tworzenie kancelarii…");
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({
      name: "Legal-Wise",
      legal_name: "Legal-Wise Śliwiński & Kucharski Adwokaci i Radcowie Prawni sp. p.",
      tax_id: "5213874116",
      address_line1: "ul. Emilii Plater 53",
      postal_code: "00-113",
      city: "Warszawa",
      bank_account: "PL61109010140000071219812874",
      email: "kancelaria@legal-wise.test",
      phone: "+48 792 654 026",
      default_vat_rate: 23,
      default_payment_days: 14,
      invoice_number_pattern: "FV/{nr}/{rok}",
    })
    .select("id")
    .single();
  fail("Kancelaria", orgError);
  const orgId = org!.id;

  await admin.from("organization_members").insert(
    PEOPLE.map((person) => ({
      organization_id: orgId,
      user_id: userIds[person.email],
      role: person.role,
      active: true,
    })),
  );

  await admin.from("member_rates").insert(
    PEOPLE.filter((person) => person.rate > 0).map((person) => ({
      organization_id: orgId,
      user_id: userIds[person.email],
      default_hourly_rate_grosz: person.rate,
    })),
  );

  console.log("Klienci…");
  const clientRows = [
    {
      name: "Acme Polska Sp. z o.o.",
      client_type: "firma" as const,
      tax_id: "7010234565",
      address_line1: "ul. Domaniewska 44",
      postal_code: "02-672",
      city: "Warszawa",
      email: "biuro@acme.test",
      billing_email: "faktury@acme.test",
      default_billing_model: "godzinowy" as const,
      default_hourly_rate_grosz: 45_000,
      phone: "+48 22 100 20 30",
    },
    {
      name: "Nordwind Logistics S.A.",
      client_type: "firma" as const,
      tax_id: "5252445129",
      address_line1: "al. Jerozolimskie 180",
      postal_code: "02-486",
      city: "Warszawa",
      email: "kontakt@nordwind.test",
      billing_email: "ksiegowosc@nordwind.test",
      default_billing_model: "ryczalt" as const,
      default_hourly_rate_grosz: 42_000,
      phone: "+48 22 500 11 22",
    },
    {
      name: "Medica Clinic Sp. z o.o.",
      client_type: "firma" as const,
      tax_id: "1132876540",
      address_line1: "ul. Puławska 145",
      postal_code: "02-715",
      city: "Warszawa",
      email: "sekretariat@medica.test",
      billing_email: "sekretariat@medica.test",
      default_billing_model: "godzinowy" as const,
      default_hourly_rate_grosz: 48_000,
      phone: "+48 22 640 88 00",
    },
    {
      name: "Jan Kowalski",
      client_type: "osoba_fizyczna" as const,
      tax_id: null,
      address_line1: "ul. Grójecka 12/5",
      postal_code: "02-019",
      city: "Warszawa",
      email: "j.kowalski@poczta.test",
      billing_email: "j.kowalski@poczta.test",
      default_billing_model: "godzinowy" as const,
      default_hourly_rate_grosz: 35_000,
      phone: "+48 601 234 567",
    },
    {
      name: "Przedsiębiorstwo Budowlane Granit Sp. z o.o.",
      client_type: "firma" as const,
      tax_id: "8272198457",
      address_line1: "ul. Kolejowa 8",
      postal_code: "05-800",
      city: "Pruszków",
      email: "biuro@granit.test",
      billing_email: "faktury@granit.test",
      default_billing_model: "godzinowy" as const,
      default_hourly_rate_grosz: 40_000,
      phone: "+48 22 758 40 10",
    },
    {
      name: "Fundacja Otwarte Drzwi",
      client_type: "firma" as const,
      tax_id: "5262456784",
      address_line1: "ul. Targowa 82",
      postal_code: "03-448",
      city: "Warszawa",
      email: "fundacja@otwartedrzwi.test",
      billing_email: "fundacja@otwartedrzwi.test",
      default_billing_model: "nieodplatny" as const,
      default_hourly_rate_grosz: null,
      phone: "+48 22 619 85 01",
    },
  ];

  const { data: clients, error: clientError } = await admin
    .from("clients")
    .insert(
      clientRows.map((row) => ({
        ...row,
        organization_id: orgId,
        relationship_owner_id: userIds[pick(PEOPLE.filter((p) => p.role !== "staff")).email],
      })),
    )
    .select("id, name");
  fail("Klienci", clientError);
  const clientId = (name: string) => clients!.find((c) => c.name.startsWith(name))!.id;

  console.log("Sprawy…");
  const caseRows = [
    {
      client: "Acme",
      case_number: "2026/001",
      title: "Acme przeciwko Beta Trade — zapłata za dostawy",
      case_type: "spor_sadowy" as const,
      signature: "XVI GC 1120/25",
      lead: "anna@legal-wise.test",
      billing_model: null,
      hourly_rate_grosz: null,
    },
    {
      client: "Acme",
      case_number: "2026/002",
      title: "Opinia w przedmiocie odpowiedzialności członków zarządu",
      case_type: "opinia" as const,
      signature: null,
      lead: "bartosz@legal-wise.test",
      billing_model: null,
      hourly_rate_grosz: null,
    },
    {
      client: "Nordwind",
      case_number: "2026/003",
      title: "Stała obsługa korporacyjna",
      case_type: "obsluga_korporacyjna" as const,
      signature: null,
      lead: "michal@legal-wise.test",
      billing_model: "ryczalt" as const,
      hourly_rate_grosz: null,
    },
    {
      client: "Nordwind",
      case_number: "2026/004",
      title: "Spór z przewoźnikiem o odszkodowanie za utratę ładunku",
      case_type: "spor_sadowy" as const,
      signature: "VIII GC 89/26",
      lead: "piotr@legal-wise.test",
      billing_model: "godzinowy" as const,
      hourly_rate_grosz: 42_000,
    },
    {
      client: "Medica",
      case_number: "2026/005",
      title: "Roszczenie pacjenta o zadośćuczynienie",
      case_type: "spor_sadowy" as const,
      signature: "I C 1234/25",
      lead: "bartosz@legal-wise.test",
      billing_model: null,
      hourly_rate_grosz: null,
    },
    {
      client: "Medica",
      case_number: "2026/006",
      title: "Umowa o współpracy z podmiotem leczniczym",
      case_type: "umowa" as const,
      signature: null,
      lead: "michal@legal-wise.test",
      billing_model: null,
      hourly_rate_grosz: null,
    },
    {
      client: "Jan Kowalski",
      case_number: "2026/007",
      title: "Kowalski przeciwko pracodawcy — przywrócenie do pracy",
      case_type: "spor_sadowy" as const,
      signature: "VII Pa 214/26",
      lead: "anna@legal-wise.test",
      billing_model: null,
      hourly_rate_grosz: null,
    },
    {
      client: "Przedsiębiorstwo Budowlane Granit",
      case_number: "2026/008",
      title: "Granit przeciwko inwestorowi — wynagrodzenie za roboty dodatkowe",
      case_type: "spor_sadowy" as const,
      signature: "XVI GC 442/26",
      lead: "piotr@legal-wise.test",
      billing_model: null,
      hourly_rate_grosz: null,
    },
    {
      client: "Przedsiębiorstwo Budowlane Granit",
      case_number: "2026/009",
      title: "Negocjacje ugody z podwykonawcą",
      case_type: "spor_pozasadowy" as const,
      signature: null,
      lead: "michal@legal-wise.test",
      billing_model: null,
      hourly_rate_grosz: null,
    },
    {
      client: "Fundacja Otwarte Drzwi",
      case_number: "2026/010",
      title: "Pomoc prawna dla podopiecznych fundacji",
      case_type: "inna" as const,
      signature: null,
      lead: "anna@legal-wise.test",
      billing_model: "nieodplatny" as const,
      hourly_rate_grosz: null,
    },
  ];

  const { data: cases, error: caseError } = await admin
    .from("cases")
    .insert(
      caseRows.map((row, index) => {
        const court = row.signature ? COURTS[index % COURTS.length] : null;
        return {
          organization_id: orgId,
          client_id: clientId(row.client),
          case_number: row.case_number,
          title: row.title,
          case_type: row.case_type,
          status: "aktywna" as const,
          signature: row.signature,
          court_name: court?.name ?? null,
          court_department: court?.department ?? null,
          lead_lawyer_id: userIds[row.lead],
          billing_model: row.billing_model,
          hourly_rate_grosz: row.hourly_rate_grosz,
          flat_fee_grosz: row.billing_model === "ryczalt" ? 800_000 : null,
          flat_fee_included_minutes: row.billing_model === "ryczalt" ? 1200 : null,
          description: null,
          opened_at: addDays(TODAY, -60 - index * 5),
          closed_at: null,
          created_by: userIds[row.lead],
        };
      }),
    )
    .select("id, case_number");
  fail("Sprawy", caseError);
  const caseId = (number: string) => cases!.find((c) => c.case_number === number)!.id;

  // Sprawy demonstracyjne mają numery nadane wprost, żeby dane były
  // powtarzalne. Licznik w bazie trzeba ustawić ręcznie — inaczej pierwsza
  // sprawa założona z aplikacji dostałaby numer 2026/001, który już istnieje,
  // i naruszyła ograniczenie unikalności.
  const seededYear = Number(caseRows[0].case_number.split("/")[0]);
  const highest = Math.max(...caseRows.map((row) => Number(row.case_number.split("/")[1])));
  const { error: sequenceError } = await admin
    .from("case_sequences")
    .upsert(
      { organization_id: orgId, year: seededYear, next_number: highest + 1 },
      { onConflict: "organization_id,year" },
    );
  fail("Licznik numerów spraw", sequenceError);

  console.log("Strony postępowania…");
  await admin.from("case_parties").insert([
    { case_id: caseId("2026/001"), role: "powod" as const, name: "Acme Polska Sp. z o.o." },
    { case_id: caseId("2026/001"), role: "pozwany" as const, name: "Beta Trade Sp. z o.o." },
    {
      case_id: caseId("2026/001"),
      role: "pelnomocnik_drugiej_strony" as const,
      name: "adw. Tomasz Lewandowski, Kancelaria Lewandowski i Wspólnicy",
    },
    { case_id: caseId("2026/005"), role: "pozwany" as const, name: "Medica Clinic Sp. z o.o." },
    { case_id: caseId("2026/005"), role: "powod" as const, name: "Krystyna Wiśniewska" },
    { case_id: caseId("2026/007"), role: "powod" as const, name: "Jan Kowalski" },
    { case_id: caseId("2026/007"), role: "pozwany" as const, name: "Logistyka Wschód S.A." },
  ].map((row) => ({ ...row, organization_id: orgId, contact: null })));

  console.log("Przypisania do spraw…");
  await admin.from("case_assignees").insert([
    { case_id: caseId("2026/001"), user_id: userIds["bartosz@legal-wise.test"], assignment_role: "member" as const },
    { case_id: caseId("2026/005"), user_id: userIds["anna@legal-wise.test"], assignment_role: "member" as const },
    { case_id: caseId("2026/008"), user_id: userIds["michal@legal-wise.test"], assignment_role: "member" as const },
  ].map((row) => ({ ...row, organization_id: orgId })));

  console.log("Ewidencja czasu…");
  const lawyers = PEOPLE.filter((person) => person.role !== "staff");
  const entries: Database["public"]["Tables"]["time_entries"]["Insert"][] = [];

  for (const row of caseRows) {
    const entryCount = row.case_type === "opinia" ? 6 : 10 + Math.floor(random() * 8);
    for (let index = 0; index < entryCount; index += 1) {
      const daysAgo = Math.floor(random() * 55);
      const author = pick(lawyers);
      const isProBono = row.billing_model === "nieodplatny";
      entries.push({
        organization_id: orgId,
        case_id: caseId(row.case_number),
        user_id: userIds[author.email],
        work_date: addDays(TODAY, -daysAgo),
        // Typowe wpisy kancelaryjne: od kwadransa do czterech godzin.
        minutes: pick([15, 30, 45, 60, 90, 120, 150, 180, 240]),
        description: pick(ACTIVITIES),
        billing_type: isProBono
          ? ("nieodplatny" as const)
          : row.billing_model === "ryczalt"
            ? ("ryczalt" as const)
            : ("godzinowy" as const),
      });
    }
  }

  // Kilka czynności pro bono w sprawach komercyjnych — kancelaria chce je
  // widzieć w zestawieniu dla klienta i w raporcie rentowności.
  for (const number of ["2026/001", "2026/005"]) {
    entries.push({
      organization_id: orgId,
      case_id: caseId(number),
      user_id: userIds["bartosz@legal-wise.test"],
      work_date: addDays(TODAY, -Math.floor(random() * 30)),
      minutes: 60,
      description: "Dodatkowa konsultacja nieodpłatna",
      billing_type: "nieodplatny" as const,
    });
  }

  const { error: entriesError } = await admin.from("time_entries").insert(entries);
  fail("Ewidencja czasu", entriesError);

  console.log("Zadania…");
  await admin.from("tasks").insert([
    {
      case_id: caseId("2026/001"),
      title: "Złożyć wniosek dowodowy o powołanie biegłego",
      task_kind: "zadanie" as const,
      priority: "wysoki" as const,
      assignee: "anna@legal-wise.test",
      due_date: addDays(TODAY, 3),
    },
    {
      case_id: caseId("2026/001"),
      title: "Uzupełnić braki formalne pozwu — odpis pełnomocnictwa",
      task_kind: "brak_formalny" as const,
      priority: "pilny" as const,
      assignee: "anna@legal-wise.test",
      due_date: addDays(TODAY, 2),
    },
    {
      case_id: caseId("2026/005"),
      title: "Uzupełnić opłatę od apelacji",
      task_kind: "brak_formalny" as const,
      priority: "pilny" as const,
      assignee: "bartosz@legal-wise.test",
      due_date: addDays(TODAY, -1),
    },
    {
      case_id: caseId("2026/002"),
      title: "Przygotować projekt opinii do akceptacji partnera",
      task_kind: "zadanie" as const,
      priority: "normalny" as const,
      assignee: "bartosz@legal-wise.test",
      due_date: addDays(TODAY, 5),
    },
    {
      case_id: caseId("2026/008"),
      title: "Zebrać dokumentację robót dodatkowych od klienta",
      task_kind: "zadanie" as const,
      priority: "normalny" as const,
      assignee: "piotr@legal-wise.test",
      due_date: addDays(TODAY, 7),
    },
    {
      case_id: caseId("2026/006"),
      title: "Nanieść uwagi klienta do projektu umowy",
      task_kind: "zadanie" as const,
      priority: "wysoki" as const,
      assignee: "michal@legal-wise.test",
      due_date: addDays(TODAY, 1),
    },
    {
      case_id: null,
      title: "Zamknięcie okresu rozliczeniowego — weryfikacja godzin",
      task_kind: "zadanie" as const,
      priority: "wysoki" as const,
      assignee: "michal@legal-wise.test",
      due_date: addDays(TODAY, 4),
    },
  ].map((row) => ({
    organization_id: orgId,
    case_id: row.case_id,
    title: row.title,
    description: null,
    task_kind: row.task_kind,
    status: "do_zrobienia" as const,
    priority: row.priority,
    assignee_id: userIds[row.assignee],
    due_date: row.due_date,
    created_by: userIds["bartosz@legal-wise.test"],
  })));

  console.log("Kalendarz…");
  await admin.from("calendar_events").insert([
    {
      case_id: caseId("2026/001"),
      title: "Rozprawa — Acme przeciwko Beta Trade",
      event_kind: "rozprawa" as const,
      days: 4,
      hour: 10,
      location: "Sąd Okręgowy w Warszawie, sala 214",
    },
    {
      case_id: caseId("2026/005"),
      title: "Rozprawa — roszczenie pacjenta",
      event_kind: "rozprawa" as const,
      days: 9,
      hour: 12,
      location: "Sąd Rejonowy dla m.st. Warszawy, sala 108",
    },
    {
      case_id: caseId("2026/007"),
      title: "Posiedzenie pojednawcze",
      event_kind: "posiedzenie" as const,
      days: 6,
      hour: 9,
      location: "Sąd Rejonowy Warszawa-Śródmieście, sala 12",
    },
    {
      case_id: caseId("2026/003"),
      title: "Spotkanie z zarządem Nordwind",
      event_kind: "spotkanie" as const,
      days: 2,
      hour: 15,
      location: "Siedziba klienta, al. Jerozolimskie 180",
    },
    {
      case_id: caseId("2026/008"),
      title: "Termin na złożenie pisma przygotowawczego",
      event_kind: "termin_procesowy" as const,
      days: 11,
      hour: 8,
      location: null,
    },
  ].map((row) => {
    const date = new Date(`${addDays(TODAY, row.days)}T00:00:00Z`);
    date.setUTCHours(row.hour - 2); // czas warszawski latem = UTC+2
    return {
      organization_id: orgId,
      case_id: row.case_id,
      task_id: null,
      title: row.title,
      event_kind: row.event_kind,
      starts_at: date.toISOString(),
      ends_at: new Date(date.getTime() + 2 * 3600 * 1000).toISOString(),
      all_day: false,
      location: row.location,
      description: null,
      source: "manual" as const,
      external_ref: null,
      created_by: userIds["katarzyna@legal-wise.test"],
    };
  }));

  console.log("Notatki…");
  await admin.from("case_notes").insert([
    {
      case_id: caseId("2026/001"),
      author: "anna@legal-wise.test",
      occurred_on: addDays(TODAY, -12),
      content:
        "Rozmowa z sekretariatem wydziału: akta zostały przekazane biegłemu, opinia spodziewana w terminie 6 tygodni. Termin rozprawy pozostaje bez zmian.",
    },
    {
      case_id: caseId("2026/001"),
      author: "bartosz@legal-wise.test",
      occurred_on: addDays(TODAY, -5),
      content:
        "Klient potwierdził gotowość do ugody przy kwocie nie niższej niż 180 000 zł. Umocowanie do negocjacji w tym zakresie.",
    },
    {
      case_id: caseId("2026/005"),
      author: "bartosz@legal-wise.test",
      occurred_on: addDays(TODAY, -8),
      content:
        "Ustalenia z klientem: dokumentacja medyczna kompletna, brakuje protokołu z konsylium z 14.03. Klient dostarczy do końca tygodnia.",
    },
    {
      case_id: caseId("2026/003"),
      author: "michal@legal-wise.test",
      occurred_on: addDays(TODAY, -3),
      content:
        "Zarząd sygnalizuje planowaną reorganizację spółek zależnych w IV kwartale. Wstępnie: przekształcenie dwóch spółek i aktualizacja umów wewnątrzgrupowych.",
    },
  ].map((row) => ({
    organization_id: orgId,
    case_id: row.case_id,
    author_id: userIds[row.author],
    occurred_on: row.occurred_on,
    content: row.content,
  })));

  console.log("");
  console.log("Gotowe. Dane logowania (wszystkie konta mają to samo hasło):");
  console.log(`  hasło: ${DEMO_PASSWORD}`);
  for (const person of PEOPLE) {
    console.log(`  ${person.email.padEnd(32)} ${person.name} — ${person.role}`);
  }
  console.log("");
  console.log(`Wpisów czasu: ${entries.length}, spraw: ${caseRows.length}, klientów: ${clientRows.length}`);
}

main().catch((error) => {
  console.error("");
  console.error("Seed przerwany:", error.message);
  process.exit(1);
});
