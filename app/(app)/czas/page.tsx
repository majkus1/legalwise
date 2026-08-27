import type { Metadata } from "next";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { requireOrgContext } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { listCaseOptions, listMembers } from "@/lib/queries";
import { formatGrosz } from "@/lib/money";
import {
  formatDate,
  formatMinutesAsHours,
  formatWeekday,
  startOfWeek,
  todayInWarsaw,
  weekDays,
} from "@/lib/time";
import { BILLING_MODEL_LABELS, type BillingModel } from "@/lib/domain";
import { EmptyState, PageHeader, StatTile } from "@/components/page-parts";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/button-link";
import { Card, CardContent } from "@/components/ui/card";
import { EntryActions } from "./entry-actions";

export const metadata: Metadata = { title: "Ewidencja czasu" };

/** Przesuwa datę o podaną liczbę dni, operując na zapisie yyyy-MM-dd. */
function shiftDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export default async function TimesheetPage({ searchParams }: PageProps<"/czas">) {
  const context = await requireOrgContext();

  // Sekretariat nie prowadzi ewidencji czasu (polityka RLS na time_entries).
  if (context.role === "staff") {
    return (
      <>
        <PageHeader title="Ewidencja czasu" />
        <EmptyState
          icon={Clock}
          title="Ewidencja czasu jest poza Twoim zakresem"
          description="Czas pracy rejestrują prawnicy. Twoje uprawnienia obejmują kalendarz, zadania i kartotekę."
          actionLabel="Wróć do pulpitu"
          actionHref="/"
        />
      </>
    );
  }

  const params = await searchParams;
  const requestedWeek =
    typeof params.tydzien === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.tydzien)
      ? params.tydzien
      : todayInWarsaw();

  const monday = startOfWeek(requestedWeek);
  const days = weekDays(monday);
  const sunday = days[6];
  const today = todayInWarsaw();

  // Właściciel i partner mogą oglądać ewidencję całego zespołu; prawnik
  // widzi wyłącznie własną (i tak wymusza to RLS).
  const showTeam = context.canSeeFinances && params.zespol === "1";

  const supabase = await createServerSupabase();
  let request = supabase
    .from("time_entries")
    .select(
      "id, work_date, minutes, description, billing_type, rate_snapshot_grosz, billable, locked_at, user_id, case_id, cases(case_number, title, clients(name))",
    )
    .gte("work_date", monday)
    .lte("work_date", sunday)
    .order("work_date")
    .order("created_at");

  if (!showTeam) request = request.eq("user_id", context.userId);

  const [{ data: entries }, cases, members] = await Promise.all([
    request,
    listCaseOptions(),
    listMembers(context.organizationId),
  ]);

  const rows = entries ?? [];
  const memberName = new Map(members.map((member) => [member.userId, member.displayName]));

  const totalMinutes = rows.reduce((sum, row) => sum + row.minutes, 0);
  const billableMinutes = rows.filter((row) => row.billable).reduce((sum, row) => sum + row.minutes, 0);
  const proBonoMinutes = rows
    .filter((row) => row.billing_type === "nieodplatny")
    .reduce((sum, row) => sum + row.minutes, 0);
  const billableValue = rows
    .filter((row) => row.billable && row.billing_type === "godzinowy")
    .reduce((sum, row) => sum + Math.round((row.minutes / 60) * row.rate_snapshot_grosz), 0);

  const weekQuery = (week: string) =>
    `/czas?tydzien=${week}${showTeam ? "&zespol=1" : ""}`;

  return (
    <>
      <PageHeader
        title="Ewidencja czasu"
        description={`${formatDate(monday)} – ${formatDate(sunday)}`}
        actions={
          // Cztery przyciski nawigacji po tygodniach nie mieszczą się w jednym
          // rzędzie na najwęższych telefonach — muszą móc się złamać.
          <div className="flex flex-wrap items-center gap-2">
            {context.canSeeFinances && (
              <ButtonLink href={showTeam ? `/czas?tydzien=${monday}` : `/czas?tydzien=${monday}&zespol=1`} variant="outline" size="sm">
                {showTeam ? "Tylko moje" : "Cały zespół"}
              </ButtonLink>
            )}
            <ButtonLink href={weekQuery(shiftDays(monday, -7))} variant="outline" size="icon" aria-label="Poprzedni tydzień">
              <ChevronLeft className="size-4" />
            </ButtonLink>
            <ButtonLink href={weekQuery(todayInWarsaw())} variant="outline" size="sm">
              Bieżący tydzień
            </ButtonLink>
            <ButtonLink href={weekQuery(shiftDays(monday, 7))} variant="outline" size="icon" aria-label="Następny tydzień">
              <ChevronRight className="size-4" />
            </ButtonLink>
          </div>
        }
      />

      <section className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile label="Razem w tygodniu" value={formatMinutesAsHours(totalMinutes)} />
        <StatTile label="Do zafakturowania" value={formatMinutesAsHours(billableMinutes)} />
        <StatTile
          label="Nieodpłatnie"
          value={formatMinutesAsHours(proBonoMinutes)}
          tone="muted"
        />
        {context.canSeeFinances && (
          <StatTile
            label="Wartość godzin"
            value={formatGrosz(billableValue)}
            hint="Netto, wyłącznie rozliczenia godzinowe"
          />
        )}
      </section>

      {rows.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="Brak wpisów w tym tygodniu"
          description="Naciśnij klawisz N, aby zarejestrować czas pracy."
        />
      ) : (
        <div className="space-y-4">
          {days.map((day) => {
            const dayRows = rows.filter((row) => row.work_date === day);
            const dayMinutes = dayRows.reduce((sum, row) => sum + row.minutes, 0);
            const isToday = day === today;

            if (dayRows.length === 0 && !isToday) return null;

            return (
              <Card key={day} className={isToday ? "border-[var(--brand-gold)]/50" : undefined}>
                <CardContent className="px-5 py-4">
                  <div className="mb-3 flex items-baseline justify-between gap-4 border-b pb-2">
                    <h2 className="font-heading text-base font-semibold">
                      <span className="capitalize">{formatWeekday(day)}</span>
                      <span className="tabular ml-2 text-sm font-normal text-muted-foreground">
                        {formatDate(day)}
                      </span>
                      {isToday && (
                        <Badge variant="secondary" className="ml-2">
                          dziś
                        </Badge>
                      )}
                    </h2>
                    <span className="tabular text-sm font-medium">
                      {dayMinutes > 0 ? formatMinutesAsHours(dayMinutes) : "—"}
                    </span>
                  </div>

                  {dayRows.length === 0 ? (
                    <p className="py-2 text-sm text-muted-foreground">
                      Brak wpisów.
                    </p>
                  ) : (
                    <ul className="divide-y">
                      {dayRows.map((row) => (
                        <li key={row.id} className="flex items-start gap-4 py-2.5">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm">{row.description}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {row.cases
                                ? `${row.cases.case_number} — ${row.cases.title}`
                                : "Sprawa niedostępna"}
                              {row.cases?.clients ? ` · ${row.cases.clients.name}` : ""}
                              {showTeam ? ` · ${memberName.get(row.user_id) ?? "—"}` : ""}
                            </p>
                          </div>

                          <div className="flex shrink-0 items-center gap-3">
                            {row.billing_type !== "godzinowy" && (
                              <Badge variant="secondary" className="hidden sm:inline-flex">
                                {BILLING_MODEL_LABELS[row.billing_type as BillingModel]}
                              </Badge>
                            )}
                            <span className="tabular w-14 text-right text-sm font-medium">
                              {formatMinutesAsHours(row.minutes)}
                            </span>
                            {row.user_id === context.userId ? (
                              <EntryActions
                                cases={cases}
                                entry={{
                                  id: row.id,
                                  caseId: row.case_id,
                                  workDate: row.work_date,
                                  minutes: row.minutes,
                                  description: row.description,
                                  billingType: row.billing_type as BillingModel,
                                  locked: row.locked_at !== null,
                                }}
                              />
                            ) : (
                              <span className="w-12" aria-hidden="true" />
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
