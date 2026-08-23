/**
 * Typy domenowe odpowiadające typom wyliczeniowym w bazie.
 * Wartości muszą pozostać zgodne z migracjami w supabase/migrations.
 */

export const ORG_ROLES = ["owner", "partner", "lawyer", "staff"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  owner: "Właściciel",
  partner: "Partner",
  lawyer: "Prawnik",
  staff: "Sekretariat",
};

export const ORG_ROLE_DESCRIPTIONS: Record<OrgRole, string> = {
  owner: "Pełny dostęp, zarządzanie zespołem i danymi kancelarii",
  partner: "Wgląd we wszystkie sprawy, finanse i rentowność zespołu",
  lawyer: "Sprawy prowadzone i przypisane, własna ewidencja czasu",
  staff: "Kalendarz, zadania i kartoteka; bez dostępu do finansów",
};

/** Role z wglądem w finanse: faktury, stawki, rentowność całego zespołu. */
export const FINANCE_ROLES: readonly OrgRole[] = ["owner", "partner"];

export function canSeeFinances(role: OrgRole | null | undefined): boolean {
  return role != null && FINANCE_ROLES.includes(role);
}

export function canManageOrganization(role: OrgRole | null | undefined): boolean {
  return role === "owner";
}

export const BILLING_MODELS = ["godzinowy", "ryczalt", "nieodplatny"] as const;
export type BillingModel = (typeof BILLING_MODELS)[number];

export const BILLING_MODEL_LABELS: Record<BillingModel, string> = {
  godzinowy: "Stawka godzinowa",
  ryczalt: "Ryczałt",
  nieodplatny: "Nieodpłatnie / pro bono",
};

export const CLIENT_TYPES = ["osoba_fizyczna", "firma"] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];

export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  osoba_fizyczna: "Osoba fizyczna",
  firma: "Firma",
};

export const CASE_TYPES = [
  "spor_sadowy",
  "spor_pozasadowy",
  "opinia",
  "umowa",
  "obsluga_korporacyjna",
  "inna",
] as const;
export type CaseType = (typeof CASE_TYPES)[number];

export const CASE_TYPE_LABELS: Record<CaseType, string> = {
  spor_sadowy: "Spór sądowy",
  spor_pozasadowy: "Spór pozasądowy",
  opinia: "Opinia",
  umowa: "Umowa",
  obsluga_korporacyjna: "Obsługa korporacyjna",
  inna: "Inna",
};

/** Typy spraw, przy których metryka sądowa (sygnatura, sąd) ma sens. */
export const LITIGATION_CASE_TYPES: readonly CaseType[] = ["spor_sadowy", "spor_pozasadowy"];

export const CASE_STATUSES = ["aktywna", "zawieszona", "zakonczona"] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  aktywna: "Aktywna",
  zawieszona: "Zawieszona",
  zakonczona: "Zakończona",
};

export const PARTY_ROLES = [
  "powod",
  "pozwany",
  "uczestnik",
  "pelnomocnik_drugiej_strony",
  "inny",
] as const;
export type PartyRole = (typeof PARTY_ROLES)[number];

export const PARTY_ROLE_LABELS: Record<PartyRole, string> = {
  powod: "Powód",
  pozwany: "Pozwany",
  uczestnik: "Uczestnik",
  pelnomocnik_drugiej_strony: "Pełnomocnik drugiej strony",
  inny: "Inny",
};

export const TASK_STATUSES = ["do_zrobienia", "w_toku", "zrobione", "anulowane"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  do_zrobienia: "Do zrobienia",
  w_toku: "W toku",
  zrobione: "Zrobione",
  anulowane: "Anulowane",
};

export const TASK_PRIORITIES = ["niski", "normalny", "wysoki", "pilny"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  niski: "Niski",
  normalny: "Normalny",
  wysoki: "Wysoki",
  pilny: "Pilny",
};

export const TASK_KINDS = ["zadanie", "brak_formalny"] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

export const TASK_KIND_LABELS: Record<TaskKind, string> = {
  zadanie: "Zadanie",
  brak_formalny: "Brak formalny",
};

export const EVENT_KINDS = [
  "rozprawa",
  "posiedzenie",
  "termin_procesowy",
  "spotkanie",
  "inne",
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export const EVENT_KIND_LABELS: Record<EventKind, string> = {
  rozprawa: "Rozprawa",
  posiedzenie: "Posiedzenie",
  termin_procesowy: "Termin procesowy",
  spotkanie: "Spotkanie",
  inne: "Inne",
};

export const INVOICE_STATUSES = ["draft", "approved", "sent", "paid", "anulowana"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Szkic",
  approved: "Zatwierdzona",
  sent: "Wysłana",
  paid: "Opłacona",
  anulowana: "Anulowana",
};

export const KSEF_STATUSES = ["not_sent", "pending", "accepted", "error"] as const;
export type KsefStatus = (typeof KSEF_STATUSES)[number];

export const KSEF_STATUS_LABELS: Record<KsefStatus, string> = {
  not_sent: "Niewysłana",
  pending: "W trakcie wysyłki",
  accepted: "Przyjęta przez KSeF",
  error: "Błąd wysyłki",
};

export const PAYMENT_METHODS = ["przelew", "gotowka", "karta", "inna"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  przelew: "Przelew",
  gotowka: "Gotówka",
  karta: "Karta",
  inna: "Inna",
};

export const EVENT_SOURCES = ["manual", "pi_import"] as const;
export type EventSource = (typeof EVENT_SOURCES)[number];

export const EVENT_SOURCE_LABELS: Record<EventSource, string> = {
  manual: "Wprowadzone ręcznie",
  pi_import: "Portal Informacyjny",
};
