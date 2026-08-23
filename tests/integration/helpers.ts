import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Client as PgClient } from "pg";
import { config as loadEnv } from "dotenv";
import type { Database } from "@/lib/database.types";

loadEnv({ path: ".env.local", quiet: true });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DB_URL = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55322/postgres";

export const TEST_PASSWORD = "TestoweHaslo!2026";

export type TypedClient = SupabaseClient<Database>;

/** Klient z kluczem serwisowym — omija RLS. Wyłącznie do przygotowania danych. */
export function adminClient(): TypedClient {
  return createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Klient anonimowy — bez żadnej tożsamości. */
export function anonClient(): TypedClient {
  return createClient<Database>(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Surowe SQL — potrzebne do czyszczenia stanu, czego supabase-js nie potrafi. */
export async function runSql(sql: string): Promise<void> {
  const client = new PgClient({ connectionString: DB_URL });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

export async function querySql<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const client = new PgClient({ connectionString: DB_URL });
  await client.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows as T[];
  } finally {
    await client.end();
  }
}

/**
 * Czyści bazę do stanu wyjściowego.
 *
 * Kolejność nie ma znaczenia dzięki CASCADE, ale wyliczenie tabel wprost jest
 * celowe: gdy pojawi się nowa tabela, brak jej tutaj ujawni się jako
 * przeciekanie danych między testami, a nie jako cicha nieszczelność.
 */
export async function resetDatabase(): Promise<void> {
  await runSql(`
    truncate table
      public.notification_dispatch_events,
      public.notification_preferences,
      public.push_subscriptions,
      public.user_notifications,
      public.audit_log,
      public.invoice_items,
      public.invoices,
      public.invoice_sequences,
      public.time_entries,
      public.calendar_events,
      public.tasks,
      public.case_documents,
      public.case_notes,
      public.case_assignees,
      public.case_parties,
      public.cases,
      public.clients,
      public.member_rates,
      public.organization_members,
      public.organizations
    restart identity cascade;
    delete from auth.users;
  `);
}

/** Zakłada konto i zwraca jego identyfikator. */
export async function createUser(email: string, displayName: string): Promise<string> {
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (error) throw new Error(`Nie udało się założyć konta ${email}: ${error.message}`);
  return data.user.id;
}

/** Loguje się i zwraca klienta działającego z tożsamością tego użytkownika. */
export async function signIn(email: string): Promise<TypedClient> {
  const client = createClient<Database>(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD });
  if (error) throw new Error(`Nie udało się zalogować jako ${email}: ${error.message}`);
  return client;
}

// ---------------------------------------------------------------------------
// Scenariusz testowy
// ---------------------------------------------------------------------------

export interface Fixture {
  orgA: string;
  orgB: string;
  users: {
    owner: string;
    partner: string;
    /** Prawnik przypisany do sprawy A1. */
    lawyerAssigned: string;
    /** Prawnik BEZ przypisania do sprawy A1 — kluczowy dla testów izolacji. */
    lawyerOther: string;
    staff: string;
    /** Zarejestrowany, ale bez przyznanego dostępu do kancelarii. */
    outsider: string;
    /** Właściciel zupełnie innej kancelarii. */
    ownerB: string;
  };
  clientA: string;
  clientB: string;
  /** Sprawa kancelarii A, prowadzona przez lawyerAssigned. */
  caseA1: string;
  /** Druga sprawa kancelarii A, prowadzona przez lawyerOther. */
  caseA2: string;
  /** Sprawa innej kancelarii. */
  caseB1: string;
}

export const EMAILS = {
  owner: "wlasciciel@test.local",
  partner: "partner@test.local",
  lawyerAssigned: "prawnik-przypisany@test.local",
  lawyerOther: "prawnik-inny@test.local",
  staff: "sekretariat@test.local",
  outsider: "obcy@test.local",
  ownerB: "wlasciciel-b@test.local",
} as const;

/**
 * Buduje dwie kancelarie z pełnym zestawem ról.
 *
 * Dane zakładamy kluczem serwisowym, żeby scenariusz był deterministyczny
 * i niezależny od tego, czy ścieżka aplikacyjna akurat działa.
 */
export async function seedFixture(): Promise<Fixture> {
  await resetDatabase();
  const admin = adminClient();

  const users = {
    owner: await createUser(EMAILS.owner, "Bartosz Śliwiński"),
    partner: await createUser(EMAILS.partner, "Michał Kucharski"),
    lawyerAssigned: await createUser(EMAILS.lawyerAssigned, "Anna Zielińska"),
    lawyerOther: await createUser(EMAILS.lawyerOther, "Piotr Wójcik"),
    staff: await createUser(EMAILS.staff, "Katarzyna Nowak"),
    outsider: await createUser(EMAILS.outsider, "Jan Obcy"),
    ownerB: await createUser(EMAILS.ownerB, "Właściciel B"),
  };

  const { data: orgs, error: orgError } = await admin
    .from("organizations")
    .insert([
      { name: "Legal-Wise", legal_name: "Legal-Wise Śliwiński & Kucharski", tax_id: "5252445767" },
      { name: "Inna Kancelaria", tax_id: "1234563218" },
    ])
    .select("id, name");
  if (orgError) throw new Error(`Nie udało się utworzyć organizacji: ${orgError.message}`);

  const orgA = orgs!.find((o) => o.name === "Legal-Wise")!.id;
  const orgB = orgs!.find((o) => o.name === "Inna Kancelaria")!.id;

  const { error: memberError } = await admin.from("organization_members").insert([
    { organization_id: orgA, user_id: users.owner, role: "owner" },
    { organization_id: orgA, user_id: users.partner, role: "partner" },
    { organization_id: orgA, user_id: users.lawyerAssigned, role: "lawyer" },
    { organization_id: orgA, user_id: users.lawyerOther, role: "lawyer" },
    { organization_id: orgA, user_id: users.staff, role: "staff" },
    { organization_id: orgB, user_id: users.ownerB, role: "owner" },
  ]);
  if (memberError) throw new Error(`Nie udało się dodać członków: ${memberError.message}`);

  await admin.from("member_rates").insert([
    { organization_id: orgA, user_id: users.owner, default_hourly_rate_grosz: 60_000 },
    { organization_id: orgA, user_id: users.partner, default_hourly_rate_grosz: 55_000 },
    { organization_id: orgA, user_id: users.lawyerAssigned, default_hourly_rate_grosz: 38_000 },
    { organization_id: orgA, user_id: users.lawyerOther, default_hourly_rate_grosz: 35_000 },
  ]);

  const { data: clients, error: clientError } = await admin
    .from("clients")
    .insert([
      // Uwaga: przy wstawianiu wsadowym PostgREST wysyła NULL dla kluczy
      // brakujących w którymkolwiek obiekcie, zamiast pominąć kolumnę.
      // Wartości domyślne z bazy wtedy NIE zadziałają, dlatego wszystkie
      // obiekty muszą mieć identyczny zestaw pól.
      {
        organization_id: orgA,
        name: "Acme Sp. z o.o.",
        tax_id: "7010012356",
        default_billing_model: "godzinowy",
        default_hourly_rate_grosz: 45_000,
      },
      {
        organization_id: orgB,
        name: "Klient obcej kancelarii",
        tax_id: null,
        default_billing_model: "godzinowy",
        default_hourly_rate_grosz: null,
      },
    ])
    .select("id, organization_id");
  if (clientError) throw new Error(`Nie udało się utworzyć klientów: ${clientError.message}`);

  const clientA = clients!.find((c) => c.organization_id === orgA)!.id;
  const clientB = clients!.find((c) => c.organization_id === orgB)!.id;

  const { data: cases, error: caseError } = await admin
    .from("cases")
    .insert([
      {
        organization_id: orgA,
        client_id: clientA,
        case_number: "2026/001",
        title: "Acme przeciwko Beta",
        case_type: "spor_sadowy",
        signature: "I C 1234/25",
        court_name: "Sąd Okręgowy w Warszawie",
        lead_lawyer_id: users.lawyerAssigned,
      },
      {
        organization_id: orgA,
        client_id: clientA,
        case_number: "2026/002",
        title: "Opinia podatkowa Acme",
        case_type: "opinia",
        signature: null,
        court_name: null,
        lead_lawyer_id: users.lawyerOther,
      },
      {
        organization_id: orgB,
        client_id: clientB,
        case_number: "B/001",
        title: "Sprawa obcej kancelarii",
        case_type: "spor_sadowy",
        signature: null,
        court_name: null,
        lead_lawyer_id: null,
      },
    ])
    .select("id, case_number");
  if (caseError) throw new Error(`Nie udało się utworzyć spraw: ${caseError.message}`);

  const caseA1 = cases!.find((c) => c.case_number === "2026/001")!.id;
  const caseA2 = cases!.find((c) => c.case_number === "2026/002")!.id;
  const caseB1 = cases!.find((c) => c.case_number === "B/001")!.id;

  return { orgA, orgB, users, clientA, clientB, caseA1, caseA2, caseB1 };
}

/** Wszystkie tabele domenowe — do sprawdzania, że ktoś nie widzi NICZEGO. */
export const ALL_TABLES = [
  "organizations",
  "organization_members",
  "user_directory_profiles",
  "member_rates",
  "audit_log",
  "clients",
  "cases",
  "case_parties",
  "case_assignees",
  "case_notes",
  "case_documents",
  "time_entries",
  "tasks",
  "calendar_events",
  "invoices",
  "invoice_items",
] as const;
