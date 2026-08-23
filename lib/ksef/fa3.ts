/**
 * Generator faktury ustrukturyzowanej w strukturze FA(3).
 *
 * Przestrzeń nazw i element główny są zgodne ze wzorem opublikowanym
 * w Centralnym Repozytorium Wzorów Dokumentów Elektronicznych.
 *
 * ZAKRES: obsługujemy podzbiór schematu potrzebny kancelarii — faktura VAT
 * za usługi prawne, jedna stawka lub kilka stawek podstawowych, bez marży,
 * bez procedur szczególnych. Schemat FA(3) jest znacznie obszerniejszy;
 * pozostałe pola są opcjonalne i celowo pominięte.
 *
 * PRZED WDROŻENIEM PRODUKCYJNYM wygenerowany dokument należy sprawdzić
 * walidatorem względem oficjalnego XSD — struktura jest bogata, a kolejność
 * elementów w schemacie jest znacząca.
 */

import { roundHalfAwayFromZero } from "@/lib/money";

export const FA3_NAMESPACE = "http://crd.gov.pl/wzor/2025/06/25/13775/";
export const FA3_SYSTEM_CODE = "FA (3)";
export const FA3_SCHEMA_VERSION = "1-0E";

/** Nazwa systemu wysyłającego — trafia do nagłówka faktury. */
export const FA3_SYSTEM_INFO = "Legal-Wise";

// ---------------------------------------------------------------------------
// Dane wejściowe
// ---------------------------------------------------------------------------

export interface Fa3Party {
  /** NIP bez myślników; pusty dla nabywcy będącego osobą fizyczną. */
  taxId: string | null;
  name: string;
  countryCode: string;
  /** Pierwsza linia adresu: ulica i numer. */
  addressLine1: string;
  /** Druga linia adresu: kod pocztowy i miejscowość. */
  addressLine2: string;
}

export interface Fa3Line {
  /** Nazwa towaru lub usługi (P_7). */
  name: string;
  /** Jednostka miary (P_8A). */
  unit: string;
  /** Ilość (P_8B). */
  quantity: number;
  /** Cena jednostkowa netto w groszach (P_9A). */
  unitPriceNetGrosz: number;
  /** Wartość netto pozycji w groszach (P_11). */
  netGrosz: number;
  /** Stawka podatku w procentach (P_12). */
  vatRate: number;
}

export interface Fa3Invoice {
  number: string;
  /** Data wystawienia (P_1) w zapisie yyyy-MM-dd. */
  issueDate: string;
  /** Data dokonania lub zakończenia dostawy (P_6). */
  saleDate: string | null;
  dueDate: string | null;
  currency: string;
  seller: Fa3Party;
  buyer: Fa3Party;
  lines: Fa3Line[];
  /** Moment wytworzenia dokumentu — przekazywany, nie odczytywany z zegara. */
  generatedAt: Date;
  /** Dodatkowe uwagi, np. wskazanie okresu rozliczeniowego. */
  notes?: string | null;
}

// ---------------------------------------------------------------------------
// Pomocnicze
// ---------------------------------------------------------------------------

/**
 * Ucieczka znaków specjalnych XML.
 *
 * Nazwy klientów i opisy czynności pochodzą od użytkownika i regularnie
 * zawierają „&" oraz cudzysłowy. Bez tego dokument nie jest poprawnym XML-em.
 */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Grosze na zapis dziesiętny wymagany przez schemat: 123456 → „1234.56". */
