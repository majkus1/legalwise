import Link from "next/link";
import type { Metadata } from "next";
import { CalendarDays, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { requireOrgContext } from "@/lib/auth";
import { countLabel } from "@/lib/text";
import { createServerSupabase } from "@/lib/supabase/server";
import { listCaseOptions } from "@/lib/queries";
import { deleteCalendarEventAction } from "@/lib/actions/tasks";
import { formatDate, formatDateTime, monthRange, todayInWarsaw, WARSAW_TIME_ZONE } from "@/lib/time";
import { EVENT_KIND_LABELS, EVENT_SOURCE_LABELS, type EventKind, type EventSource } from "@/lib/domain";
import { EmptyState, PageHeader } from "@/components/page-parts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/button-link";
import { Card, CardContent } from "@/components/ui/card";
import { EventDialog } from "./event-dialog";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Kalendarz" };

const KIND_ACCENT: Record<EventKind, string> = {
  rozprawa: "border-l-[var(--brand-navy)]",
  posiedzenie: "border-l-[var(--brand-navy)]",
  termin_procesowy: "border-l-[var(--warning)]",
  spotkanie: "border-l-[var(--brand-gold)]",
  inne: "border-l-border",
};

/** Przesuwa miesiąc o podaną liczbę, zwracając datę w środku miesiąca. */
function shiftMonth(isoDate: string, months: number): string {
  const [year, month] = isoDate.split("-").map(Number);
  const total = year * 12 + (month - 1) + months;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-15`;
}

/** Dzień tygodnia (1 = poniedziałek) dla daty w zapisie yyyy-MM-dd. */
function weekdayIndex(isoDate: string): number {
  const day = new Date(`${isoDate}T12:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

export default async function CalendarPage({ searchParams }: PageProps<"/kalendarz">) {
  await requireOrgContext();
  const params = await searchParams;

  const anchor =
    typeof params.miesiac === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.miesiac)
      ? params.miesiac
      : todayInWarsaw();

  const { from, to } = monthRange(anchor);
  const today = todayInWarsaw();

  // Wybrany dzień siedzi w adresie, a nie w stanie komponentu: dzięki temu
  // widok da się odświeżyć, cofnąć przyciskiem przeglądarki i wysłać linkiem
  // współpracownikowi („zobacz, co mamy 28-go").
  const selectedDay =
    typeof params.dzien === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(params.dzien) &&
    params.dzien >= from &&
    params.dzien <= to
      ? params.dzien
      : null;

  const supabase = await createServerSupabase();
  const [{ data: events }, cases] = await Promise.all([
    supabase
      .from("calendar_events")
      .select("id, title, event_kind, starts_at, location, source, cases(id, case_number, signature)")
      .gte("starts_at", `${from}T00:00:00Z`)
      .lte("starts_at", `${to}T23:59:59Z`)
      .order("starts_at"),
    listCaseOptions(),
  ]);

  const rows = events ?? [];

  // Zdarzenia grupujemy po dacie w strefie warszawskiej, a nie po dacie UTC —
  // termin o 8:00 rano należy do właściwego dnia także zimą.
  const dayFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: WARSAW_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const byDay = new Map<string, typeof rows>();
  for (const event of rows) {
    const day = dayFormatter.format(new Date(event.starts_at));
    byDay.set(day, [...(byDay.get(day) ?? []), event]);
  }

  // Po kliknięciu w dzień lista pod siatką zawęża się do niego. Siatka
  // pokazuje cały miesiąc niezależnie od wyboru — inaczej nie dałoby się
  // przejść do sąsiedniego dnia jednym kliknięciem.
  const widoczne = selectedDay ? (byDay.get(selectedDay) ?? []) : rows;

  const daysInMonth = Number(to.split("-")[2]);
  const leadingBlanks = weekdayIndex(from) - 1;
  const monthLabel = new Intl.DateTimeFormat("pl-PL", {
    month: "long",
    year: "numeric",
    timeZone: WARSAW_TIME_ZONE,
  }).format(new Date(`${from}T12:00:00Z`));

  return (
    <>
      <PageHeader
        title="Kalendarz"
        description={`${countLabel(rows.length, ["termin", "terminy", "terminów"])} w tym miesiącu`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink href={`/kalendarz?miesiac=${shiftMonth(anchor, -1)}`} variant="outline" size="icon" aria-label="Poprzedni miesiąc">
              <ChevronLeft className="size-4" />
            </ButtonLink>
            <span className="min-w-36 text-center text-sm font-medium capitalize">
              {monthLabel}
            </span>
            <ButtonLink href={`/kalendarz?miesiac=${shiftMonth(anchor, 1)}`} variant="outline" size="icon" aria-label="Następny miesiąc">
              <ChevronRight className="size-4" />
            </ButtonLink>
            <ButtonLink href="/kalendarz" variant="ghost" size="sm">
              Dziś
            </ButtonLink>
            <EventDialog cases={cases} today={today} />
          </div>
        }
      />

      {/* Siatka miesiąca — na wąskich ekranach ustępuje miejsca liście. */}
      <div className="mb-8 hidden overflow-x-auto rounded-lg border lg:block">
        <div className="grid grid-cols-7 border-b bg-muted/40 text-xs font-medium">
          {["pon", "wt", "śr", "czw", "pt", "sob", "niedz"].map((day) => (
            <div key={day} className="px-2 py-2 text-center capitalize">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: leadingBlanks }, (_, index) => (
            <div key={`blank-${index}`} className="min-h-24 border-r border-b bg-muted/20" />
          ))}
          {Array.from({ length: daysInMonth }, (_, index) => {
            const dayNumber = index + 1;
            const iso = `${from.slice(0, 8)}${String(dayNumber).padStart(2, "0")}`;
            const dayEvents = byDay.get(iso) ?? [];
            const isToday = iso === today;

            const isSelected = iso === selectedDay;
            // Ponowne kliknięcie wybranego dnia zdejmuje zaznaczenie —
            // inaczej trzeba by szukać osobnego przycisku „pokaż cały miesiąc".
            const href = isSelected
              ? `/kalendarz?miesiac=${anchor}`
              : `/kalendarz?miesiac=${anchor}&dzien=${iso}`;

            return (
              <Link
                key={iso}
                href={href}
                scroll={false}
                aria-current={isSelected ? "date" : undefined}
                aria-label={`${dayNumber} ${monthLabel}, ${dayEvents.length === 0 ? "brak terminów" : `terminów: ${dayEvents.length}`}`}
                className={cn(
                  "block min-h-24 border-r border-b p-1.5 text-left transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  isToday && "bg-[var(--brand-gold)]/10",
                  // Szare tło po najechaniu przykrywałoby złote zaznaczenie,
                  // więc wybrany dzień rozjaśniamy w obrębie własnego koloru.
                  isSelected
                    ? "bg-[var(--brand-gold)]/25 ring-1 ring-[var(--brand-gold)] ring-inset hover:bg-[var(--brand-gold)]/35"
                    : "hover:bg-muted/60",
                )}
              >
                <div
                  className={cn(
                    "tabular mb-1 text-xs",
                    isToday ? "font-bold text-[var(--brand-gold-text)]" : "text-muted-foreground",
                  )}
                >
                  {dayNumber}
                </div>
                <ul className="space-y-1">
                  {dayEvents.map((event) => (
                    <li key={event.id}>
                      <span
                        className={cn(
                          "block truncate border-l-2 pl-1.5 text-[11px] leading-tight",
                          KIND_ACCENT[event.event_kind as EventKind],
                        )}
                        title={event.title}
                      >
                        {new Intl.DateTimeFormat("pl-PL", {
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: WARSAW_TIME_ZONE,
                        }).format(new Date(event.starts_at))}{" "}
                        {event.title}
                      </span>
                    </li>
                  ))}
                </ul>
              </Link>
            );
          })}
        </div>
      </div>

      {widoczne.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={selectedDay ? `Brak terminów ${formatDate(selectedDay)}` : "Brak terminów w tym miesiącu"}
          description={
            selectedDay
              ? "W tym dniu nic nie zaplanowano. Wybierz inny dzień albo dodaj termin."
              : "Dodaj rozprawę, posiedzenie albo termin procesowy, aby pojawił się we wspólnym kalendarzu kancelarii."
          }
          actionLabel={selectedDay ? "Pokaż cały miesiąc" : undefined}
          actionHref={selectedDay ? `/kalendarz?miesiac=${anchor}` : undefined}
        />
      ) : (
        <Card>
          <CardContent className="px-5 py-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-heading text-base font-semibold">
                {selectedDay ? `Terminy — ${formatDate(selectedDay)}` : "Lista terminów"}
              </h2>
              {selectedDay && (
                <ButtonLink href={`/kalendarz?miesiac=${anchor}`} variant="ghost" size="sm">
                  Pokaż cały miesiąc
                </ButtonLink>
              )}
            </div>
            <ul className="divide-y">
              {widoczne.map((event) => (
                <li key={event.id} className="flex items-start gap-4 py-3">
                  <div
                    className={cn(
                      "min-w-0 flex-1 border-l-2 pl-3",
                      KIND_ACCENT[event.event_kind as EventKind],
                    )}
                  >
                    <p className="text-sm font-medium">{event.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {EVENT_KIND_LABELS[event.event_kind as EventKind]}
                      {event.cases ? (
                        <>
                          {" · "}
                          <Link
                            href={`/sprawy/${event.cases.id}`}
                            className="underline-offset-4 hover:underline"
                          >
                            {event.cases.case_number}
                            {event.cases.signature ? ` (${event.cases.signature})` : ""}
                          </Link>
                        </>
                      ) : null}
                      {event.location ? ` · ${event.location}` : ""}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {event.source !== "manual" && (
                      <Badge variant="secondary">
                        {EVENT_SOURCE_LABELS[event.source as EventSource]}
                      </Badge>
                    )}
                    <span className="tabular text-xs whitespace-nowrap text-muted-foreground">
                      {formatDateTime(event.starts_at)}
                    </span>
                    <form action={deleteCalendarEventAction}>
                      <input type="hidden" name="id" value={event.id} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Usuń termin ${event.title}`}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        Terminy pochodzące z Portalu Informacyjnego pojawią się tu automatycznie po uruchomieniu
        synchronizacji i będą oznaczone jako zaciągnięte — struktura danych jest już na to
        przygotowana.
      </p>
    </>
  );
}
