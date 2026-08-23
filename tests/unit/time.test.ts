import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatMinutesAsClock,
  formatMinutesAsHours,
  minutesToDecimalHours,
  monthRange,
  parseDurationToMinutes,
  startOfWeek,
  todayInWarsaw,
  warsawLocalToUtc,
  weekDays,
} from "@/lib/time";

const normalize = (value: string) => value.replace(/ /g, " ");

describe("parseDurationToMinutes", () => {
  it("przyjmuje zapis zegarowy", () => {
    expect(parseDurationToMinutes("1:30")).toBe(90);
    expect(parseDurationToMinutes("0:45")).toBe(45);
    expect(parseDurationToMinutes("2:05")).toBe(125);
    expect(parseDurationToMinutes("10:00")).toBe(600);
  });

  it("przyjmuje godziny dziesiętne z przecinkiem i z kropką", () => {
    expect(parseDurationToMinutes("1,5")).toBe(90);
    expect(parseDurationToMinutes("1.5")).toBe(90);
    expect(parseDurationToMinutes("0,25")).toBe(15);
    expect(parseDurationToMinutes("1,75h")).toBe(105);
  });

  it("przyjmuje zapis mieszany", () => {
    expect(parseDurationToMinutes("1h30m")).toBe(90);
    expect(parseDurationToMinutes("1h30")).toBe(90);
    expect(parseDurationToMinutes("2h")).toBe(120);
  });

  it("przyjmuje same minuty", () => {
    expect(parseDurationToMinutes("90m")).toBe(90);
    expect(parseDurationToMinutes("15m")).toBe(15);
  });

  it("samą liczbę traktuje jako minuty", () => {
    // Tak notuje większość osób po krótkiej rozmowie telefonicznej.
    expect(parseDurationToMinutes("15")).toBe(15);
    expect(parseDurationToMinutes("90")).toBe(90);
  });

  it("ignoruje spacje i wielkość liter", () => {
    expect(parseDurationToMinutes(" 1 h 30 ")).toBe(90);
    expect(parseDurationToMinutes("1H30M")).toBe(90);
  });

  it("odrzuca wejście bez sensu", () => {
    expect(parseDurationToMinutes("")).toBeNull();
    expect(parseDurationToMinutes("abc")).toBeNull();
    expect(parseDurationToMinutes("1:75")).toBeNull();
    expect(parseDurationToMinutes("1h90m")).toBeNull();
  });
});

describe("formatMinutesAsClock", () => {
  it("formatuje czas trwania", () => {
    expect(formatMinutesAsClock(90)).toBe("1:30");
    expect(formatMinutesAsClock(60)).toBe("1:00");
    expect(formatMinutesAsClock(5)).toBe("0:05");
    expect(formatMinutesAsClock(605)).toBe("10:05");
  });

  it("obsługuje zero i wartości ujemne", () => {
    expect(formatMinutesAsClock(0)).toBe("0:00");
    expect(formatMinutesAsClock(-90)).toBe("-1:30");
  });
});

describe("formatMinutesAsHours", () => {
  it("formatuje godziny dziesiętne po polsku", () => {
    expect(normalize(formatMinutesAsHours(90))).toBe("1,5 h");
    expect(normalize(formatMinutesAsHours(60))).toBe("1 h");
    expect(normalize(formatMinutesAsHours(20))).toBe("0,33 h");
  });

  it("pozwala pominąć jednostkę", () => {
    expect(formatMinutesAsHours(90, false)).toBe("1,5");
  });
});

describe("minutesToDecimalHours", () => {
  it("przelicza minuty na godziny z czterema miejscami dziesiętnymi", () => {
    expect(minutesToDecimalHours(90)).toBe(1.5);
    expect(minutesToDecimalHours(60)).toBe(1);
    expect(minutesToDecimalHours(20)).toBe(0.3333);
    expect(minutesToDecimalHours(45)).toBe(0.75);
  });
});

describe("formatDate", () => {
  it("formatuje datę z bazy w zapisie dd.MM.yyyy", () => {
    expect(formatDate("2026-08-23")).toBe("23.08.2026");
  });

  it("nie przesuwa daty o strefę czasową", () => {
    // Konstruktor Date zinterpretowałby '2026-01-01' jako północ UTC,
    // co w Europe/Warsaw jest już 1 stycznia o 1:00 — ale przy czasie letnim
    // i przeciwnym kierunku przesunięcia data potrafi przeskoczyć o dobę.
    // Termin procesowy przesunięty o dzień to w kancelarii uchybienie terminowi.
    expect(formatDate("2026-01-01")).toBe("01.01.2026");
    expect(formatDate("2026-12-31")).toBe("31.12.2026");
    // Dzień zmiany czasu na letni w Polsce w 2026 r.
    expect(formatDate("2026-03-29")).toBe("29.03.2026");
    // Dzień zmiany czasu na zimowy.
    expect(formatDate("2026-10-25")).toBe("25.10.2026");
  });
});

