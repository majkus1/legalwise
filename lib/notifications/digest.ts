/**
 * Budowa treści porannego przeglądu.
 *
 * Funkcje czyste — bez bazy i bez zegara — dzięki czemu dają się w całości
 * pokryć testami. To istotne: wiadomość wychodzi automatycznie, więc błąd
 * w doborze treści zauważyłby dopiero adresat.
 */

import { formatDate, formatMinutesAsHours } from "@/lib/time";
import { formatGrosz } from "@/lib/money";
import type { OrgRole } from "@/lib/domain";

export interface DigestDeficiency {
  id: string;
  title: string;
  caseNumber: string | null;
  dueDate: string;
}

export interface DigestEvent {
  id: string;
  title: string;
  startsAt: string;
  location: string | null;
  caseSignature: string | null;
}

export interface DigestTask {
  id: string;
  title: string;
  caseNumber: string | null;
  dueDate: string | null;
}

export interface DigestBilling {
  unbilledMinutes: number;
  overdueInvoices: number;
  overdueGrossGrosz: number;
}

export interface DigestPreferences {
  digestEnabled: boolean;
  includeDeadlines: boolean;
  includeDeficiencies: boolean;
  includeTasks: boolean;
  includeBilling: boolean;
}

export interface DigestInput {
  displayName: string;
  role: OrgRole;
  today: string;
  preferences: DigestPreferences;
  /** Braki formalne: po terminie lub z terminem w ciągu najbliższych dni. */
  deficiencies: DigestDeficiency[];
  /** Rozprawy i terminy procesowe na dziś. */
  eventsToday: DigestEvent[];
  /** Zadania na dziś i po terminie. */
  tasksDue: DigestTask[];
  tasksOverdue: DigestTask[];
  billing: DigestBilling | null;
}

export interface DigestSection {
  heading: string;
  lines: string[];
  /** Sekcja wymagająca reakcji — wyróżniana w wiadomości. */
  urgent: boolean;
}

export interface Digest {
  subject: string;
  greeting: string;
  sections: DigestSection[];
  /** Czy jest cokolwiek do powiedzenia. Pusty przegląd nie jest wysyłany. */
  isEmpty: boolean;
}

/** Ile dni naprzód pokazujemy braki formalne w porannym przeglądzie. */
export const DEFICIENCY_HORIZON_DAYS = 7;

/** Progi eskalacji przypomnień o braku formalnym, w dniach do terminu. */
export const DEFICIENCY_ESCALATION_DAYS = [3, 1, 0] as const;

/** Różnica dni między dwiema datami w zapisie yyyy-MM-dd. */
export function daysBetween(from: string, to: string): number {
  const a = Date.UTC(
    Number(from.slice(0, 4)),
    Number(from.slice(5, 7)) - 1,
    Number(from.slice(8, 10)),
  );
  const b = Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, Number(to.slice(8, 10)));
  return Math.round((b - a) / 86_400_000);
}

/**
 * Czy braki formalne o tym terminie zasługują dziś na osobne powiadomienie.
 *
 * Eskalujemy na trzy dni przed, dzień przed i w dniu terminu, a potem
 * codziennie po jego upływie — uchybienie terminowi ustawowemu ma dla
 * pełnomocnika konsekwencje zawodowe i nie może się rozmyć w tle.
 */
export function shouldEscalateDeficiency(today: string, dueDate: string): boolean {
  const remaining = daysBetween(today, dueDate);
  if (remaining < 0) return true;
  return (DEFICIENCY_ESCALATION_DAYS as readonly number[]).includes(remaining);
}

function describeDeficiency(today: string, item: DigestDeficiency): string {
  const remaining = daysBetween(today, item.dueDate);
  const when =
    remaining < 0
      ? `PO TERMINIE od ${Math.abs(remaining)} ${Math.abs(remaining) === 1 ? "dnia" : "dni"}`
      : remaining === 0
        ? "termin DZISIAJ"
        : `termin za ${remaining} ${remaining === 1 ? "dzień" : "dni"} (${formatDate(item.dueDate)})`;

  return `${item.caseNumber ? `${item.caseNumber} — ` : ""}${item.title} — ${when}`;
}

function formatTime(isoTimestamp: string): string {
  return new Intl.DateTimeFormat("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Warsaw",
  }).format(new Date(isoTimestamp));
}

