/**
 * Warstwa integracji z Krajowym Systemem e-Faktur.
 *
 * Interfejs odwzorowuje rzeczywisty przebieg sesji interaktywnej KSeF 2.0
 * (dokumentacja Ministerstwa Finansów, repozytorium CIRFMF/ksef-api):
 *
 *   1. uwierzytelnienie → token dostępu
 *   2. wygenerowanie klucza symetrycznego AES-256 i wektora inicjującego,
 *      zaszyfrowanie klucza kluczem publicznym Ministerstwa
 *   3. POST /sessions/online            — otwarcie sesji (wersja schematu + klucz)
 *   4. POST /sessions/online/{ref}/invoices/  — faktura zaszyfrowana AES-256-CBC
 *   5. POST /sessions/online/{ref}/close      — zamknięcie i zbiorcze UPO
 *   6. odpytanie statusu i pobranie UPO
 *
 * Implementacja sieciowa jest świadomie odłożona — wysyłka wymaga certyfikatu
 * KSeF kancelarii i uprawnień nadanych po jej stronie. Do tego czasu działa
 * implementacja zgłaszająca czytelny brak konfiguracji, a cała reszta systemu
 * (struktura danych, generowanie XML, statusy) jest już gotowa.
 */

export type KsefEnvironment = "test" | "przedprodukcyjne" | "produkcyjne";

export interface KsefSession {
  referenceNumber: string;
  /** Sesja wygasa po 12 godzinach od utworzenia. */
  validUntil: string;
}

export interface KsefSendResult {
  /** Numer referencyjny faktury w ramach sesji. */
  referenceNumber: string;
}

export type KsefSessionState = "w_toku" | "zakonczona" | "blad";

export interface KsefSessionStatus {
  state: KsefSessionState;
  acceptedCount: number;
  rejectedCount: number;
  message?: string;
}

export interface KsefUpo {
  /** Urzędowe Poświadczenie Odbioru w formacie XML. */
  xml: string;
}

export interface KsefClient {
  /** Czy integracja jest skonfigurowana i gotowa do wysyłki. */
  isConfigured(): boolean;
  openSession(): Promise<KsefSession>;
  /** Faktura jest szyfrowana AES-256-CBC przed wysłaniem. */
  sendInvoice(sessionReference: string, invoiceXml: string): Promise<KsefSendResult>;
  closeSession(sessionReference: string): Promise<void>;
  getSessionStatus(sessionReference: string): Promise<KsefSessionStatus>;
  getUpo(sessionReference: string): Promise<KsefUpo>;
}

/** Zgłaszany, gdy ktoś spróbuje wysłać fakturę bez skonfigurowanej integracji. */
export class KsefNotConfiguredError extends Error {
  constructor() {
    super(
      "Integracja z KSeF nie jest jeszcze uruchomiona. " +
        "Fakturę można wystawić, pobrać jej PDF oraz plik XML w strukturze FA(3), " +
        "ale wysyłka wymaga certyfikatu KSeF kancelarii.",
    );
    this.name = "KsefNotConfiguredError";
  }
}

/**
 * Implementacja zastępcza.
 *
 * Nie udaje, że wysyła. Każda próba kończy się jednoznacznym komunikatem,
 * dzięki czemu nikt nie uzna faktury za wprowadzoną do obiegu prawnego,
 * gdy w rzeczywistości nigdzie nie poszła.
 */
export class NotConfiguredKsefClient implements KsefClient {
  isConfigured(): boolean {
    return false;
  }

  async openSession(): Promise<KsefSession> {
    throw new KsefNotConfiguredError();
  }

  async sendInvoice(): Promise<KsefSendResult> {
    throw new KsefNotConfiguredError();
  }

  async closeSession(): Promise<void> {
    throw new KsefNotConfiguredError();
  }

  async getSessionStatus(): Promise<KsefSessionStatus> {
    throw new KsefNotConfiguredError();
  }

  async getUpo(): Promise<KsefUpo> {
    throw new KsefNotConfiguredError();
  }
}

/**
 * Zwraca klienta właściwego dla bieżącej konfiguracji.
 *
 * Po podłączeniu integracji wystarczy tu zwrócić implementację sieciową —
 * reszta systemu nie wymaga zmian.
 */
export function getKsefClient(): KsefClient {
  return new NotConfiguredKsefClient();
}
