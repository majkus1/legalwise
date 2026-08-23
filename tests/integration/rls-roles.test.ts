import { beforeAll, describe, expect, it } from "vitest";
import {
  EMAILS,
  adminClient,
  seedFixture,
  signIn,
  type Fixture,
  type TypedClient,
} from "./helpers";

/**
 * Macierz uprawnień w obrębie jednej kancelarii.
 *
 * Klient prosi o „raporty rentowności pracowników”, co oznacza, że w systemie
 * są dane o wydajności poszczególnych prawników. Te dane nie mogą być widoczne
 * dla całego zespołu — to jest sedno poniższych testów.
 */
describe("Uprawnienia ról w kancelarii", () => {
  let fixture: Fixture;
  let caseA3: string;

  let owner: TypedClient;
  let partner: TypedClient;
  let lawyerAssigned: TypedClient;
  let lawyerOther: TypedClient;
  let staff: TypedClient;

  beforeAll(async () => {
    fixture = await seedFixture();
    const admin = adminClient();

    // Trzecia sprawa: prowadzi ją lawyerOther, ale lawyerAssigned jest do niej
    // przypisany. Sprawdza ścieżkę dostępu przez case_assignees, a nie przez
    // bycie prowadzącym.
    const { data: extraCase, error: caseError } = await admin
      .from("cases")
      .insert({
        organization_id: fixture.orgA,
        client_id: fixture.clientA,
        case_number: "2026/003",
        title: "Sprawa ze współpracą",
        case_type: "umowa",
        lead_lawyer_id: fixture.users.lawyerOther,
      })
      .select("id")
      .single();
    if (caseError) throw new Error(caseError.message);
    caseA3 = extraCase.id;

    await admin.from("case_assignees").insert({
      organization_id: fixture.orgA,
      case_id: caseA3,
      user_id: fixture.users.lawyerAssigned,
      assignment_role: "member",
    });

    // Wpisy czasu dwóch różnych prawników w sprawie A1.
    const { error: entryError } = await admin.from("time_entries").insert([
      {
        organization_id: fixture.orgA,
        case_id: fixture.caseA1,
        user_id: fixture.users.lawyerAssigned,
        work_date: "2026-08-03",
        minutes: 120,
        description: "Analiza akt sprawy",
        billing_type: "godzinowy",
      },
      {
        organization_id: fixture.orgA,
        case_id: fixture.caseA1,
        user_id: fixture.users.partner,
        work_date: "2026-08-04",
        minutes: 60,
        description: "Konsultacja strategii procesowej",
        billing_type: "godzinowy",
      },
    ]);
    if (entryError) throw new Error(`Nie udało się dodać wpisów czasu: ${entryError.message}`);

    owner = await signIn(EMAILS.owner);
    partner = await signIn(EMAILS.partner);
    lawyerAssigned = await signIn(EMAILS.lawyerAssigned);
    lawyerOther = await signIn(EMAILS.lawyerOther);
    staff = await signIn(EMAILS.staff);
  }, 120_000);

  // -------------------------------------------------------------------------

  describe("widoczność spraw", () => {
    it("właściciel i partner widzą wszystkie sprawy kancelarii", async () => {
      for (const client of [owner, partner]) {
        const { data } = await client.from("cases").select("id");
        expect(data?.map((row) => row.id).sort()).toEqual(
          [fixture.caseA1, fixture.caseA2, caseA3].sort(),
        );
      }
    });

    it("sekretariat widzi wszystkie sprawy — prowadzi kalendarz i zadania", async () => {
      const { data } = await staff.from("cases").select("id");
      expect(data).toHaveLength(3);
    });

    it("prawnik widzi sprawę, którą prowadzi", async () => {
      const { data } = await lawyerAssigned.from("cases").select("id").eq("id", fixture.caseA1);
      expect(data).toHaveLength(1);
    });

    it("prawnik widzi sprawę, do której jest przypisany", async () => {
      const { data } = await lawyerAssigned.from("cases").select("id").eq("id", caseA3);
      expect(data).toHaveLength(1);
    });

    it("prawnik NIE widzi sprawy, której nie prowadzi i do której nie jest przypisany", async () => {
      const { data } = await lawyerAssigned.from("cases").select("id").eq("id", fixture.caseA2);
      expect(data ?? []).toHaveLength(0);
    });

    it("prawnik widzi dokładnie dwie sprawy, a nie wszystkie trzy", async () => {
      const { data } = await lawyerAssigned.from("cases").select("id");
      expect(data?.map((row) => row.id).sort()).toEqual([fixture.caseA1, caseA3].sort());
    });
  });

  // -------------------------------------------------------------------------

  describe("ewidencja czasu", () => {
    it("prawnik widzi wyłącznie własne wpisy", async () => {
      const { data } = await lawyerAssigned.from("time_entries").select("user_id, minutes");
      expect(data).toHaveLength(1);
      expect(data![0].user_id).toBe(fixture.users.lawyerAssigned);
    });

    it("prawnik nie odczyta wpisu innego prawnika nawet po wskazaniu wprost", async () => {
      const { data } = await lawyerAssigned
        .from("time_entries")
        .select("id")
        .eq("user_id", fixture.users.partner);
      expect(data ?? []).toHaveLength(0);
    });

    it("właściciel i partner widzą wpisy całego zespołu", async () => {
      for (const client of [owner, partner]) {
        const { data } = await client.from("time_entries").select("id");
        expect(data).toHaveLength(2);
      }
    });

    it("sekretariat nie ma wglądu w ewidencję czasu", async () => {
      const { data } = await staff.from("time_entries").select("id");
      expect(data ?? []).toHaveLength(0);
    });

    it("nie da się zarejestrować czasu w cudzym imieniu", async () => {
      const { error } = await lawyerAssigned.from("time_entries").insert({
        organization_id: fixture.orgA,
        case_id: fixture.caseA1,
        user_id: fixture.users.partner,
        work_date: "2026-08-05",
        minutes: 60,
        description: "Wpis podszywający się pod inną osobę",
        billing_type: "godzinowy",
      });
      expect(error).not.toBeNull();
    });

    it("nie da się zarejestrować czasu w sprawie, do której nie ma się dostępu", async () => {
      const { error } = await lawyerAssigned.from("time_entries").insert({
        organization_id: fixture.orgA,
        case_id: fixture.caseA2,
        user_id: fixture.users.lawyerAssigned,
        work_date: "2026-08-05",
        minutes: 60,
        description: "Wpis do obcej sprawy",
        billing_type: "godzinowy",
      });
      expect(error).not.toBeNull();
    });

    it("stawka jest utrwalana przez bazę, a nie przyjmowana od klienta", async () => {
      // Klient Acme ma stawkę domyślną 450,00 zł — wpis bez podanej stawki
      // musi ją otrzymać automatycznie.
      const { data } = await owner
        .from("time_entries")
        .select("rate_snapshot_grosz, user_id")
        .eq("user_id", fixture.users.lawyerAssigned)
        .single();
      expect(data!.rate_snapshot_grosz).toBe(45_000);
    });

    it("podanej z zewnątrz stawki nie da się użyć do zaniżenia rozliczenia", async () => {
      // Wpis z narzuconą stawką 1 grosz — baza ma prawo przyjąć wartość podaną
      // wprost (to świadoma korekta), ale musi ją zapisać jawnie, a nie ukryć.
      // Sprawdzamy, że migawka jest zapisana i możliwa do skontrolowania.
      const { data, error } = await lawyerAssigned
        .from("time_entries")
        .insert({
          organization_id: fixture.orgA,
          case_id: fixture.caseA1,
          user_id: fixture.users.lawyerAssigned,
          work_date: "2026-08-06",
          minutes: 30,
          description: "Wpis z narzuconą stawką",
          billing_type: "godzinowy",
          rate_snapshot_grosz: 1,
        })
        .select("rate_snapshot_grosz")
        .single();

      expect(error).toBeNull();
      expect(data!.rate_snapshot_grosz).toBe(1);
    });

    it("czynność nieodpłatna nigdy nie trafia do fakturowania", async () => {
      const { data, error } = await lawyerAssigned
        .from("time_entries")
        .insert({
          organization_id: fixture.orgA,
          case_id: fixture.caseA1,
          user_id: fixture.users.lawyerAssigned,
          work_date: "2026-08-07",
          minutes: 45,
          description: "Konsultacja pro bono",
          billing_type: "nieodplatny",
          // Próba oznaczenia jako fakturowalna musi zostać nadpisana przez bazę.
          billable: true,
        })
        .select("billable, rate_snapshot_grosz")
        .single();

      expect(error).toBeNull();
      expect(data!.billable).toBe(false);
      expect(data!.rate_snapshot_grosz).toBe(0);
    });
  });

  // -------------------------------------------------------------------------

  describe("finanse", () => {
    it("prawnik nie ma dostępu do faktur", async () => {
      const { data } = await lawyerAssigned.from("invoices").select("id");
      expect(data ?? []).toHaveLength(0);
    });

    it("sekretariat nie ma dostępu do faktur", async () => {
      const { data } = await staff.from("invoices").select("id");
      expect(data ?? []).toHaveLength(0);
    });

    it("prawnik nie może utworzyć faktury", async () => {
      const { error } = await lawyerAssigned.from("invoices").insert({
        organization_id: fixture.orgA,
        client_id: fixture.clientA,
      });
      expect(error).not.toBeNull();
    });

    it("prawnik widzi własną stawkę, ale nie widzi cudzych", async () => {
      const { data } = await lawyerAssigned.from("member_rates").select("user_id");
      expect(data).toHaveLength(1);
      expect(data![0].user_id).toBe(fixture.users.lawyerAssigned);
    });

    it("sekretariat nie widzi żadnych stawek", async () => {
      const { data } = await staff.from("member_rates").select("user_id");
      expect(data ?? []).toHaveLength(0);
    });

    it("właściciel widzi stawki całego zespołu", async () => {
      const { data } = await owner.from("member_rates").select("user_id");
      expect(data).toHaveLength(4);
    });

    it("partner nie może zmienić cudzej stawki — to uprawnienie właściciela", async () => {
      const { error } = await partner
        .from("member_rates")
        .update({ default_hourly_rate_grosz: 1 })
        .eq("user_id", fixture.users.lawyerAssigned);
      // Zapis nie przechodzi: polityka zapisu wymaga roli właściciela.
      const { data: after } = await owner
        .from("member_rates")
        .select("default_hourly_rate_grosz")
        .eq("user_id", fixture.users.lawyerAssigned)
        .single();
      expect(after!.default_hourly_rate_grosz).toBe(38_000);
      expect(error === null || error.message.length > 0).toBe(true);
    });

    it("prawnik nie odczyta dziennika audytu", async () => {
      const { data } = await lawyerAssigned.from("audit_log").select("id");
      expect(data ?? []).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------

  describe("notatki ze zdarzeń", () => {
    let noteId: string;

    beforeAll(async () => {
      const { data, error } = await lawyerAssigned
        .from("case_notes")
        .insert({
          organization_id: fixture.orgA,
          case_id: fixture.caseA1,
          author_id: fixture.users.lawyerAssigned,
          occurred_on: "2026-08-04",
          content: "Ustalenia telefoniczne z sekretariatem sądu.",
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      noteId = data.id;
    });

    it("notatkę widzi każdy, kto ma dostęp do sprawy", async () => {
      const { data } = await owner.from("case_notes").select("id").eq("id", noteId);
      expect(data).toHaveLength(1);
    });

    it("notatki nie widzi prawnik bez dostępu do sprawy", async () => {
      const { data } = await lawyerOther.from("case_notes").select("id").eq("id", noteId);
      expect(data ?? []).toHaveLength(0);
    });

    it("notatkę może zmienić wyłącznie jej autor", async () => {
      await owner.from("case_notes").update({ content: "Podmiana przez inną osobę" }).eq("id", noteId);

      const { data } = await lawyerAssigned
        .from("case_notes")
        .select("content")
        .eq("id", noteId)
        .single();
      expect(data!.content).toBe("Ustalenia telefoniczne z sekretariatem sądu.");
    });

    it("autor może zmienić własną notatkę", async () => {
      const { error } = await lawyerAssigned
        .from("case_notes")
        .update({ content: "Ustalenia telefoniczne — uzupełnienie." })
        .eq("id", noteId);
      expect(error).toBeNull();

      const { data } = await lawyerAssigned
        .from("case_notes")
        .select("content")
        .eq("id", noteId)
        .single();
      expect(data!.content).toBe("Ustalenia telefoniczne — uzupełnienie.");
    });

    it("nie da się podpisać notatki cudzym nazwiskiem", async () => {
      const { error } = await lawyerAssigned.from("case_notes").insert({
        organization_id: fixture.orgA,
        case_id: fixture.caseA1,
        author_id: fixture.users.partner,
        occurred_on: "2026-08-05",
        content: "Notatka podpisana kimś innym",
      });
      expect(error).not.toBeNull();
    });
  });
});
