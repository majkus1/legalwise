/**
 * Logika rozliczeń: rozstrzyganie warunków, budowa projektu faktury
 * i zestawienia godzin dla klienta.
 *
 * Funkcje są czyste — nie sięgają do bazy — dzięki czemu dają się w całości
 * pokryć testami. Wyliczenia muszą dawać wynik identyczny z tym, co robią
 * triggery i funkcje w supabase/migrations (0005 i 0007).
 */

import { computeLineAmounts, sumLineAmounts, type LineAmounts } from "@/lib/money";
import { minutesToDecimalHours } from "@/lib/time";
import type { BillingModel } from "@/lib/domain";

// ---------------------------------------------------------------------------
// Rozstrzyganie warunków rozliczenia
// ---------------------------------------------------------------------------

/**
 * Model rozliczenia: ustawienie na sprawie ma pierwszeństwo przed domyślnym
 * ustawieniem klienta.
 */
export function resolveBillingModel(
  caseModel: BillingModel | null | undefined,
  clientDefault: BillingModel,
): BillingModel {
  return caseModel ?? clientDefault;
}

/**
 * Stawka godzinowa — łańcuch: sprawa → klient → standardowa stawka prawnika.
 *
 * Ten łańcuch obsługuje każdy wariant, jaki kancelaria może stosować (stawki
 * ustalane per sprawa, per klient albo per prawnik), bez zmiany schematu.
 * Brak którejkolwiek wartości oznacza 0 — wtedy pozycja i tak wymaga ręcznej
 * korekty przed zatwierdzeniem faktury.
 */
export function resolveHourlyRateGrosz(input: {
  caseRateGrosz?: number | null;
  clientRateGrosz?: number | null;
  memberRateGrosz?: number | null;
}): number {
  return input.caseRateGrosz ?? input.clientRateGrosz ?? input.memberRateGrosz ?? 0;
}

// ---------------------------------------------------------------------------
// Dane wejściowe
// ---------------------------------------------------------------------------

export interface BillableEntry {
  id: string;
  caseId: string;
  userId: string;
  /** Data w postaci „yyyy-MM-dd”. */
  workDate: string;
  minutes: number;
  description: string;
  billingType: BillingModel;
  /** Migawka stawki z chwili rejestracji wpisu. */
  rateSnapshotGrosz: number;
  billable: boolean;
}

export interface CaseBillingConfig {
  caseId: string;
  caseNumber: string;
  title: string;
  billingModel: BillingModel;
  flatFeeGrosz?: number | null;
  flatFeeIncludedMinutes?: number | null;
}

export interface DraftLine {
  caseId: string;
  description: string;
  /** Ilość — godziny dziesiętne albo 1 dla ryczałtu. */
  quantity: number;
  unit: string;
  unitPriceNetGrosz: number;
  vatRate: number;
  amounts: LineAmounts;
  /** Wpisy czasu, z których powstała pozycja — podstawa załącznika godzinowego. */
  entryIds: string[];
}

export interface OverageSegment {
  rateGrosz: number;
  minutes: number;
  entryIds: string[];
}

// ---------------------------------------------------------------------------
// Ryczałt z limitem godzin
// ---------------------------------------------------------------------------