export function groszToDecimal(grosz: number): string {
  const sign = grosz < 0 ? "-" : "";
  const absolute = Math.abs(grosz);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

/** Ilość z maksymalnie sześcioma miejscami dziesiętnymi, bez zbędnych zer. */
export function formatQuantity(quantity: number): string {
  const rounded = roundHalfAwayFromZero(quantity * 1_000_000) / 1_000_000;
  return String(rounded);
}

/** Data i czas w postaci wymaganej przez pole DataWytworzeniaFa. */
export function formatTimestamp(date: Date): string {
  return `${date.toISOString().slice(0, 19)}Z`;
}

function tag(name: string, value: string | number): string {
  return `<${name}>${typeof value === "string" ? escapeXml(value) : value}</${name}>`;
}

// ---------------------------------------------------------------------------
// Podsumowanie stawek
// ---------------------------------------------------------------------------

export interface VatSummaryRow {
  vatRate: number;
  netGrosz: number;
  vatGrosz: number;
}

/**
 * Sumuje wartości w rozbiciu na stawki podatku.
 *
 * VAT liczymy od SUMY netto danej stawki, a nie jako sumę podatku z pozycji.
 * Tak wymaga konstrukcja pól P_13_x / P_14_x, w których podaje się wartość
 * sprzedaży i podatek łącznie dla stawki.
 */
export function summarizeVat(lines: readonly Fa3Line[]): VatSummaryRow[] {
  const byRate = new Map<number, number>();
  for (const line of lines) {
    byRate.set(line.vatRate, (byRate.get(line.vatRate) ?? 0) + line.netGrosz);
  }

  return [...byRate.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([vatRate, netGrosz]) => ({
      vatRate,
      netGrosz,
      vatGrosz: roundHalfAwayFromZero((netGrosz * vatRate) / 100),
    }));
}

function partyXml(elementName: string, party: Fa3Party): string {
  const identification = party.taxId
    ? `<DaneIdentyfikacyjne>${tag("NIP", party.taxId)}${tag("Nazwa", party.name)}</DaneIdentyfikacyjne>`
    : `<DaneIdentyfikacyjne>${tag("BrakID", 1)}${tag("Nazwa", party.name)}</DaneIdentyfikacyjne>`;

  const address =
    `<Adres>${tag("KodKraju", party.countryCode)}${tag("AdresL1", party.addressLine1)}` +
    (party.addressLine2 ? tag("AdresL2", party.addressLine2) : "") +
    `</Adres>`;

  return `<${elementName}>${identification}${address}</${elementName}>`;
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Buduje dokument FA(3) dla faktury.
 *
 * Kolejność elementów odpowiada kolejności ze schematu — w XSD jest ona
 * znacząca i zmiana kolejności unieważnia dokument.
 */
export function buildFa3Xml(invoice: Fa3Invoice): string {
  const summary = summarizeVat(invoice.lines);
  const totalNet = summary.reduce((sum, row) => sum + row.netGrosz, 0);
  const totalVat = summary.reduce((sum, row) => sum + row.vatGrosz, 0);
  const totalGross = totalNet + totalVat;

  const header =
    `<Naglowek>` +
    `<KodFormularza kodSystemowy="${FA3_SYSTEM_CODE}" wersjaSchemy="${FA3_SCHEMA_VERSION}">FA</KodFormularza>` +
    tag("WariantFormularza", 3) +
    tag("DataWytworzeniaFa", formatTimestamp(invoice.generatedAt)) +
    tag("SystemInfo", FA3_SYSTEM_INFO) +
    `</Naglowek>`;

  // Wartości sprzedaży i podatku w rozbiciu na stawki.
  // P_13_1/P_14_1 — stawka podstawowa 23%, P_13_2/P_14_2 — 8%, P_13_3 — 5%.
  const rateFields = summary
    .map((row) => {
      const slot = row.vatRate === 23 ? "1" : row.vatRate === 8 ? "2" : row.vatRate === 5 ? "3" : null;
      if (slot === null) return "";
      return tag(`P_13_${slot}`, groszToDecimal(row.netGrosz)) + tag(`P_14_${slot}`, groszToDecimal(row.vatGrosz));
    })
    .join("");

  // Adnotacje są sekcją obowiązkową. Wartość 2 oznacza „nie dotyczy" —
  // kancelaria wystawia zwykłe faktury VAT za usługi.
  const annotations =
    `<Adnotacje>` +
    tag("P_16", 2) +
    tag("P_17", 2) +
    tag("P_18", 2) +
    tag("P_18A", 2) +
    `<Zwolnienie>${tag("P_19N", 1)}</Zwolnienie>` +
    `<NoweSrodkiTransportu>${tag("P_22N", 1)}</NoweSrodkiTransportu>` +
    tag("P_23", 2) +
    `<PMarzy>${tag("P_PMarzyN", 1)}</PMarzy>` +
    `</Adnotacje>`;

  const lines = invoice.lines
    .map((line, index) =>
      `<FaWiersz>` +
      tag("NrWierszaFa", index + 1) +
      tag("P_7", line.name) +
      tag("P_8A", line.unit) +
      tag("P_8B", formatQuantity(line.quantity)) +
      tag("P_9A", groszToDecimal(line.unitPriceNetGrosz)) +
      tag("P_11", groszToDecimal(line.netGrosz)) +
      tag("P_12", String(line.vatRate)) +
      `</FaWiersz>`,
    )
    .join("");

  const payment = invoice.dueDate
    ? `<Platnosc><TerminPlatnosci>${tag("Termin", invoice.dueDate)}</TerminPlatnosci></Platnosc>`
    : "";

  const fa =
    `<Fa>` +
    tag("KodWaluty", invoice.currency) +
    tag("P_1", invoice.issueDate) +
    tag("P_2", invoice.number) +
    (invoice.saleDate ? tag("P_6", invoice.saleDate) : "") +
    rateFields +
    tag("P_15", groszToDecimal(totalGross)) +
    annotations +
    tag("RodzajFaktury", "VAT") +
    (invoice.notes ? `<DodatkowyOpis>${tag("Klucz", "Uwagi")}${tag("Wartosc", invoice.notes)}</DodatkowyOpis>` : "") +
    lines +
    payment +
    `</Fa>`;

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Faktura xmlns="${FA3_NAMESPACE}">` +
    header +
    partyXml("Podmiot1", invoice.seller) +
    partyXml("Podmiot2", invoice.buyer) +
    fa +
    `</Faktura>`
  );
}

/** Wersja z wcięciami — do podglądu w interfejsie, nie do wysyłki. */
export function prettyPrintXml(xml: string): string {
  const withBreaks = xml.replace(/></g, ">\n<");
  let depth = 0;

  return withBreaks
    .split("\n")
    .map((line) => {
      if (/^<\//.test(line)) depth = Math.max(0, depth - 1);
      const indented = "  ".repeat(depth) + line;
      // Element otwierający, który nie jest deklaracją, samozamknięciem
      // ani parą otwarcie-zamknięcie w jednej linii, zwiększa wcięcie.
      if (/^<[^/?!][^>]*>$/.test(line) && !/\/>$/.test(line)) depth += 1;
      return indented;
    })
    .join("\n");
}
