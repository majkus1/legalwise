/**
 * Usuwa dane pokazowe — kancelarię wraz ze wszystkim, co do niej należy,
 * oraz konta demonstracyjne.
 *
 * Po co osobny skrypt: wersję pokazową dla klienta trzeba czymś wypełnić, bo
 * pusty system niczego nie pokazuje. Ale zanim kancelaria zacznie prowadzić
 * prawdziwe sprawy, zmyśleni klienci muszą zniknąć — mieszanie ich z aktami
 * rzeczywistymi byłoby w systemie prawniczym gorsze niż brak danych.
 *
 * Wszystkie 19 powiązań z tabelą `organizations` ma `on delete cascade`, więc
 * usunięcie jednego wiersza zabiera sprawy, wpisy czasu, faktury, dokumenty
 * i powiadomienia. Konta w `auth.users` leżą poza tym łańcuchem i kasujemy
 * je osobno.
 *
 * Uruchomienie:
 *   npm run db:purge-demo            (baza lokalna)
 *   ALLOW_REMOTE_PURGE=1 npm run db:purge-demo   (baza zdalna)
 */
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import type { Database } from "../lib/database.types";

loadEnv({ path: ".env.local", quiet: true });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Brak NEXT_PUBLIC_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY w .env.local");
}

/** Adresy kont demonstracyjnych. Zgodne z `scripts/seed.ts`. */
const DEMO_EMAILS = [
  "bartosz@legal-wise.test",
  "michal@legal-wise.test",
  "anna@legal-wise.test",
  "piotr@legal-wise.test",
  "katarzyna@legal-wise.test",
];

const host = new URL(SUPABASE_URL).hostname;
const isLocal = host === "127.0.0.1" || host === "localhost";

// Kasowanie na bazie zdalnej wymaga osobnej zgody. To operacja nieodwracalna,
// a pomylka kosztowalaby kancelarie ich dane.
if (!isLocal && process.env.ALLOW_REMOTE_PURGE !== "1") {
  throw new Error(
    `Odmawiam sprzątania bazy ${host}. Świadome usunięcie danych pokazowych: ` +
      "ALLOW_REMOTE_PURGE=1 npm run db:purge-demo",
  );
}

const admin = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main(): Promise<void> {
  console.log(`Sprzątanie danych pokazowych na ${host}`);

  const { data: organizacje, error: bladOdczytu } = await admin
    .from("organizations")
    .select("id, name");

  if (bladOdczytu) throw new Error(`Nie udało się odczytać kancelarii: ${bladOdczytu.message}`);

  if (!organizacje || organizacje.length === 0) {
    console.log("Brak kancelarii w bazie — nie ma czego usuwać.");
  } else {
    // Wpisy czasu ujęte na zatwierdzonej fakturze są zablokowane przed
    // usunięciem — to zabezpieczenie przed cichym zmienianiem rozliczonych
    // godzin i nie chcemy go osłabiać. Trigger dopuszcza jednak samo ZDJĘCIE
    // blokady (robi to również cofnięcie zatwierdzenia faktury), więc
    // sprzątanie zdejmuje ją najpierw, zamiast obchodzić regułę.
    const { error: bladOdblokowania } = await admin
      .from("time_entries")
      .update({ locked_at: null, invoice_id: null })
      .not("locked_at", "is", null);

    if (bladOdblokowania) {
      throw new Error(`Nie udało się zdjąć blokad z wpisów czasu: ${bladOdblokowania.message}`);
    }

    // Pozycji zatwierdzonej faktury też nie wolno ruszać — dokument ma być
    // niezmienny po wystawieniu. Cofamy więc faktury do stanu szkicu, zamiast
    // wyłączać regułę: to ta sama droga, którą idzie anulowanie faktury.
    const { error: bladSzkicu } = await admin
      .from("invoices")
      .update({ status: "draft" })
      .neq("status", "draft");

    if (bladSzkicu) {
      throw new Error(`Nie udało się cofnąć faktur do szkicu: ${bladSzkicu.message}`);
    }

    // Rozliczenia usuwamy w kolejności zależności, a nie kaskadą.
    //
    // Przy kaskadowym usuwaniu kancelarii trigger pozycji faktury sprawdza
    // status dokumentu nadrzędnego — który jest już wtedy usunięty. Zapytanie
    // zwraca NULL, a `null is distinct from 'draft'` jest prawdą, więc reguła
    // blokuje własne sprzątanie. Kasując pozycje przed fakturami, pytamy
    // o status, gdy faktura jeszcze istnieje i jest szkicem.
    for (const [tabela, opis] of [
      ["invoice_items", "pozycje faktur"],
      ["invoices", "faktury"],
      ["invoice_sequences", "liczniki numeracji"],
    ] as const) {
      const { error } = await admin.from(tabela).delete().not("organization_id", "is", null);
      if (error) throw new Error(`Nie udało się usunąć ${opis}: ${error.message}`);
    }

    for (const organizacja of organizacje) {
      const { error } = await admin.from("organizations").delete().eq("id", organizacja.id);
      if (error) throw new Error(`Nie udało się usunąć „${organizacja.name}": ${error.message}`);
      console.log(`  usunięto kancelarię „${organizacja.name}" wraz z całą zawartością`);
    }
  }

  // Konta pokazowe. Kasujemy WYŁĄCZNIE te z listy — konta prawdziwych
  // użytkowników, gdyby już istniały, zostają nietknięte.
  const { data: lista } = await admin.auth.admin.listUsers({ perPage: 200 });
  let usunieteKonta = 0;

  for (const user of lista?.users ?? []) {
    if (!user.email || !DEMO_EMAILS.includes(user.email)) continue;
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw new Error(`Nie udało się usunąć konta ${user.email}: ${error.message}`);
    console.log(`  usunięto konto ${user.email}`);
    usunieteKonta += 1;
  }

  const pozostale = (lista?.users ?? []).filter(
    (user) => user.email && !DEMO_EMAILS.includes(user.email),
  );

  console.log(`\nGotowe. Usuniętych kont pokazowych: ${usunieteKonta}.`);
  if (pozostale.length > 0) {
    console.log(`Nietknięte konta spoza listy pokazowej: ${pozostale.length}.`);
  }
  console.log("Pierwsza osoba, która się zarejestruje, założy kancelarię od nowa.");
}

main().catch((error) => {
  console.error("Sprzątanie nie powiodło się:", error.message);
  process.exit(1);
});
