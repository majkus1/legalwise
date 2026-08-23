import { beforeAll, describe, expect, it } from "vitest";
import {
  ALL_TABLES,
  EMAILS,
  anonClient,
  seedFixture,
  signIn,
  type Fixture,
  type TypedClient,
} from "./helpers";

/**
 * Izolacja danych — najważniejszy test w całym zestawie.
 *
 * Sprawdzamy KAŻDĄ tabelę osobno, a nie próbkę. Tabela pominięta przy
 * konfigurowaniu RLS wygląda dokładnie tak samo jak zabezpieczona, dopóki
 * ktoś jej nie odpyta.
 */
describe("Izolacja danych", () => {
  let fixture: Fixture;

  beforeAll(async () => {
    fixture = await seedFixture();
  }, 120_000);

  describe("użytkownik anonimowy", () => {
    it("nie odczytuje żadnej tabeli", async () => {
      const anon = anonClient();

      for (const table of ALL_TABLES) {
        const { data, error } = await anon.from(table).select("*");
        // Dopuszczalny jest zarówno błąd uprawnień, jak i pusty wynik —
        // liczy się to, że nie wypływa ani jeden wiersz.
        expect(data ?? [], `tabela ${table} wyciekła do użytkownika anonimowego`).toHaveLength(0);
        if (error) expect(error.message).toBeTruthy();
      }
    });

    it("nie może wywołać funkcji zwracającej listę zespołu", async () => {
      const anon = anonClient();
      const { data } = await anon.rpc("organization_member_directory", { p_org: fixture.orgA });
      expect(data ?? []).toHaveLength(0);
    });
  });

  describe("zalogowany bez przyznanego dostępu", () => {
    let outsider: TypedClient;

    beforeAll(async () => {
      outsider = await signIn(EMAILS.outsider);
    });

    it("nie widzi danych żadnej kancelarii", async () => {
      for (const table of ALL_TABLES) {
        // Własny wpis w katalogu użytkowników jest dozwolony — to dane
        // samego zainteresowanego, nie dane kancelarii.
        if (table === "user_directory_profiles") continue;

        const { data } = await outsider.from(table).select("*");
        expect(data ?? [], `tabela ${table} wyciekła do osoby bez dostępu`).toHaveLength(0);
      }
    });

    it("w katalogu użytkowników widzi wyłącznie własny wpis", async () => {
      const { data } = await outsider.from("user_directory_profiles").select("user_id, email");
      expect(data).toHaveLength(1);
      expect(data![0].user_id).toBe(fixture.users.outsider);
    });

    it("nie może dopisać sobie członkostwa w kancelarii", async () => {
      // To jest próba obejścia całego modelu dostępu: gdyby INSERT przeszedł,
      // każdy zarejestrowany użytkownik wchodziłby do dowolnej kancelarii.
      const { error } = await outsider.from("organization_members").insert({
        organization_id: fixture.orgA,
        user_id: fixture.users.outsider,
        role: "owner",
      });

      expect(error).not.toBeNull();

      const { data } = await outsider.from("organization_members").select("*");
      expect(data ?? []).toHaveLength(0);
    });

    it("nie może założyć nowej kancelarii, gdy jakaś już istnieje", async () => {
      // Bez tego ograniczenia można by ominąć ekran oczekiwania na dostęp,
      // zakładając sobie własną organizację.
      const { error } = await outsider.rpc("bootstrap_organization", {
        p_name: "Kancelaria obejścia",
      });
      expect(error).not.toBeNull();
      expect(error!.message).toContain("już skonfigurowana");
    });

    it("nie może nadać sobie roli przez RPC", async () => {
      const { error } = await outsider.rpc("set_member_role", {
        p_org: fixture.orgA,
        p_email: EMAILS.outsider,
        p_role: "owner",
      });
      expect(error).not.toBeNull();
      expect(error!.message).toContain("właściciel");
    });
  });

  describe("właściciel innej kancelarii", () => {
    let ownerB: TypedClient;

    beforeAll(async () => {
      ownerB = await signIn(EMAILS.ownerB);
    });

    it("nie widzi ani jednego rekordu obcej kancelarii", async () => {
      // Zawężone do tabel mających kolumnę `id` — unia wszystkich tabel
      // dawałaby część wspólną kolumn, a nie ich sumę.
      const checks: Array<["clients" | "cases", string]> = [
        ["clients", fixture.clientA],
        ["cases", fixture.caseA1],
      ];

      for (const [table, id] of checks) {
        const { data } = await ownerB.from(table).select("id").eq("id", id);
        expect(data ?? [], `${table} wyciekło między kancelariami`).toHaveLength(0);
      }
    });

    it("widzi wyłącznie własną organizację", async () => {
      const { data } = await ownerB.from("organizations").select("id");
      expect(data).toHaveLength(1);
      expect(data![0].id).toBe(fixture.orgB);
    });

    it("widzi wyłącznie własną sprawę", async () => {
      const { data } = await ownerB.from("cases").select("id");
      expect(data).toHaveLength(1);
      expect(data![0].id).toBe(fixture.caseB1);
    });

    it("nie może dopisać sprawy do obcej kancelarii", async () => {
      const { error } = await ownerB.from("cases").insert({
        organization_id: fixture.orgA,
        client_id: fixture.clientA,
        case_number: "PODSZYCIE/1",
        title: "Sprawa wstawiona z zewnątrz",
      });
      expect(error).not.toBeNull();
    });

    it("nie może odczytać stawek obcej kancelarii", async () => {
      const { data } = await ownerB.from("member_rates").select("*");
      expect(data ?? []).toHaveLength(0);
    });

    it("nie może odczytać dziennika audytu obcej kancelarii", async () => {
      const { data } = await ownerB
        .from("audit_log")
        .select("*")
        .eq("organization_id", fixture.orgA);
      expect(data ?? []).toHaveLength(0);
    });
  });
});
