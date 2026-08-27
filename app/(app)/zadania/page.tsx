import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle, CheckSquare } from "lucide-react";
import { requireOrgContext } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { listCaseOptions, listMembers } from "@/lib/queries";
import { formatDate, todayInWarsaw } from "@/lib/time";
import { TASK_PRIORITY_LABELS, type TaskPriority } from "@/lib/domain";
import { setTaskStatusAction } from "@/lib/actions/tasks";
import {
  EmptyState,
  PageHeader,
  ScopeSwitch,
  StatTile,
} from "@/components/page-parts";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/button-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskDialog } from "./task-dialog";

export const metadata: Metadata = { title: "Zadania" };

const PRIORITY_VARIANT: Record<
  TaskPriority,
  "default" | "secondary" | "destructive"
> = {
  niski: "secondary",
  normalny: "secondary",
  wysoki: "default",
  pilny: "destructive",
};

export default async function TasksPage({
  searchParams,
}: PageProps<"/zadania">) {
  const context = await requireOrgContext();
  const params = await searchParams;
  const scope = params.zakres === "wszystkie" ? "wszystkie" : "moje";
  // Ten sam kłopot co przy sprawach: „Pokaż zrobione" nie mówiło, czy zrobione
  // dołączają do otwartych, czy je zastępują. Każda opcja nazywa teraz swój
  // zbiór wprost.
  const STANY = ["otwarte", "zrobione", "wszystkie"] as const;
  type Stan = (typeof STANY)[number];
  const stan: Stan = STANY.includes(params.stan as Stan)
    ? (params.stan as Stan)
    : "otwarte";

  const supabase = await createServerSupabase();
  let request = supabase
    .from("tasks")
    .select(
      "id, title, description, status, priority, task_kind, due_date, assignee_id, cases(id, case_number, title)",
    )
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(200);

  if (scope === "moje") request = request.eq("assignee_id", context.userId);
  if (stan === "otwarte")
    request = request.not("status", "in", "(zrobione,anulowane)");
  if (stan === "zrobione")
    request = request.in("status", ["zrobione", "anulowane"]);

  const [{ data: tasks }, cases, members] = await Promise.all([
    request,
    listCaseOptions(),
    listMembers(context.organizationId),
  ]);

  // Zmiana stanu nie może gubić wyboru „moje / cała kancelaria".
  const adresStanu = (nowy: Stan) => {
    const qs = new URLSearchParams();
    if (scope === "wszystkie") qs.set("zakres", "wszystkie");
    if (nowy !== "otwarte") qs.set("stan", nowy);
    const suffix = qs.toString();
    return suffix ? `/zadania?${suffix}` : "/zadania";
  };

  const rows = tasks ?? [];
  const today = todayInWarsaw();
  const memberName = new Map(
    members.map((member) => [member.userId, member.displayName]),
  );

  const deficiencies = rows.filter(
    (task) => task.task_kind === "brak_formalny",
  );
  const regular = rows.filter((task) => task.task_kind !== "brak_formalny");
  const overdue = rows.filter(
    (task) =>
      task.due_date !== null &&
      task.due_date < today &&
      !["zrobione", "anulowane"].includes(task.status),
  );

  function TaskRow({ task }: { task: (typeof rows)[number] }) {
    const isOverdue =
      task.due_date !== null &&
      task.due_date < today &&
      !["zrobione", "anulowane"].includes(task.status);
    const isDone = task.status === "zrobione";

    return (
      <li className="flex items-start gap-3 py-3">
        <form action={setTaskStatusAction} className="pt-0.5">
          <input type="hidden" name="id" value={task.id} />
          <input
            type="hidden"
            name="status"
            value={isDone ? "do_zrobienia" : "zrobione"}
          />
          {/* Ujemny margines powiększa obszar dotyku do 40 px, nie ruszając
              układu ani rozmiaru samego kwadracika. Bez tego cel miał 16 px,
              czyli mniej niż połowę tego, co da się trafić palcem. */}
          <button
            type="submit"
            aria-label={
              isDone
                ? `Cofnij wykonanie: ${task.title}`
                : `Odznacz jako zrobione: ${task.title}`
            }
            className="-m-3 flex items-center justify-center p-3 sm:m-0 sm:p-0"
          >
            <span
              className="flex size-4 items-center justify-center rounded border border-input transition-colors data-[done=true]:border-primary data-[done=true]:bg-primary"
              data-done={isDone}
            >
              {isDone && (
                <CheckSquare
                  className="size-3 text-primary-foreground"
                  aria-hidden="true"
                />
              )}
            </span>
          </button>
        </form>

        <div className="min-w-0 flex-1">
          <p
            className={
              isDone ? "text-sm text-muted-foreground line-through" : "text-sm"
            }
          >
            {task.title}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {task.cases ? (
              <Link
                href={`/sprawy/${task.cases.id}`}
                className="underline-offset-4 hover:underline"
              >
                {task.cases.case_number} — {task.cases.title}
              </Link>
            ) : (
              "Bez sprawy"
            )}
            {task.assignee_id
              ? ` · ${memberName.get(task.assignee_id) ?? "—"}`
              : " · nieprzypisane"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {task.priority !== "normalny" && (
            <Badge variant={PRIORITY_VARIANT[task.priority as TaskPriority]}>
              {TASK_PRIORITY_LABELS[task.priority as TaskPriority]}
            </Badge>
          )}
          <span
            className={
              isOverdue
                ? "tabular w-20 text-right text-xs font-semibold text-destructive"
                : "tabular w-20 text-right text-xs text-muted-foreground"
            }
          >
            {task.due_date ? formatDate(task.due_date) : "—"}
          </span>
        </div>
      </li>
    );
  }

  return (
    <>
      <PageHeader
        title="Zadania"
        description={
          scope === "moje" ? "Przypisane do Ciebie" : "Cała kancelaria"
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink
              href={scope === "moje" ? "/zadania?zakres=wszystkie" : "/zadania"}
              variant="outline"
              size="sm"
            >
              {scope === "moje" ? "Cała kancelaria" : "Tylko moje"}
            </ButtonLink>
            <ScopeSwitch
              label="Stan zadań"
              options={[
                {
                  href: adresStanu("otwarte"),
                  label: "Otwarte",
                  active: stan === "otwarte",
                },
                {
                  href: adresStanu("zrobione"),
                  label: "Zrobione",
                  active: stan === "zrobione",
                },
                {
                  href: adresStanu("wszystkie"),
                  label: "Wszystkie",
                  active: stan === "wszystkie",
                },
              ]}
            />
            <TaskDialog cases={cases} members={members} today={today} />
          </div>
        }
      />

      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatTile
          label="Otwarte"
          value={String(regular.length + deficiencies.length)}
        />
        <StatTile
          label="Po terminie"
          value={String(overdue.length)}
          tone={overdue.length > 0 ? "warning" : "default"}
        />
        <StatTile
          label="Braki formalne"
          value={String(deficiencies.length)}
          tone={deficiencies.length > 0 ? "warning" : "default"}
        />
      </section>

      {deficiencies.length > 0 && (
        <Card className="mb-6 border-[var(--warning)]/40 bg-[var(--warning)]/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle
                className="size-4 text-[var(--warning)]"
                aria-hidden="true"
              />
              Rejestr braków formalnych
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-2 text-xs text-muted-foreground">
              Braki mają terminy, których uchybienie niesie skutki procesowe —
              prowadzimy je osobno od zwykłych zadań.
            </p>
            <ul className="divide-y">
              {deficiencies.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Zadania</CardTitle>
        </CardHeader>
        <CardContent>
          {regular.length === 0 ? (
            <EmptyState
              icon={CheckSquare}
              title="Brak zadań"
              description={
                scope === "moje"
                  ? "Nie masz przypisanych otwartych zadań."
                  : "W kancelarii nie ma otwartych zadań."
              }
            />
          ) : (
            <ul className="divide-y">
              {regular.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
