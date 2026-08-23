import { describe, expect, it } from "vitest";
import {
  allocateFlatFeeOverage,
  buildCaseLines,
  buildHourAnnex,
  buildInvoiceDraft,
  buildProfitability,
  resolveBillingModel,
  resolveHourlyRateGrosz,
  type BillableEntry,
  type CaseBillingConfig,
} from "@/lib/billing";

const PARTNER = "user-partner";
const ASSOCIATE = "user-associate";

const RATE_PARTNER = 45_000; // 450,00 zł/h
const RATE_ASSOCIATE = 38_000; // 380,00 zł/h

function entry(overrides: Partial<BillableEntry> & Pick<BillableEntry, "id" | "minutes">): BillableEntry {
  return {
    caseId: "case-1",
    userId: PARTNER,
    workDate: "2026-08-03",
    description: "Analiza akt",
    billingType: "godzinowy",
    rateSnapshotGrosz: RATE_PARTNER,
    billable: true,
    ...overrides,
  };
}

const hourlyCase: CaseBillingConfig = {
  caseId: "case-1",
  caseNumber: "2026/014",
  title: "Kowalski przeciwko Nowak",
  billingModel: "godzinowy",
};

// ---------------------------------------------------------------------------

describe("resolveBillingModel", () => {
  it("ustawienie na sprawie ma pierwszeństwo przed domyślnym klienta", () => {
    expect(resolveBillingModel("ryczalt", "godzinowy")).toBe("ryczalt");
  });

  it("bez ustawienia na sprawie bierze domyślne klienta", () => {
    expect(resolveBillingModel(null, "godzinowy")).toBe("godzinowy");
    expect(resolveBillingModel(undefined, "ryczalt")).toBe("ryczalt");
  });
});

describe("resolveHourlyRateGrosz", () => {
  it("stawka ze sprawy wygrywa z pozostałymi", () => {
    expect(
      resolveHourlyRateGrosz({
        caseRateGrosz: 50_000,
        clientRateGrosz: 45_000,
        memberRateGrosz: 40_000,
      }),
    ).toBe(50_000);
  });

  it("bez stawki na sprawie schodzi do stawki klienta", () => {
    expect(
      resolveHourlyRateGrosz({ caseRateGrosz: null, clientRateGrosz: 45_000, memberRateGrosz: 40_000 }),
    ).toBe(45_000);
  });

  it("bez stawki klienta schodzi do standardowej stawki prawnika", () => {
    expect(
      resolveHourlyRateGrosz({ caseRateGrosz: null, clientRateGrosz: null, memberRateGrosz: 40_000 }),
    ).toBe(40_000);
  });

  it("brak jakiejkolwiek stawki daje zero, a nie wyjątek", () => {
    expect(resolveHourlyRateGrosz({})).toBe(0);
  });

  it("stawka zero na sprawie jest wartością, a nie brakiem wartości", () => {
    // Sprawa rozliczana wyjątkowo bez wynagrodzenia nie powinna dziedziczyć
    // stawki klienta tylko dlatego, że zapisano w niej 0.
    expect(resolveHourlyRateGrosz({ caseRateGrosz: 0, clientRateGrosz: 45_000 })).toBe(0);
  });
});

// ---------------------------------------------------------------------------