function compareEntries(a: BillableEntry, b: BillableEntry): number {
  if (a.workDate !== b.workDate) return a.workDate < b.workDate ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Rozdziela czas między limit wliczony w ryczałt a nadwyżkę.
 *
 * Wpisy są brane chronologicznie: najwcześniejsze wypełniają limit, reszta
 * stanowi nadwyżkę. Nadwyżka jest grupowana według stawki z danego wpisu,
 * a nie według stawki uśrednionej — inaczej godzina partnera i godzina
 * aplikanta rozliczyłyby się po tej samej cenie.
 *
 * Wpis leżący na granicy limitu jest dzielony: część wchodzi w ryczałt,
 * reszta w nadwyżkę.
 */
export function allocateFlatFeeOverage(
  entries: readonly BillableEntry[],
  includedMinutes: number,
): { coveredMinutes: number; overage: OverageSegment[] } {
  const sorted = [...entries].filter((entry) => entry.billable).sort(compareEntries);

  let remainingAllowance = Math.max(0, includedMinutes);
  let coveredMinutes = 0;
  const byRate = new Map<number, { minutes: number; entryIds: string[] }>();

  for (const entry of sorted) {
    let minutesLeft = entry.minutes;

    if (remainingAllowance > 0) {
      const covered = Math.min(remainingAllowance, minutesLeft);
      remainingAllowance -= covered;
      coveredMinutes += covered;
      minutesLeft -= covered;
    }

    if (minutesLeft > 0) {
      const bucket = byRate.get(entry.rateSnapshotGrosz) ?? { minutes: 0, entryIds: [] };
      bucket.minutes += minutesLeft;
      bucket.entryIds.push(entry.id);
      byRate.set(entry.rateSnapshotGrosz, bucket);
    }
  }

  const overage = [...byRate.entries()]
    .map(([rateGrosz, bucket]) => ({
      rateGrosz,
      minutes: bucket.minutes,
      entryIds: bucket.entryIds,
    }))
    .sort((a, b) => b.rateGrosz - a.rateGrosz);

  return { coveredMinutes, overage };
}

// ---------------------------------------------------------------------------
// Projekt faktury
// ---------------------------------------------------------------------------

function groupHourlyByRate(
  entries: readonly BillableEntry[],
): Map<number, { minutes: number; entryIds: string[] }> {
  const byRate = new Map<number, { minutes: number; entryIds: string[] }>();
  for (const entry of entries) {
    if (!entry.billable) continue;
    const bucket = byRate.get(entry.rateSnapshotGrosz) ?? { minutes: 0, entryIds: [] };
    bucket.minutes += entry.minutes;
    bucket.entryIds.push(entry.id);
    byRate.set(entry.rateSnapshotGrosz, bucket);
  }
  return byRate;
}

function caseLabel(config: CaseBillingConfig): string {
  return `${config.caseNumber} — ${config.title}`;
}

/**
 * Buduje pozycje projektu faktury dla jednej sprawy.
 *
 * Czynności nieodpłatne nie tworzą żadnej pozycji, ale trafiają do
 * zestawienia godzin — klient widzi wtedy, ile pracy wykonano pro bono.
 */
export function buildCaseLines(
  config: CaseBillingConfig,
  entries: readonly BillableEntry[],
  vatRate: number,
): DraftLine[] {
  const caseEntries = entries.filter((entry) => entry.caseId === config.caseId);
  const lines: DraftLine[] = [];

  if (config.billingModel === "nieodplatny") {
    return lines;
  }

  if (config.billingModel === "ryczalt") {
    const flatFee = config.flatFeeGrosz ?? 0;

    if (flatFee > 0) {
      lines.push({
        caseId: config.caseId,
        description: `Ryczałt — ${caseLabel(config)}`,
        quantity: 1,
        unit: "ryczałt",
        unitPriceNetGrosz: flatFee,
        vatRate,
        amounts: computeLineAmounts(1, flatFee, vatRate),
        // Wpisy objęte ryczałtem nie tworzą osobnej pozycji, ale muszą zostać
        // powiązane z fakturą, żeby znalazły się w załączniku godzinowym
        // i zostały zablokowane przy zatwierdzeniu.
        entryIds: caseEntries.map((entry) => entry.id),
      });
    }

    const includedMinutes = config.flatFeeIncludedMinutes ?? 0;
    if (includedMinutes > 0) {
      const { overage } = allocateFlatFeeOverage(caseEntries, includedMinutes);
      for (const segment of overage) {
        if (segment.rateGrosz <= 0) continue;
        const hours = minutesToDecimalHours(segment.minutes);
        lines.push({
          caseId: config.caseId,
          description:
            `Pomoc prawna ponad limit ryczałtu — ${caseLabel(config)}`,
          quantity: hours,
          unit: "godz.",
          unitPriceNetGrosz: segment.rateGrosz,
          vatRate,
          amounts: computeLineAmounts(hours, segment.rateGrosz, vatRate),
          entryIds: segment.entryIds,
        });
      }
    }

    return lines;
  }

  // Rozliczenie godzinowe: osobna pozycja dla każdej stawki występującej
  // w okresie, żeby faktura pokazywała, po jakiej cenie liczono godziny.
  const byRate = groupHourlyByRate(caseEntries);
  const rates = [...byRate.keys()].sort((a, b) => b - a);
  const showRateInDescription = rates.length > 1;

  for (const rate of rates) {
    const bucket = byRate.get(rate)!;
    if (bucket.minutes <= 0) continue;
    const hours = minutesToDecimalHours(bucket.minutes);
    const suffix = showRateInDescription
      ? ` (stawka ${(rate / 100).toFixed(2).replace(".", ",")} zł/h)`
      : "";
    lines.push({
      caseId: config.caseId,
      description: `Pomoc prawna — ${caseLabel(config)}${suffix}`,
      quantity: hours,
      unit: "godz.",
      unitPriceNetGrosz: rate,
      vatRate,
      amounts: computeLineAmounts(hours, rate, vatRate),
      entryIds: bucket.entryIds,
    });
  }

  return lines;
}

export interface InvoiceDraft {
  lines: DraftLine[];
  totals: LineAmounts;
  /** Identyfikatory wszystkich wpisów powiązanych z fakturą. */
  linkedEntryIds: string[];
}

/**
 * Buduje kompletny projekt faktury dla klienta za okres — po jednej lub kilku
 * sprawach naraz. To jest operacja, która zastępuje ręczne przepisywanie
 * danych z arkusza kalkulacyjnego przy miesięcznym zamykaniu okresu.
 */
export function buildInvoiceDraft(input: {
  cases: readonly CaseBillingConfig[];
  entries: readonly BillableEntry[];
  vatRate: number;
}): InvoiceDraft {
  const lines = input.cases.flatMap((config) =>
    buildCaseLines(config, input.entries, input.vatRate),
  );

  const linkedEntryIds = [...new Set(lines.flatMap((line) => line.entryIds))];

  return {
    lines,
    totals: sumLineAmounts(lines.map((line) => line.amounts)),
    linkedEntryIds,
  };
}

// ---------------------------------------------------------------------------
// Zestawienie godzin dla klienta
// ---------------------------------------------------------------------------

export interface AnnexRow {
  workDate: string;
  caseNumber: string;
  caseTitle: string;
  lawyerName: string;
  description: string;
  minutes: number;
  hours: number;
  /** Kwota netto przypadająca na wpis; 0 dla ryczałtu i czynności nieodpłatnych. */
  amountNetGrosz: number;
  billingType: BillingModel;
}

export interface AnnexCaseGroup {
  caseId: string;
  caseNumber: string;
  caseTitle: string;
  rows: AnnexRow[];
  totalMinutes: number;
  billableMinutes: number;
  proBonoMinutes: number;
  totalNetGrosz: number;
}

/**
 * Zestawienie godzin — czytelny załącznik dla klienta, pogrupowany po sprawach.
 *
 * Czynności nieodpłatne są pokazywane z kwotą zero. To celowe: klient widzi
 * pełen nakład pracy, także ten, za który nie płaci.
 */
export function buildHourAnnex(input: {
  cases: readonly CaseBillingConfig[];
  entries: readonly BillableEntry[];
  lawyerNames: Readonly<Record<string, string>>;
}): AnnexCaseGroup[] {
  const groups: AnnexCaseGroup[] = [];

  for (const config of input.cases) {
    const caseEntries = input.entries
      .filter((entry) => entry.caseId === config.caseId)
      .sort(compareEntries);

    if (caseEntries.length === 0) continue;

    const rows: AnnexRow[] = caseEntries.map((entry) => {
      // Przy ryczałcie wartość jest w kwocie stałej na fakturze, a nie
      // w poszczególnych wpisach — pokazywanie tu kwot wprowadzałoby w błąd.
      const amountNetGrosz =
        entry.billingType === "godzinowy" && entry.billable
          ? computeLineAmounts(minutesToDecimalHours(entry.minutes), entry.rateSnapshotGrosz, 0)
              .netGrosz
          : 0;

      return {
        workDate: entry.workDate,
        caseNumber: config.caseNumber,
        caseTitle: config.title,
        lawyerName: input.lawyerNames[entry.userId] ?? "—",
        description: entry.description,
        minutes: entry.minutes,
        hours: minutesToDecimalHours(entry.minutes),
        amountNetGrosz,
        billingType: entry.billingType,
      };
    });

    groups.push({
      caseId: config.caseId,
      caseNumber: config.caseNumber,
      caseTitle: config.title,
      rows,
      totalMinutes: rows.reduce((sum, row) => sum + row.minutes, 0),
      billableMinutes: caseEntries
        .filter((entry) => entry.billable)
        .reduce((sum, entry) => sum + entry.minutes, 0),
      proBonoMinutes: caseEntries
        .filter((entry) => entry.billingType === "nieodplatny")
        .reduce((sum, entry) => sum + entry.minutes, 0),
      totalNetGrosz: rows.reduce((sum, row) => sum + row.amountNetGrosz, 0),
    });
  }

  return groups;
}

// ---------------------------------------------------------------------------
// Rentowność
// ---------------------------------------------------------------------------

export interface ProfitabilityRow {
  userId: string;
  lawyerName: string;
  /** Cały zarejestrowany czas. */
  workedMinutes: number;
  /** Czas podlegający fakturowaniu. */
  billableMinutes: number;
  /** Czas faktycznie ujęty na zatwierdzonej fakturze. */
  billedMinutes: number;
  proBonoMinutes: number;
  billedNetGrosz: number;
  /** Udział godzin zafakturowanych w przepracowanych, 0–1. */
  realizationRate: number;
}

/**
 * Rentowność prawnika: godziny przepracowane wobec zafakturowanych.
 *
 * `billedMinutes` liczy wyłącznie czas powiązany z fakturą, bo dopiero
 * to odróżnia pracę wykonaną od pracy rozliczonej — o to pyta klient
 * w opisie wymagań.
 */
export function buildProfitability(input: {
  entries: readonly (BillableEntry & { invoiceId?: string | null })[];
  lawyerNames: Readonly<Record<string, string>>;
}): ProfitabilityRow[] {
  const byUser = new Map<string, ProfitabilityRow>();

  for (const entry of input.entries) {
    const row =
      byUser.get(entry.userId) ??
      ({
        userId: entry.userId,
        lawyerName: input.lawyerNames[entry.userId] ?? "—",
        workedMinutes: 0,
        billableMinutes: 0,
        billedMinutes: 0,
        proBonoMinutes: 0,
        billedNetGrosz: 0,
        realizationRate: 0,
      } satisfies ProfitabilityRow);

    row.workedMinutes += entry.minutes;
    if (entry.billable) row.billableMinutes += entry.minutes;
    if (entry.billingType === "nieodplatny") row.proBonoMinutes += entry.minutes;

    if (entry.invoiceId) {
      row.billedMinutes += entry.minutes;
      if (entry.billingType === "godzinowy") {
        row.billedNetGrosz += computeLineAmounts(
          minutesToDecimalHours(entry.minutes),
          entry.rateSnapshotGrosz,
          0,
        ).netGrosz;
      }
    }

    byUser.set(entry.userId, row);
  }

  return [...byUser.values()]
    .map((row) => ({
      ...row,
      realizationRate: row.workedMinutes > 0 ? row.billedMinutes / row.workedMinutes : 0,
    }))
    .sort((a, b) => b.workedMinutes - a.workedMinutes);
}
