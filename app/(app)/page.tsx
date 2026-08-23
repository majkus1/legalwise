import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle, CalendarClock, CheckSquare, Clock, Gavel } from "lucide-react";
import { requireOrgContext } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  formatDate,
  formatDateTime,
  formatMinutesAsHours,
  todayInWarsaw,
  weekDays,
} from "@/lib/time";
import { EVENT_KIND_LABELS, TASK_PRIORITY_LABELS, type EventKind, type TaskPriority } from "@/lib/domain";
import { EmptyState, PageHeader, StatTile } from "@/components/page-parts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Pulpit" };

export default async function DashboardPage() {
  const context = await requireOrgContext();
  const supabase = await createServerSupabase();

  const today = todayInWarsaw();
  const week = weekDays(today);
  const weekStart = week[0];
  const weekEnd = week[6];
  const canLogTime = context.role !== "staff";

  const [timeResult, tasksResult, eventsResult, deficienciesResult] = await Promise.all([
    canLogTime
      ? supabase
          .from("time_entries")
          .select("work_date, minutes, billable, billing_type")
          .eq("user_id", context.userId)
          .gte("work_date", weekStart)
          .lte("work_date", weekEnd)
      : Promise.resolve({ data: [] as never[] }),

    supabase
      .from("tasks")
      .select("id, title, due_date, priority, task_kind, cases(case_number, title)")
      .eq("assignee_id", context.userId)
      .not("status", "in", "(zrobione,anulowane)")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(8),

    supabase
      .from("calendar_events")
      .select("id, title, event_kind, starts_at, location, cases(case_number, signature)")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(6),

    supabase
      .from("tasks")
      .select("id, title, due_date, cases(case_number)")
      .eq("task_kind", "brak_formalny")
      .not("status", "in", "(zrobione,anulowane)")
      .order("due_date", { ascending: true })
      .limit(5),
  ]);

  const entries = timeResult.data ?? [];
  const minutesToday = entries
    .filter((entry) => entry.work_date === today)
    .reduce((sum, entry) => sum + entry.minutes, 0);
  const minutesWeek = entries.reduce((sum, entry) => sum + entry.minutes, 0);
  const minutesBillable = entries
    .filter((entry) => entry.billable)
    .reduce((sum, entry) => sum + entry.minutes, 0);
  const minutesProBono = entries
    .filter((entry) => entry.billing_type === "nieodplatny")
    .reduce((sum, entry) => sum + entry.minutes, 0);

  const tasks = tasksResult.data ?? [];
  const events = eventsResult.data ?? [];
  const deficiencies = deficienciesResult.data ?? [];

  const overdueTasks = tasks.filter((task) => task.due_date && task.due_date < today);

  return (
    <>
      <PageHeader
        title={`Dzień dobry, ${context.displayName.split(" ")[0]}`}
        description={`${formatDate(today)} · ${context.organizationName}`}
      />

      {canLogTime && (
        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Dziś"
            value={formatMinutesAsHours(minutesToday)}
            hint={minutesToday === 0 ? "Nie zarejestrowano jeszcze czasu" : undefined}
          />
          <StatTile
            label="Ten tydzień"
            value={formatMinutesAsHours(minutesWeek)}
            hint={`${formatDate(weekStart)} – ${formatDate(weekEnd)}`}
          />
          <StatTile
            label="Do zafakturowania"
            value={formatMinutesAsHours(minutesBillable)}
            hint="Czas podlegający rozliczeniu w tym tygodniu"
          />
          <StatTile
            label="Nieodpłatnie"
            value={formatMinutesAsHours(minutesProBono)}
            tone="muted"
            hint="Czynności pro bono w tym tygodniu"
          />
        </section>
      )}

      {deficiencies.length > 0 && (
        <section className="mb-8">
          <Card className="border-[var(--warning)]/40 bg-[var(--warning)]/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="size-4 text-[var(--warning)]" aria-hidden="true" />
                Braki formalne do uzupełnienia
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {deficiencies.map((item) => {
                  const overdue = item.due_date != null && item.due_date < today;
                  return (
                    <li key={item.id} className="flex items-center justify-between gap-4 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{item.title}</p>
                        {item.cases && (
                          <p className="text-xs text-muted-foreground">{item.cases.case_number}</p>
                        )}
                      </div>
                      <span
                        className={
                          overdue
                            ? "shrink-0 text-sm font-semibold text-destructive"
                            : "shrink-0 text-sm text-muted-foreground"
                        }
                      >
                        {item.due_date ? formatDate(item.due_date) : "bez terminu"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckSquare className="size-4 text-muted-foreground" aria-hidden="true" />
              Moje zadania
              {overdueTasks.length > 0 && (
                <Badge variant="destructive" className="ml-1">
                  {overdueTasks.length} po terminie
                </Badge>
              )}
            </CardTitle>
            <Link
              href="/zadania"
              className="text-sm text-[var(--brand-gold-text)] underline-offset-4 hover:underline"
            >
              Wszystkie
            </Link>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <EmptyState
                icon={CheckSquare}
                title="Brak zadań"
                description="Nie masz przypisanych otwartych zadań."
                actionLabel="Przejdź do zadań"
                actionHref="/zadania"
              />
            ) : (
              <ul className="divide-y">
                {tasks.map((task) => {
                  const overdue = task.due_date != null && task.due_date < today;
                  return (
                    <li key={task.id} className="flex items-start justify-between gap-4 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{task.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {task.cases
                            ? `${task.cases.case_number} — ${task.cases.title}`
                            : "Bez sprawy"}
                          {task.priority !== "normalny" &&
                            ` · ${TASK_PRIORITY_LABELS[task.priority as TaskPriority]}`}
                        </p>
                      </div>
                      <span
                        className={
                          overdue
                            ? "shrink-0 text-xs font-semibold text-destructive"
                            : "shrink-0 text-xs text-muted-foreground"
                        }
                      >
                        {task.due_date ? formatDate(task.due_date) : "—"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="size-4 text-muted-foreground" aria-hidden="true" />
              Najbliższe terminy
            </CardTitle>
            <Link
              href="/kalendarz"
              className="text-sm text-[var(--brand-gold-text)] underline-offset-4 hover:underline"
            >
              Kalendarz
            </Link>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <EmptyState
                icon={Gavel}
                title="Brak nadchodzących terminów"
                description="W kalendarzu nie ma zaplanowanych rozpraw ani spotkań."
                actionLabel="Dodaj termin"
                actionHref="/kalendarz"
              />
            ) : (
              <ul className="divide-y">
                {events.map((event) => (
                  <li key={event.id} className="py-2.5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{event.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {EVENT_KIND_LABELS[event.event_kind as EventKind]}
                          {event.cases?.signature ? ` · ${event.cases.signature}` : ""}
                          {event.location ? ` · ${event.location}` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDateTime(event.starts_at)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {canLogTime && (
        <p className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="size-3.5" aria-hidden="true" />
          Wskazówka: klawisz <kbd className="rounded border px-1.5 py-0.5 font-mono">N</kbd> otwiera
          rejestrację czasu z dowolnego ekranu.
        </p>
      )}
    </>
  );
}