describe("allocateFlatFeeOverage", () => {
  it("nie tworzy nadwyżki, gdy czas mieści się w limicie", () => {
    const result = allocateFlatFeeOverage(
      [entry({ id: "e1", minutes: 300 }), entry({ id: "e2", minutes: 120 })],
      600,
    );
    expect(result.coveredMinutes).toBe(420);
    expect(result.overage).toEqual([]);
  });

  it("nie tworzy nadwyżki przy dokładnym wykorzystaniu limitu", () => {
    const result = allocateFlatFeeOverage([entry({ id: "e1", minutes: 600 })], 600);
    expect(result.coveredMinutes).toBe(600);
    expect(result.overage).toEqual([]);
  });

  it("dzieli wpis leżący na granicy limitu", () => {
    // 300 + 240 wypełnia 540 z 600; z trzeciego wpisu 60 minut wchodzi
    // w ryczałt, a pozostałe 120 stanowi nadwyżkę.
    const result = allocateFlatFeeOverage(
      [
        entry({ id: "e1", minutes: 300, workDate: "2026-08-03" }),
        entry({ id: "e2", minutes: 240, workDate: "2026-08-05" }),
        entry({
          id: "e3",
          minutes: 180,
          workDate: "2026-08-10",
          userId: ASSOCIATE,
          rateSnapshotGrosz: RATE_ASSOCIATE,
        }),
      ],
      600,
    );
    expect(result.coveredMinutes).toBe(600);
    expect(result.overage).toEqual([
      { rateGrosz: RATE_ASSOCIATE, minutes: 120, entryIds: ["e3"] },
    ]);
  });

  it("grupuje nadwyżkę według stawki, a nie po stawce uśrednionej", () => {
    // Godzina partnera i godzina aplikanta nie mogą rozliczyć się po tej samej cenie.
    const result = allocateFlatFeeOverage(
      [
        entry({ id: "e1", minutes: 120, workDate: "2026-08-03" }),
        entry({
          id: "e2",
          minutes: 120,
          workDate: "2026-08-04",
          userId: ASSOCIATE,
          rateSnapshotGrosz: RATE_ASSOCIATE,
        }),
      ],
      0,
    );
    expect(result.coveredMinutes).toBe(0);
    expect(result.overage).toEqual([
      { rateGrosz: RATE_PARTNER, minutes: 120, entryIds: ["e1"] },
      { rateGrosz: RATE_ASSOCIATE, minutes: 120, entryIds: ["e2"] },
    ]);
  });

  it("wypełnia limit chronologicznie, niezależnie od kolejności na wejściu", () => {
    const result = allocateFlatFeeOverage(
      [
        entry({ id: "e-late", minutes: 120, workDate: "2026-08-20", rateSnapshotGrosz: RATE_ASSOCIATE }),
        entry({ id: "e-early", minutes: 120, workDate: "2026-08-01" }),
      ],
      120,
    );
    // Limit pochłania wcześniejszy wpis; nadwyżką jest ten późniejszy.
    expect(result.overage).toEqual([
      { rateGrosz: RATE_ASSOCIATE, minutes: 120, entryIds: ["e-late"] },
    ]);
  });

  it("pomija wpisy niepodlegające fakturowaniu", () => {
    const result = allocateFlatFeeOverage(
      [
        entry({ id: "e1", minutes: 300 }),
        entry({ id: "e2", minutes: 300, billingType: "nieodplatny", billable: false }),
      ],
      120,
    );
    expect(result.coveredMinutes).toBe(120);
    expect(result.overage).toEqual([{ rateGrosz: RATE_PARTNER, minutes: 180, entryIds: ["e1"] }]);
  });
});

// ---------------------------------------------------------------------------

