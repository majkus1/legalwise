/**
 * Operacje na czasie pracy i datach.
 *
 * Czas pracy przechowujemy w minutach (liczba całkowita). Terminy procesowe są
 * DATAMI, nie momentami w czasie — przesunięcie o strefę mogłoby przenieść
 * termin na inny dzień, a to w kancelarii oznacza uchybienie terminowi.
 */

export const WARSAW_TIME_ZONE = "Europe/Warsaw";

/** Czas trwania w zapisie zegarowym: 90 → „1:30”. */
export function formatMinutesAsClock(minutes: number): string {
  const sign = minutes < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(minutes));
  const hours = Math.floor(abs / 60);
  const rest = abs % 60;
  return `${sign}${hours}:${String(rest).padStart(2, "0")}`;
}

/** Czas trwania w godzinach dziesiętnych: 90 → „1,5 h”. */
export function formatMinutesAsHours(minutes: number, withUnit = true): string {
  const hours = minutes / 60;
  const formatted = new Intl.NumberFormat("pl-PL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(hours);
  return withUnit ? `${formatted} h` : formatted;
}

/** Godziny dziesiętne jako liczba — do pozycji faktury (ilość). */
export function minutesToDecimalHours(minutes: number): number {
  return Math.round((minutes / 60) * 10_000) / 10_000;
}

/**
 * Zamiana tego, co prawnik wpisze w pole czasu, na minuty.
 *
 * Rejestracja czasu jest czynnością wykonywaną kilkanaście razy dziennie,
 * więc pole musi przyjmować każdy naturalny zapis, a nie wymuszać jeden format:
 *   „1:30”, „1.5”, „1,5”, „1,5h”, „90m”, „90”, „1h30m”, „1 h 30”
 *
 * Zwraca null, gdy wejścia nie da się zinterpretować.
 */
export function parseDurationToMinutes(input: string): number | null {
  const raw = input.trim().toLowerCase().replace(/\s+/g, "");
  if (raw === "") return null;

  // Zapis zegarowy: 1:30
  const clock = /^(\d{1,3}):([0-5]?\d)$/.exec(raw);
  if (clock) {
    return Number(clock[1]) * 60 + Number(clock[2]);
  }

  // Zapis mieszany: 1h30m, 1h30, 1h
  const mixed = /^(\d{1,3})h(?:(\d{1,2})m?)?$/.exec(raw);
  if (mixed) {
    const mins = mixed[2] ? Number(mixed[2]) : 0;
    if (mins > 59) return null;
    return Number(mixed[1]) * 60 + mins;
  }

  // Same minuty: 90m
  const minutesOnly = /^(\d{1,4})m$/.exec(raw);
  if (minutesOnly) {
    return Number(minutesOnly[1]);
  }

  // Godziny dziesiętne: 1,5 / 1.5 / 1,5h
  const decimal = /^(\d{1,3})[.,](\d{1,2})h?$/.exec(raw);
  if (decimal) {
    const hours = Number(`${decimal[1]}.${decimal[2]}`);
    return Math.round(hours * 60);
  }

  // Sama liczba całkowita traktowana jako minuty — tak wpisuje większość osób,
  // gdy notuje „15” po krótkiej rozmowie telefonicznej.
  const plain = /^(\d{1,4})$/.exec(raw);
  if (plain) {
    return Number(plain[1]);
  }

  return null;
}

const dateFormatter = new Intl.DateTimeFormat("pl-PL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: WARSAW_TIME_ZONE,
});

const dateTimeFormatter = new Intl.DateTimeFormat("pl-PL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: WARSAW_TIME_ZONE,
});

const weekdayFormatter = new Intl.DateTimeFormat("pl-PL", {
  weekday: "long",
  timeZone: WARSAW_TIME_ZONE,
});

/**
 * Data w zapisie dd.MM.yyyy.
 *
 * Dla wartości typu `date` z bazy (postać „2026-08-23”) formatujemy tekstowo,
 * bez tworzenia obiektu Date. Konstruktor Date zinterpretowałby taki zapis jako
 * północ UTC, co w strefie Europe/Warsaw jest już poprzednim dniem w okresie
 * czasu zimowego i przesunęłoby termin o dobę.
 */
export function formatDate(value: string | Date): string {
  if (typeof value === "string") {
    const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (isoDate) {
      return `${isoDate[3]}.${isoDate[2]}.${isoDate[1]}`;
    }
    return dateFormatter.format(new Date(value));
  }
  return dateFormatter.format(value);
}

/** Data i godzina zdarzenia w kalendarzu, w czasie warszawskim. */
export function formatDateTime(value: string | Date): string {
  return dateTimeFormatter.format(typeof value === "string" ? new Date(value) : value);
}

export function formatWeekday(value: string | Date): string {
  if (typeof value === "string") {
    const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (isoDate) {
      return weekdayFormatter.format(new Date(`${value}T12:00:00Z`));
    }
  }
  return weekdayFormatter.format(typeof value === "string" ? new Date(value) : value);
}

/** Dzisiejsza data w strefie warszawskiej, w postaci „yyyy-MM-dd”. */
export function todayInWarsaw(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: WARSAW_TIME_ZONE,
  }).format(now);
  return parts;
}

/** Poniedziałek tygodnia, w którym leży podana data (kalendarz polski). */
export function startOfWeek(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  const day = date.getUTCDay(); // 0 = niedziela
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
}

/** Kolejne dni tygodnia zaczynając od poniedziałku. */
export function weekDays(isoDate: string): string[] {
  const monday = startOfWeek(isoDate);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${monday}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

/**
 * Zamienia datę i godzinę podaną w czasie warszawskim na moment UTC.
 *
 * Nie zakładamy stałego przesunięcia: latem wynosi ono dwie godziny, zimą
 * jedną. Rozprawa wpisana na 9:00 ma się odbyć o 9:00 niezależnie od pory roku,
 * a zaszyta na sztywno stała przesunęłaby połowę terminów w roku o godzinę.
 */
export function warsawLocalToUtc(date: string, time: string): Date {
  const naive = new Date(`${date}T${time}:00Z`);

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: WARSAW_TIME_ZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(naive).map((part) => [part.type, part.value]),
  );
  const asWarsaw = new Date(
    `${parts.year}-${parts.month}-${parts.day}T${
      parts.hour === "24" ? "00" : parts.hour
    }:${parts.minute}:${parts.second}Z`,
  );

  const offset = asWarsaw.getTime() - naive.getTime();
  return new Date(naive.getTime() - offset);
}

/** Pierwszy i ostatni dzień miesiąca, w którym leży podana data. */
export function monthRange(isoDate: string): { from: string; to: string } {
  const [year, month] = isoDate.split("-").map(Number);
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}
