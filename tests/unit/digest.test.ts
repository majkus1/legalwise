import { describe, expect, it } from "vitest";
import {
  buildDigest,
  daysBetween,
  digestEventKey,
  dispatchKey,
  renderDigestText,
  shouldEscalateDeficiency,
  type DigestInput,
} from "@/lib/notifications/digest";

const ALL_ON = {
  digestEnabled: true,
  includeDeadlines: true,
  includeDeficiencies: true,
  includeTasks: true,
  includeBilling: true,
};

function input(overrides: Partial<DigestInput> = {}): DigestInput {
  return {
    displayName: "Bartosz Śliwiński",
    role: "owner",
    today: "2026-08-24",
    preferences: ALL_ON,
    deficiencies: [],
    eventsToday: [],
    tasksDue: [],
    tasksOverdue: [],
    billing: null,
    ...overrides,
  };
}

describe("daysBetween", () => {
  it("liczy różnicę dni", () => {
    expect(daysBetween("2026-08-24", "2026-08-27")).toBe(3);
    expect(daysBetween("2026-08-24", "2026-08-24")).toBe(0);
    expect(daysBetween("2026-08-24", "2026-08-20")).toBe(-4);
  });

  it("poprawnie przechodzi przez granicę miesiąca i roku", () => {
    expect(daysBetween("2026-08-31", "2026-09-01")).toBe(1);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
  });

  it("nie gubi dnia przy zmianie czasu", () => {
    // 29.03.2026 to zmiana czasu na letni; doba ma wtedy 23 godziny.
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
    // 25.10.2026 to zmiana na zimowy; doba ma 25 godzin.
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
  });
});

describe("shouldEscalateDeficiency", () => {
  it("przypomina na trzy dni przed terminem", () => {
    expect(shouldEscalateDeficiency("2026-08-24", "2026-08-27")).toBe(true);
  });

  it("przypomina dzień przed i w dniu terminu", () => {
    expect(shouldEscalateDeficiency("2026-08-24", "2026-08-25")).toBe(true);
    expect(shouldEscalateDeficiency("2026-08-24", "2026-08-24")).toBe(true);
  });

  it("milczy w dniach pośrednich", () => {
    expect(shouldEscalateDeficiency("2026-08-24", "2026-08-26")).toBe(false);
    expect(shouldEscalateDeficiency("2026-08-24", "2026-09-10")).toBe(false);
  });

  it("przypomina CODZIENNIE po upływie terminu", () => {
    // Uchybienie terminowi ustawowemu nie może się rozmyć w tle.
    for (const dueDate of ["2026-08-23", "2026-08-20", "2026-07-01"]) {
      expect(shouldEscalateDeficiency("2026-08-24", dueDate), dueDate).toBe(true);
    }
  });
});