describe("buildCaseLines — rozliczenie godzinowe", () => {
  const entries = [
    entry({ id: "e1", minutes: 120, workDate: "2026-08-03" }),
    entry({ id: "e2", minutes: 90, workDate: "2026-08-05" }),
    entry({
      id: "e3",
      minutes: 60,
      workDate: "2026-08-10",
      userId: ASSOCIATE,
      rateSnapshotGrosz: RATE_ASSOCIATE,
    }),
  ];

  it("tworzy osobną pozycję dla każdej stawki występującej w okresie", () => {
    const lines = buildCaseLines(hourlyCase, entries, 23);
    expect(lines).toHaveLength(2);

    // 120 + 90 = 210 min = 3,5 h po 450,00 zł
    expect(lines[0].quantity).toBe(3.5);
    expect(lines[0].unitPriceNetGrosz).toBe(RATE_PARTNER);
    expect(lines[0].amounts.netGrosz).toBe(157_500);
    expect(lines[0].entryIds).toEqual(["e1", "e2"]);

    // 60 min = 1 h po 380,00 zł
    expect(lines[1].quantity).toBe(1);
    expect(lines[1].unitPriceNetGrosz).toBe(RATE_ASSOCIATE);
    expect(lines[1].amounts.netGrosz).toBe(38_000);
  });

  it("dopisuje stawkę do opisu, gdy w okresie występuje więcej niż jedna", () => {
    const lines = buildCaseLines(hourlyCase, entries, 23);
    expect(lines[0].description).toContain("450,00 zł/h");
    expect(lines[1].description).toContain("380,00 zł/h");
  });

  it("nie zaśmieca opisu stawką, gdy jest tylko jedna", () => {
    const lines = buildCaseLines(hourlyCase, [entry({ id: "e1", minutes: 120 })], 23);
    expect(lines).toHaveLength(1);
    expect(lines[0].description).toBe("Pomoc prawna — 2026/014 — Kowalski przeciwko Nowak");
  });

  it("pomija wpisy z innych spraw", () => {
    const lines = buildCaseLines(
      hourlyCase,
      [...entries, entry({ id: "obca", minutes: 600, caseId: "case-inna" })],
      23,
    );
    expect(lines.flatMap((line) => line.entryIds)).not.toContain("obca");
  });

  it("pomija czynności nieodpłatne", () => {
    const lines = buildCaseLines(
      hourlyCase,
      [
        entry({ id: "e1", minutes: 120 }),
        entry({ id: "pro-bono", minutes: 240, billingType: "nieodplatny", billable: false }),
      ],
      23,
    );
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(2);
  });
});

describe("buildCaseLines — ryczałt", () => {
  const flatCase: CaseBillingConfig = {
    caseId: "case-1",
    caseNumber: "2026/002",
    title: "Obsługa korporacyjna Acme",
    billingModel: "ryczalt",
    flatFeeGrosz: 500_000, // 5 000,00 zł
    flatFeeIncludedMinutes: 600, // 10 h
  };

  it("wystawia samą kwotę ryczałtu, gdy limit nie został przekroczony", () => {
    const lines = buildCaseLines(flatCase, [entry({ id: "e1", minutes: 300 })], 23);
    expect(lines).toHaveLength(1);
    expect(lines[0].unit).toBe("ryczałt");
    expect(lines[0].quantity).toBe(1);
    expect(lines[0].amounts.netGrosz).toBe(500_000);
    expect(lines[0].amounts.vatGrosz).toBe(115_000);
  });

  it("dolicza nadwyżkę ponad limit jako osobną pozycję godzinową", () => {
    const lines = buildCaseLines(
      flatCase,
      [
        entry({ id: "e1", minutes: 300, workDate: "2026-08-03" }),
        entry({ id: "e2", minutes: 240, workDate: "2026-08-05" }),
        entry({
          id: "e3",
          minutes: 180,
          workDate: "2026-08-10",
          userId: ASSOCIATE,
          rateSnapshotGrosz: RATE_ASSOCIATE,
        }),
      ],
      23,
    );

    expect(lines).toHaveLength(2);
    expect(lines[0].amounts.netGrosz).toBe(500_000);

    // 120 minut nadwyżki po stawce aplikanta = 2 h × 380,00 zł
    expect(lines[1].quantity).toBe(2);
    expect(lines[1].unitPriceNetGrosz).toBe(RATE_ASSOCIATE);
    expect(lines[1].amounts.netGrosz).toBe(76_000);
    expect(lines[1].description).toContain("ponad limit");
  });

  it("wiąże z fakturą wszystkie wpisy sprawy, także objęte ryczałtem", () => {
    // Wpisy objęte ryczałtem nie tworzą pozycji, ale muszą trafić do
    // załącznika godzinowego i zostać zablokowane przy zatwierdzeniu.
    const lines = buildCaseLines(
      flatCase,
      [entry({ id: "e1", minutes: 300 }), entry({ id: "e2", minutes: 120 })],
      23,
    );
    expect(lines[0].entryIds).toEqual(["e1", "e2"]);
  });

  it("ryczałt bez limitu godzin nigdy nie tworzy nadwyżki", () => {
    const lines = buildCaseLines(
      { ...flatCase, flatFeeIncludedMinutes: null },
      [entry({ id: "e1", minutes: 3000 })],
      23,
    );
    expect(lines).toHaveLength(1);
  });
});

