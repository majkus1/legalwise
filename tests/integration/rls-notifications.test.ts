import { beforeAll, describe, expect, it } from "vitest";
import {
  EMAILS,
  adminClient,
  anonClient,
  seedFixture,
  signIn,
  type Fixture,
  type TypedClient,
} from "./helpers";

/**
 * Uprawnienia w module powiadomień.
 *
 * Powiadomienia niosą treść spraw (numery, tytuły braków formalnych), więc
 * podlegają tej samej dyscyplinie co reszta danych kancelarii.
 */
describe("Powiadomienia — uprawnienia", () => {
  let fixture: Fixture;
  let owner: TypedClient;
  let lawyer: TypedClient;

  beforeAll(async () => {
    fixture = await seedFixture();
    const admin = adminClient();

    await admin.from("user_notifications").insert([
      {
        organization_id: fixture.orgA,
        user_id: fixture.users.owner,
        kind: "poranny_przeglad",
        title: "Przegląd właściciela",
        body: "Treść przeznaczona dla właściciela",
        url: "/",
        event_key: "test:owner",
      },
      {
        organization_id: fixture.orgA,
        user_id: fixture.users.lawyerAssigned,
        kind: "brak_formalny_termin",
        title: "Brak formalny — termin jutro",
        body: "Treść przeznaczona dla prawnika",
        url: "/zadania",
        event_key: "test:lawyer",
      },
    ]);

    await admin.from("push_subscriptions").insert([
      {
        organization_id: fixture.orgA,
        user_id: fixture.users.owner,
        endpoint: "https://push.example/owner-device",
        p256dh: "klucz-publiczny-wlasciciela",
        auth: "sekret-wlasciciela",
      },
    ]);

    owner = await signIn(EMAILS.owner);
    lawyer = await signIn(EMAILS.lawyerAssigned);
  }, 120_000);

  describe("skrzynka powiadomień", () => {
    it("każdy widzi wyłącznie własne powiadomienia", async () => {
      const { data: ownerRows } = await owner.from("user_notifications").select("title");
      expect(ownerRows).toHaveLength(1);
      expect(ownerRows![0].title).toBe("Przegląd właściciela");

      const { data: lawyerRows } = await lawyer.from("user_notifications").select("title");
      expect(lawyerRows).toHaveLength(1);
      expect(lawyerRows![0].title).toBe("Brak formalny — termin jutro");
    });

    it("właściciel nie odczyta powiadomienia prawnika mimo pełnych uprawnień w kancelarii", async () => {
      // Powiadomienia to korespondencja skierowana do konkretnej osoby —
      // rola zarządcza nie daje wglądu w cudzą skrzynkę.
      const { data } = await owner
        .from("user_notifications")
        .select("id")
        .eq("user_id", fixture.users.lawyerAssigned);
      expect(data ?? []).toHaveLength(0);
    });

    it("nie da się oznaczyć cudzego powiadomienia jako przeczytane", async () => {
      await lawyer
        .from("user_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("event_key", "test:owner");

      const { data } = await owner
        .from("user_notifications")
        .select("read_at")
        .eq("event_key", "test:owner")
        .single();
      expect(data!.read_at).toBeNull();
    });

    it("użytkownik anonimowy nie odczyta żadnego powiadomienia", async () => {
      const { data } = await anonClient().from("user_notifications").select("id");
      expect(data ?? []).toHaveLength(0);
    });
  });

  describe("subskrypcje push", () => {
    it("użytkownik widzi wyłącznie własne urządzenia", async () => {
      const { data: ownerRows } = await owner.from("push_subscriptions").select("endpoint");
      expect(ownerRows).toHaveLength(1);

      const { data: lawyerRows } = await lawyer.from("push_subscriptions").select("endpoint");
      expect(lawyerRows ?? []).toHaveLength(0);
    });

    it("nie da się zapisać subskrypcji na cudze konto", async () => {
      const { error } = await lawyer.from("push_subscriptions").insert({
        organization_id: fixture.orgA,
        user_id: fixture.users.owner,
        endpoint: "https://push.example/podszycie",
        p256dh: "x",
        auth: "y",
      });
      expect(error).not.toBeNull();
    });
  });

  describe("preferencje", () => {
    it("nie da się zmienić cudzych preferencji", async () => {
      const admin = adminClient();
      await admin.from("notification_preferences").insert({
        organization_id: fixture.orgA,
        user_id: fixture.users.owner,
        digest_enabled: true,
      });

      await lawyer
        .from("notification_preferences")
        .update({ digest_enabled: false })
        .eq("user_id", fixture.users.owner);

      const { data } = await owner
        .from("notification_preferences")
        .select("digest_enabled")
        .eq("user_id", fixture.users.owner)
        .single();
      expect(data!.digest_enabled).toBe(true);
    });

    it("set_own_push_enabled działa wyłącznie na własnym wpisie", async () => {
      // Funkcja nie przyjmuje identyfikatora użytkownika — bierze go
      // z auth.uid(), więc nie da się jej użyć na cudzym koncie.
      const { error } = await lawyer.rpc("set_own_push_enabled", {
        p_org: fixture.orgA,
        p_enabled: true,
      });
      expect(error).toBeNull();

      const { data } = await lawyer
        .from("notification_preferences")
        .select("user_id, push_enabled")
        .eq("push_enabled", true);

      expect(data).toHaveLength(1);
      expect(data![0].user_id).toBe(fixture.users.lawyerAssigned);
    });

    it("nie da się włączyć push w obcej kancelarii", async () => {
      const { error } = await lawyer.rpc("set_own_push_enabled", {
        p_org: fixture.orgB,
        p_enabled: true,
      });
      expect(error).not.toBeNull();
    });
  });

  describe("księga wysyłek", () => {
    it("jest całkowicie niedostępna dla zalogowanego użytkownika", async () => {
      // Księga zawiera adresy i klucze deduplikacji z wielu kont naraz —
      // korzysta z niej wyłącznie kod serwerowy z kluczem serwisowym.
      for (const client of [owner, lawyer]) {
        const { data } = await client.from("notification_dispatch_events").select("*");
        expect(data ?? []).toHaveLength(0);
      }
    });

    it("nie przyjmuje zapisu od zalogowanego użytkownika", async () => {
      const { error } = await owner.from("notification_dispatch_events").insert({
        organization_id: fixture.orgA,
        user_id: fixture.users.owner,
        channel: "email",
        dedupe_key: "proba-zapisu",
      });
      expect(error).not.toBeNull();
    });
  });
});