describe("todayInWarsaw", () => {
  it("zwraca datę w postaci yyyy-MM-dd", () => {
    expect(todayInWarsaw()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("używa strefy warszawskiej, a nie UTC", () => {
    // 31 grudnia 23:30 UTC to w Polsce już 1 stycznia.
    const newYearEveUtc = new Date("2026-12-31T23:30:00Z");
    expect(todayInWarsaw(newYearEveUtc)).toBe("2027-01-01");
  });
});

describe("startOfWeek", () => {
  it("zwraca poniedziałek, zgodnie z kalendarzem polskim", () => {
    // 23.08.2026 to niedziela — tydzień zaczyna się 17.08.
    expect(startOfWeek("2026-08-23")).toBe("2026-08-17");
    // 17.08.2026 to poniedziałek — pozostaje bez zmian.
    expect(startOfWeek("2026-08-17")).toBe("2026-08-17");
    // 19.08.2026 to środa.
    expect(startOfWeek("2026-08-19")).toBe("2026-08-17");
  });

  it("poprawnie przechodzi przez granicę miesiąca", () => {
    expect(startOfWeek("2026-09-01")).toBe("2026-08-31");
  });
});

describe("weekDays", () => {
  it("zwraca siedem kolejnych dni od poniedziałku", () => {
    expect(weekDays("2026-08-19")).toEqual([
      "2026-08-17",
      "2026-08-18",
      "2026-08-19",
      "2026-08-20",
      "2026-08-21",
      "2026-08-22",
      "2026-08-23",
    ]);
  });
});

describe("monthRange", () => {
  it("zwraca pierwszy i ostatni dzień miesiąca", () => {
    expect(monthRange("2026-08-23")).toEqual({ from: "2026-08-01", to: "2026-08-31" });
  });

  it("obsługuje luty w roku nieprzestępnym", () => {
    expect(monthRange("2026-02-15")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });

  it("obsługuje luty w roku przestępnym", () => {
    expect(monthRange("2028-02-15")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });

  it("obsługuje miesiące trzydziestodniowe", () => {
    expect(monthRange("2026-04-10")).toEqual({ from: "2026-04-01", to: "2026-04-30" });
  });
});

describe("warsawLocalToUtc", () => {
  it("przelicza czas letni (UTC+2)", () => {
    // 27 sierpnia 2026, rozprawa o 10:00 czasu warszawskiego = 08:00 UTC.
    expect(warsawLocalToUtc("2026-08-27", "10:00").toISOString()).toBe("2026-08-27T08:00:00.000Z");
  });

  it("przelicza czas zimowy (UTC+1)", () => {
    // 15 stycznia 2026, ta sama godzina lokalna = 09:00 UTC.
    expect(warsawLocalToUtc("2026-01-15", "10:00").toISOString()).toBe("2026-01-15T09:00:00.000Z");
  });

  it("nie przesuwa terminu przy zmianie czasu na letni", () => {
    // 29.03.2026 to dzień zmiany czasu. Rozprawa o 10:00 nadal ma być o 10:00
    // lokalnie — zaszyta na sztywno stała przesunęłaby ją o godzinę.
    const beforeChange = warsawLocalToUtc("2026-03-28", "10:00");
    const afterChange = warsawLocalToUtc("2026-03-30", "10:00");
    expect(beforeChange.toISOString()).toBe("2026-03-28T09:00:00.000Z");
    expect(afterChange.toISOString()).toBe("2026-03-30T08:00:00.000Z");
  });

  it("nie przesuwa terminu przy zmianie czasu na zimowy", () => {
    expect(warsawLocalToUtc("2026-10-24", "10:00").toISOString()).toBe("2026-10-24T08:00:00.000Z");
    expect(warsawLocalToUtc("2026-10-26", "10:00").toISOString()).toBe("2026-10-26T09:00:00.000Z");
  });

  it("zachowuje godzinę po ponownym sformatowaniu do strefy warszawskiej", () => {
    for (const date of ["2026-01-15", "2026-06-15", "2026-03-29", "2026-10-25"]) {
      const utc = warsawLocalToUtc(date, "09:30");
      const backToWarsaw = new Intl.DateTimeFormat("pl-PL", {
        timeZone: "Europe/Warsaw",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(utc);
      expect(backToWarsaw, `data ${date}`).toBe("09:30");
    }
  });
});