describe("buildCaseLines — czynności nieodpłatne", () => {
  it("sprawa prowadzona pro bono nie generuje żadnej pozycji", () => {
    const lines = buildCaseLines(
      { caseId: "case-1", caseNumber: "2026/030", title: "Pro bono", billingModel: "nieodplatny" },
      [entry({ id: "e1", minutes: 480, billingType: "nieodplatny", billable: false })],
      23,
    );
    expect(lines).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

describe("buildInvoiceDraft", () => {
  it("łączy kilka spraw jednego klienta w jeden projekt faktury", () => {
    const draft = buildInvoiceDraft({
      cases: [
        hourlyCase,
        {
          caseId: "case-2",
          caseNumber: "2026/021",
          title: "Opinia podatkowa",
          billingModel: "godzinowy",
        },
      ],
      entries: [
        entry({ id: "e1", minutes: 120, caseId: "case-1" }),
        entry({ id: "e2", minutes: 60, caseId: "case-2" }),
      ],
      vatRate: 23,
    });

    expect(draft.lines).toHaveLength(2);
    expect(draft.totals.netGrosz).toBe(90_000 + 45_000);
    expect(draft.totals.grossGrosz).toBe(draft.totals.netGrosz + draft.totals.vatGrosz);
    expect(draft.linkedEntryIds).toEqual(["e1", "e2"]);
  });

  it("suma projektu jest sumą pozycji", () => {
    const draft = buildInvoiceDraft({
      cases: [hourlyCase],
      entries: [
        entry({ id: "e1", minutes: 50 }),
        entry({ id: "e2", minutes: 70, userId: ASSOCIATE, rateSnapshotGrosz: RATE_ASSOCIATE }),
      ],
      vatRate: 23,
    });
    const manual = draft.lines.reduce((sum, line) => sum + line.amounts.grossGrosz, 0);
    expect(draft.totals.grossGrosz).toBe(manual);
  });

  it("nie duplikuje identyfikatorów wpisów", () => {
    const draft = buildInvoiceDraft({
      cases: [hourlyCase],
      entries: [entry({ id: "e1", minutes: 60 }), entry({ id: "e2", minutes: 60 })],
      vatRate: 23,
    });
    expect(new Set(draft.linkedEntryIds).size).toBe(draft.linkedEntryIds.length);
  });

  it("brak wpisów daje pusty projekt, a nie błąd", () => {
    const draft = buildInvoiceDraft({ cases: [hourlyCase], entries: [], vatRate: 23 });
    expect(draft.lines).toEqual([]);
    expect(draft.totals).toEqual({ netGrosz: 0, vatGrosz: 0, grossGrosz: 0 });
  });
});

// ---------------------------------------------------------------------------

describe("buildHourAnnex", () => {
  const names = { [PARTNER]: "Bartosz Śliwiński", [ASSOCIATE]: "Anna Kucharska" };

  it("grupuje wpisy po sprawach i sortuje chronologicznie", () => {
    const groups = buildHourAnnex({
      cases: [hourlyCase],
      entries: [
        entry({ id: "e2", minutes: 60, workDate: "2026-08-10" }),
        entry({ id: "e1", minutes: 120, workDate: "2026-08-03" }),
      ],
      lawyerNames: names,
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].rows.map((row) => row.workDate)).toEqual(["2026-08-03", "2026-08-10"]);
    expect(groups[0].totalMinutes).toBe(180);
  });

  it("pokazuje czynności nieodpłatne z kwotą zero", () => {
    // Klient ma zobaczyć pełen nakład pracy, także ten, za który nie płaci.
    const groups = buildHourAnnex({
      cases: [hourlyCase],
      entries: [
        entry({ id: "e1", minutes: 120 }),
        entry({ id: "e2", minutes: 60, billingType: "nieodplatny", billable: false }),
      ],
      lawyerNames: names,
    });

    expect(groups[0].rows[1].amountNetGrosz).toBe(0);
    expect(groups[0].proBonoMinutes).toBe(60);
    expect(groups[0].billableMinutes).toBe(120);
    expect(groups[0].totalMinutes).toBe(180);
  });

  it("przy ryczałcie nie przypisuje kwot do poszczególnych wpisów", () => {
    // Wartość jest w kwocie stałej na fakturze; kwoty przy wpisach
    // wprowadzałyby klienta w błąd co do podstawy rozliczenia.
    const groups = buildHourAnnex({
      cases: [{ ...hourlyCase, billingModel: "ryczalt", flatFeeGrosz: 500_000 }],
      entries: [entry({ id: "e1", minutes: 120, billingType: "ryczalt" })],
      lawyerNames: names,
    });
    expect(groups[0].rows[0].amountNetGrosz).toBe(0);
  });

  it("podpisuje wpisy nazwiskiem prawnika", () => {
    const groups = buildHourAnnex({
      cases: [hourlyCase],
      entries: [entry({ id: "e1", minutes: 60, userId: ASSOCIATE })],
      lawyerNames: names,
    });
    expect(groups[0].rows[0].lawyerName).toBe("Anna Kucharska");
  });

  it("pomija sprawy bez wpisów w okresie", () => {
    const groups = buildHourAnnex({
      cases: [hourlyCase, { caseId: "pusta", caseNumber: "2026/099", title: "Bez czynności", billingModel: "godzinowy" }],
      entries: [entry({ id: "e1", minutes: 60 })],
      lawyerNames: names,
    });
    expect(groups).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------

describe("buildProfitability", () => {
  const names = { [PARTNER]: "Bartosz Śliwiński", [ASSOCIATE]: "Anna Kucharska" };

  it("odróżnia godziny przepracowane od zafakturowanych", () => {
    const rows = buildProfitability({
      entries: [
        { ...entry({ id: "e1", minutes: 120 }), invoiceId: "inv-1" },
        { ...entry({ id: "e2", minutes: 60 }), invoiceId: null },
      ],
      lawyerNames: names,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].workedMinutes).toBe(180);
    expect(rows[0].billedMinutes).toBe(120);
    expect(rows[0].billedNetGrosz).toBe(90_000);
    expect(rows[0].realizationRate).toBeCloseTo(120 / 180, 5);
  });

  it("wykazuje czas pro bono osobno i nie wlicza go do fakturowanego", () => {
    const rows = buildProfitability({
      entries: [
        { ...entry({ id: "e1", minutes: 120 }), invoiceId: "inv-1" },
        {
          ...entry({ id: "e2", minutes: 240, billingType: "nieodplatny", billable: false }),
          invoiceId: null,
        },
      ],
      lawyerNames: names,
    });

    expect(rows[0].proBonoMinutes).toBe(240);
    expect(rows[0].billableMinutes).toBe(120);
    expect(rows[0].workedMinutes).toBe(360);
  });

  it("rozdziela wyniki na poszczególnych prawników", () => {
    const rows = buildProfitability({
      entries: [
        { ...entry({ id: "e1", minutes: 300 }), invoiceId: "inv-1" },
        {
          ...entry({ id: "e2", minutes: 120, userId: ASSOCIATE, rateSnapshotGrosz: RATE_ASSOCIATE }),
          invoiceId: null,
        },
      ],
      lawyerNames: names,
    });

    expect(rows).toHaveLength(2);
    // Sortowanie malejąco po czasie przepracowanym.
    expect(rows[0].userId).toBe(PARTNER);
    expect(rows[1].lawyerName).toBe("Anna Kucharska");
    expect(rows[1].realizationRate).toBe(0);
  });

  it("nie dzieli przez zero przy braku zarejestrowanego czasu", () => {
    const rows = buildProfitability({ entries: [], lawyerNames: names });
    expect(rows).toEqual([]);
  });
});