describe("buildDigest", () => {
  it("pusty przegląd jest oznaczony jako pusty", () => {
    const digest = buildDigest(input());
    expect(digest.isEmpty).toBe(true);
    expect(digest.sections).toEqual([]);
  });

  it("braki formalne po terminie oznacza jako pilne", () => {
    const digest = buildDigest(
      input({
        deficiencies: [
          { id: "1", title: "Uzupełnić opłatę od apelacji", caseNumber: "2026/005", dueDate: "2026-08-22" },
        ],
      }),
    );

    const section = digest.sections.find((s) => s.heading === "Braki formalne");
    expect(section).toBeDefined();
    expect(section!.urgent).toBe(true);
    expect(section!.lines[0]).toContain("PO TERMINIE od 2 dni");
    expect(digest.subject).toContain("wymaga uwagi");
  });

  it("brak formalny z terminem dzisiaj opisuje jednoznacznie", () => {
    const digest = buildDigest(
      input({
        deficiencies: [
          { id: "1", title: "Odpis pełnomocnictwa", caseNumber: "2026/001", dueDate: "2026-08-24" },
        ],
      }),
    );
    expect(digest.sections[0].lines[0]).toContain("termin DZISIAJ");
  });

  it("pomija braki z terminem poza horyzontem tygodnia", () => {
    const digest = buildDigest(
      input({
        deficiencies: [
          { id: "1", title: "Odległy brak", caseNumber: null, dueDate: "2026-10-01" },
        ],
      }),
    );
    expect(digest.isEmpty).toBe(true);
  });

  it("dzisiejsze terminy sortuje chronologicznie", () => {
    const digest = buildDigest(
      input({
        eventsToday: [
          {
            id: "2",
            title: "Rozprawa popołudniowa",
            startsAt: "2026-08-24T12:00:00Z",
            location: null,
            caseSignature: null,
          },
          {
            id: "1",
            title: "Rozprawa poranna",
            startsAt: "2026-08-24T07:00:00Z",
            location: "sala 214",
            caseSignature: "I C 1234/25",
          },
        ],
      }),
    );

    const section = digest.sections.find((s) => s.heading === "Dzisiejsze terminy")!;
    expect(section.lines[0]).toContain("Rozprawa poranna");
    expect(section.lines[0]).toContain("I C 1234/25");
    expect(section.lines[1]).toContain("Rozprawa popołudniowa");
    expect(section.urgent).toBe(true);
  });

  it("zadania po terminie stawia przed zadaniami na dziś", () => {
    const digest = buildDigest(
      input({
        tasksDue: [{ id: "2", title: "Zadanie na dziś", caseNumber: null, dueDate: "2026-08-24" }],
        tasksOverdue: [
          { id: "1", title: "Zadanie zaległe", caseNumber: "2026/003", dueDate: "2026-08-20" },
        ],
      }),
    );

    const section = digest.sections.find((s) => s.heading === "Zadania")!;
    expect(section.lines[0]).toContain("PO TERMINIE");
    expect(section.lines[1]).toContain("Na dziś");
    expect(section.urgent).toBe(true);
  });

  describe("sekcja rozliczeń", () => {
    const billing = { unbilledMinutes: 1_200, overdueInvoices: 2, overdueGrossGrosz: 1_230_000 };

    it("trafia do właściciela", () => {
      const digest = buildDigest(input({ role: "owner", billing }));
      expect(digest.sections.some((s) => s.heading === "Rozliczenia")).toBe(true);
    });

    it("trafia do partnera", () => {
      const digest = buildDigest(input({ role: "partner", billing }));
      expect(digest.sections.some((s) => s.heading === "Rozliczenia")).toBe(true);
    });

    it("NIE trafia do prawnika", () => {
      // Ta sama reguła co w interfejsie i w politykach RLS: dane finansowe
      // są zarezerwowane dla właściciela i partnerów.
      const digest = buildDigest(input({ role: "lawyer", billing }));
      expect(digest.sections.some((s) => s.heading === "Rozliczenia")).toBe(false);
    });

    it("NIE trafia do sekretariatu", () => {
      const digest = buildDigest(input({ role: "staff", billing }));
      expect(digest.sections.some((s) => s.heading === "Rozliczenia")).toBe(false);
    });
  });

  it("respektuje wyłączone sekcje w preferencjach", () => {
    const digest = buildDigest(
      input({
        preferences: { ...ALL_ON, includeDeficiencies: false },
        deficiencies: [
          { id: "1", title: "Brak formalny", caseNumber: "2026/001", dueDate: "2026-08-24" },
        ],
      }),
    );
    expect(digest.isEmpty).toBe(true);
  });

  it("zwraca się do adresata imieniem", () => {
    expect(buildDigest(input()).greeting).toBe("Dzień dobry, Bartosz.");
  });
});

describe("renderDigestText", () => {
  it("składa czytelną wiadomość z linkiem do systemu", () => {
    const digest = buildDigest(
      input({
        tasksOverdue: [{ id: "1", title: "Zaległe zadanie", caseNumber: null, dueDate: "2026-08-20" }],
      }),
    );
    const text = renderDigestText(digest, "https://kancelaria.example");

    expect(text).toContain("Dzień dobry, Bartosz.");
    expect(text).toContain("ZADANIA:");
    expect(text).toContain("• PO TERMINIE: Zaległe zadanie");
    expect(text).toContain("https://kancelaria.example");
    expect(text).toContain("automatycznie");
  });
});

describe("klucze idempotencji", () => {
  it("klucz przeglądu zależy wyłącznie od daty", () => {
    expect(digestEventKey("2026-08-24")).toBe("digest:2026-08-24");
    expect(digestEventKey("2026-08-24")).toBe(digestEventKey("2026-08-24"));
    expect(digestEventKey("2026-08-25")).not.toBe(digestEventKey("2026-08-24"));
  });

  it("klucz wysyłki rozróżnia kanał, odbiorcę i zdarzenie", () => {
    expect(dispatchKey("email", "u1", "digest:2026-08-24")).toBe("email:u1:digest:2026-08-24");
    expect(dispatchKey("push", "u1", "digest:2026-08-24")).not.toBe(
      dispatchKey("email", "u1", "digest:2026-08-24"),
    );
    expect(dispatchKey("email", "u2", "digest:2026-08-24")).not.toBe(
      dispatchKey("email", "u1", "digest:2026-08-24"),
    );
  });
});