/**
 * Składa poranny przegląd dopasowany do roli i preferencji.
 *
 * Sekcje finansowe trafiają wyłącznie do osób z wglądem w finanse —
 * ta sama reguła co w interfejsie i w politykach RLS.
 */
export function buildDigest(input: DigestInput): Digest {
  const sections: DigestSection[] = [];
  const canSeeFinances = input.role === "owner" || input.role === "partner";

  if (input.preferences.includeDeficiencies && input.deficiencies.length > 0) {
    const relevant = input.deficiencies
      .filter((item) => daysBetween(input.today, item.dueDate) <= DEFICIENCY_HORIZON_DAYS)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    if (relevant.length > 0) {
      sections.push({
        heading: "Braki formalne",
        lines: relevant.map((item) => describeDeficiency(input.today, item)),
        urgent: relevant.some((item) => daysBetween(input.today, item.dueDate) <= 1),
      });
    }
  }

  if (input.preferences.includeDeadlines && input.eventsToday.length > 0) {
    sections.push({
      heading: "Dzisiejsze terminy",
      lines: input.eventsToday
        .slice()
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
        .map((event) =>
          [
            formatTime(event.startsAt),
            event.title,
            event.caseSignature,
            event.location,
          ]
            .filter(Boolean)
            .join(" · "),
        ),
      urgent: true,
    });
  }

  if (input.preferences.includeTasks) {
    const lines: string[] = [];

    for (const task of input.tasksOverdue) {
      lines.push(
        `PO TERMINIE: ${task.caseNumber ? `${task.caseNumber} — ` : ""}${task.title}${
          task.dueDate ? ` (${formatDate(task.dueDate)})` : ""
        }`,
      );
    }
    for (const task of input.tasksDue) {
      lines.push(`Na dziś: ${task.caseNumber ? `${task.caseNumber} — ` : ""}${task.title}`);
    }

    if (lines.length > 0) {
      sections.push({
        heading: "Zadania",
        lines,
        urgent: input.tasksOverdue.length > 0,
      });
    }
  }

  if (input.preferences.includeBilling && canSeeFinances && input.billing) {
    const lines: string[] = [];

    if (input.billing.unbilledMinutes > 0) {
      lines.push(
        `Godziny czekające na zafakturowanie: ${formatMinutesAsHours(input.billing.unbilledMinutes)}`,
      );
    }
    if (input.billing.overdueInvoices > 0) {
      lines.push(
        `Faktury po terminie płatności: ${input.billing.overdueInvoices} na kwotę ${formatGrosz(
          input.billing.overdueGrossGrosz,
        )}`,
      );
    }

    if (lines.length > 0) {
      sections.push({ heading: "Rozliczenia", lines, urgent: false });
    }
  }

  const urgentCount = sections.filter((section) => section.urgent).length;
  const subject =
    urgentCount > 0
      ? `Legal-Wise — przegląd na ${formatDate(input.today)} (wymaga uwagi)`
      : `Legal-Wise — przegląd na ${formatDate(input.today)}`;

  return {
    subject,
    greeting: `Dzień dobry, ${input.displayName.split(" ")[0]}.`,
    sections,
    isEmpty: sections.length === 0,
  };
}

/** Treść tekstowa wiadomości. */
export function renderDigestText(digest: Digest, appUrl: string): string {
  const parts = [digest.greeting, ""];

  for (const section of digest.sections) {
    parts.push(section.urgent ? `${section.heading.toUpperCase()}:` : `${section.heading}:`);
    for (const line of section.lines) parts.push(`  • ${line}`);
    parts.push("");
  }

  parts.push(`Szczegóły w systemie: ${appUrl}`);
  parts.push("");
  parts.push("Wiadomość wygenerowana automatycznie przez system kancelarii.");
  parts.push("Ustawienia powiadomień znajdziesz w profilu użytkownika.");

  return parts.join("\n");
}

/**
 * Klucz zdarzenia dla porannego przeglądu.
 *
 * Zapewnia idempotencję: cron uruchomiony dwa razy tego samego dnia
 * nie wyśle dwóch takich samych wiadomości.
 */
export function digestEventKey(date: string): string {
  return `digest:${date}`;
}

/** Klucz deduplikacji jednej wysyłki w konkretnym kanale. */
export function dispatchKey(channel: string, userId: string, eventKey: string): string {
  return `${channel}:${userId}:${eventKey}`;
}
