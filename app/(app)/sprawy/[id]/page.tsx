import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CalendarClock, CheckSquare, Clock } from "lucide-react";
import { requireOrgContext } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { listCaseOptions, listClientOptions, listLawyers, listMembers } from "@/lib/queries";
import { formatGrosz } from "@/lib/money";
import { formatDate, formatDateTime, formatMinutesAsHours, todayInWarsaw } from "@/lib/time";
import { resolveBillingModel } from "@/lib/billing";
import {
  BILLING_MODEL_LABELS,
  CASE_STATUS_LABELS,
  CASE_TYPE_LABELS,
  EVENT_KIND_LABELS,
  TASK_KIND_LABELS,
  TASK_STATUS_LABELS,
  type BillingModel,
  type CaseStatus,
  type CaseType,
  type EventKind,
  type PartyRole,
  type TaskKind,
  type TaskStatus,
} from "@/lib/domain";
// Okno zakladania zadania z modulu zadan — uzywamy go tu ponownie, zamiast
// pisac drugi taki sam formularz.
import { TaskDialog } from "@/app/(app)/zadania/task-dialog";
import { DetailRow, EmptyState, PageHeader, StatTile } from "@/components/page-parts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CaseForm } from "../case-form";
import { NotesPanel } from "./notes-panel";
import { PartiesPanel } from "./parties-panel";
import { DocumentsPanel } from "./documents-panel";

export async function generateMetadata({ params }: PageProps<"/sprawy/[id]">): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("cases")
    .select("case_number, title")
    .eq("id", id)
    .maybeSingle();
  return { title: data ? `${data.case_number} — ${data.title}` : "Sprawa" };
}

export default async function CaseDetailPage({ params }: PageProps<"/sprawy/[id]">) {
  const context = await requireOrgContext();
  const { id } = await params;
  const supabase = await createServerSupabase();

  const { data: caseRecord } = await supabase
    .from("cases")
    .select("*, clients(id, name, default_billing_model, default_hourly_rate_grosz)")
    .eq("id", id)
    .maybeSingle();

  if (!caseRecord?.clients) notFound();

  const [members, caseOptions, partiesResult, notesResult, documentsResult, entriesResult, tasksResult, eventsResult] =
    await Promise.all([
      listMembers(context.organizationId),
      listCaseOptions(),
      supabase.from("case_parties").select("id, role, name, contact").eq("case_id", id).order("role"),
      supabase
        .from("case_notes")
        .select("id, occurred_on, content, author_id")
        .eq("case_id", id)
        .order("occurred_on", { ascending: false }),
      supabase
        .from("case_documents")
        .select("id, file_name, size_bytes, created_at, uploaded_by")
        .eq("case_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("time_entries")
        .select("id, work_date, minutes, description, billing_type, rate_snapshot_grosz, billable, locked_at, user_id")
        .eq("case_id", id)
        .order("work_date", { ascending: false })
        .limit(50),
      supabase
        .from("tasks")
        .select("id, title, status, due_date, task_kind, assignee_id")
        .eq("case_id", id)
        .order("due_date", { ascending: true, nullsFirst: false }),
      supabase
        .from("calendar_events")
        .select("id, title, event_kind, starts_at, location")
        .eq("case_id", id)
        .order("starts_at", { ascending: true }),
    ]);

  const memberName = new Map(members.map((member) => [member.userId, member.displayName]));
  const nameOf = (userId: string | null) => (userId ? (memberName.get(userId) ?? "—") : "—");

  const parties = partiesResult.data ?? [];
  const notes = notesResult.data ?? [];
  const documents = documentsResult.data ?? [];
  const entries = entriesResult.data ?? [];
  const tasks = tasksResult.data ?? [];
  const events = eventsResult.data ?? [];

  const client = caseRecord.clients;
  const effectiveModel = resolveBillingModel(
    caseRecord.billing_model,
    client.default_billing_model as BillingModel,
  );
  const effectiveRate = caseRecord.hourly_rate_grosz ?? client.default_hourly_rate_grosz;

  const totalMinutes = entries.reduce((sum, entry) => sum + entry.minutes, 0);
  const unbilledMinutes = entries
    .filter((entry) => entry.billable && entry.locked_at === null)
    .reduce((sum, entry) => sum + entry.minutes, 0);
  const openTasks = tasks.filter((task) => !["zrobione", "anulowane"].includes(task.status));

  const today = todayInWarsaw();
  const isLitigation = caseRecord.signature !== null || caseRecord.court_name !== null;

  return (
    <>
      <PageHeader
        title={`${caseRecord.case_number} — ${caseRecord.title}`}
        description={
          <>
            <Link href={`/klienci/${client.id}`} className="underline-offset-4 hover:underline">
              {client.name}
            </Link>
            {` · ${CASE_TYPE_LABELS[caseRecord.case_type as CaseType]}`}
            {caseRecord.signature ? ` · ${caseRecord.signature}` : ""}
          </>
        }
        actions={
          <Badge variant={caseRecord.status === "aktywna" ? "default" : "secondary"}>
            {CASE_STATUS_LABELS[caseRecord.status as CaseStatus]}
          </Badge>
        }
      />

      <Tabs defaultValue="przeglad">
        <TabsList>
          <TabsTrigger value="przeglad">Przegląd</TabsTrigger>
          {context.role !== "staff" && <TabsTrigger value="czas">Czas ({entries.length})</TabsTrigger>}
          <TabsTrigger value="zadania">Zadania ({openTasks.length})</TabsTrigger>
          <TabsTrigger value="kalendarz">Kalendarz ({events.length})</TabsTrigger>
          <TabsTrigger value="strony">Strony ({parties.length})</TabsTrigger>
          <TabsTrigger value="notatki">Notatki ({notes.length})</TabsTrigger>
          <TabsTrigger value="dokumenty">Dokumenty ({documents.length})</TabsTrigger>
          <TabsTrigger value="dane">Dane sprawy</TabsTrigger>
        </TabsList>

        {/* Przegląd ---------------------------------------------------- */}
        <TabsContent value="przeglad" className="mt-6 space-y-6">
          {context.role !== "staff" && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
              <StatTile label="Zarejestrowany czas" value={formatMinutesAsHours(totalMinutes)} />
              <StatTile
                label="Do zafakturowania"
                value={formatMinutesAsHours(unbilledMinutes)}
                hint="Czas jeszcze nieujęty na fakturze"
              />
              <StatTile label="Otwarte zadania" value={String(openTasks.length)} />
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Metryka sprawy</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="divide-y">
                  <DetailRow label="Numer">{caseRecord.case_number}</DetailRow>
                  <DetailRow label="Typ">
                    {CASE_TYPE_LABELS[caseRecord.case_type as CaseType]}
                  </DetailRow>
                  {isLitigation && (
                    <>
                      <DetailRow label="Sygnatura akt">{caseRecord.signature ?? "—"}</DetailRow>
                      <DetailRow label="Sąd / organ">{caseRecord.court_name ?? "—"}</DetailRow>
                      <DetailRow label="Wydział">{caseRecord.court_department ?? "—"}</DetailRow>
                    </>
                  )}
                  <DetailRow label="Prowadzący">{nameOf(caseRecord.lead_lawyer_id)}</DetailRow>
                  <DetailRow label="Otwarta">{formatDate(caseRecord.opened_at)}</DetailRow>
                  {caseRecord.closed_at && (
                    <DetailRow label="Zakończona">{formatDate(caseRecord.closed_at)}</DetailRow>
                  )}
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Rozliczenie</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="divide-y">
                  <DetailRow label="Model">
                    {BILLING_MODEL_LABELS[effectiveModel]}
                    {caseRecord.billing_model === null && (
                      <span className="ml-2 text-xs text-muted-foreground">(jak u klienta)</span>
                    )}
                  </DetailRow>
                  {context.canSeeFinances && effectiveModel !== "nieodplatny" && (
                    <DetailRow label="Stawka godzinowa">
                      {effectiveRate ? `${formatGrosz(effectiveRate)} / h` : "—"}
                    </DetailRow>
                  )}
                  {context.canSeeFinances && effectiveModel === "ryczalt" && (
                    <>
                      <DetailRow label="Kwota ryczałtu">
                        {caseRecord.flat_fee_grosz ? formatGrosz(caseRecord.flat_fee_grosz) : "—"}
                      </DetailRow>
                      <DetailRow label="Limit godzin">
                        {caseRecord.flat_fee_included_minutes
                          ? formatMinutesAsHours(caseRecord.flat_fee_included_minutes)
                          : "bez limitu"}
                      </DetailRow>
                    </>
                  )}
                </dl>

                {caseRecord.description && (
                  <div className="mt-4 rounded-md border bg-muted/40 px-3 py-2.5">
                    <p className="text-sm whitespace-pre-wrap">{caseRecord.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {parties.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Strony postępowania</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="divide-y">
                  {parties.map((party) => (
                    <DetailRow
                      key={party.id}
                      label={
                        {
                          powod: "Powód",
                          pozwany: "Pozwany",
                          uczestnik: "Uczestnik",
                          pelnomocnik_drugiej_strony: "Pełnomocnik drugiej strony",
                          inny: "Inny",
                        }[party.role as PartyRole]
                      }
                    >
                      {party.name}
                      {party.contact && (
                        <span className="block text-xs font-normal text-muted-foreground">
                          {party.contact}
                        </span>
                      )}
                    </DetailRow>
                  ))}
                </dl>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Czas -------------------------------------------------------- */}
        {context.role !== "staff" && (
          <TabsContent value="czas" className="mt-6">
            {entries.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="Brak wpisów czasu"
                description="Naciśnij N, aby zarejestrować czas przy tej sprawie."
              />
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Prawnik</TableHead>
                      <TableHead>Czynność</TableHead>
                      <TableHead>Rozliczenie</TableHead>
                      <TableHead className="text-right">Czas</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="tabular whitespace-nowrap">
                          {formatDate(entry.work_date)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {nameOf(entry.user_id)}
                        </TableCell>
                        <TableCell className="max-w-80">
                          <span className="block truncate">{entry.description}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {BILLING_MODEL_LABELS[entry.billing_type as BillingModel]}
                          </Badge>
                        </TableCell>
                        <TableCell className="tabular text-right">
                          {formatMinutesAsHours(entry.minutes)}
                        </TableCell>
                        <TableCell className="text-right">
                          {entry.locked_at ? (
                            <span className="text-xs text-muted-foreground">zafakturowany</span>
                          ) : entry.billable ? (
                            <span className="text-xs text-[var(--brand-gold-text)]">do rozliczenia</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">nieodpłatnie</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        )}

        {/* Zadania ----------------------------------------------------- */}
        <TabsContent value="zadania" className="mt-6 space-y-4">
          {/* Zadanie zakłada się tu od razu przypięte do tej sprawy — wcześniej
              trzeba było przejść do modułu zadań i wybrać ją ręcznie. */}
          <div className="flex justify-end">
            <TaskDialog
              cases={caseOptions}
              members={members}
              today={today}
              defaultCaseId={caseRecord.id}
            />
          </div>

          {tasks.length === 0 ? (
            <EmptyState
              icon={CheckSquare}
              title="Brak zadań"
              description="Załóż zadanie albo brak formalny — od razu przypisany do tej sprawy."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zadanie</TableHead>
                    <TableHead>Rodzaj</TableHead>
                    <TableHead>Odpowiedzialny</TableHead>
                    <TableHead>Termin</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => {
                    const overdue =
                      task.due_date !== null &&
                      task.due_date < today &&
                      !["zrobione", "anulowane"].includes(task.status);
                    return (
                      <TableRow key={task.id}>
                        <TableCell>{task.title}</TableCell>
                        <TableCell>
                          {task.task_kind === "brak_formalny" ? (
                            <Badge variant="destructive">
                              {TASK_KIND_LABELS[task.task_kind as TaskKind]}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">Zadanie</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {nameOf(task.assignee_id)}
                        </TableCell>
                        <TableCell
                          className={
                            overdue ? "tabular font-semibold text-destructive" : "tabular text-muted-foreground"
                          }
                        >
                          {task.due_date ? formatDate(task.due_date) : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {TASK_STATUS_LABELS[task.status as TaskStatus]}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Kalendarz --------------------------------------------------- */}
        <TabsContent value="kalendarz" className="mt-6">
          {events.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="Brak terminów"
              description="Dodaj rozprawę, posiedzenie lub termin procesowy w kalendarzu."
              actionLabel="Przejdź do kalendarza"
              actionHref="/kalendarz"
            />
          ) : (
            <ul className="divide-y rounded-lg border">
              {events.map((event) => (
                <li key={event.id} className="flex items-start justify-between gap-4 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{event.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {EVENT_KIND_LABELS[event.event_kind as EventKind]}
                      {event.location ? ` · ${event.location}` : ""}
                    </p>
                  </div>
                  <span className="tabular shrink-0 text-xs text-muted-foreground">
                    {formatDateTime(event.starts_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        {/* Strony ------------------------------------------------------ */}
        <TabsContent value="strony" className="mt-6">
          <PartiesPanel
            caseId={caseRecord.id}
            parties={parties.map((party) => ({
              id: party.id,
              role: party.role as PartyRole,
              name: party.name,
              contact: party.contact,
            }))}
          />
        </TabsContent>

        {/* Notatki ----------------------------------------------------- */}
        <TabsContent value="notatki" className="mt-6">
          <NotesPanel
            caseId={caseRecord.id}
            today={today}
            currentUserId={context.userId}
            notes={notes.map((note) => ({
              id: note.id,
              occurredOn: note.occurred_on,
              content: note.content,
              authorId: note.author_id,
              authorName: nameOf(note.author_id),
            }))}
          />
        </TabsContent>

        {/* Dokumenty --------------------------------------------------- */}
        <TabsContent value="dokumenty" className="mt-6">
          <DocumentsPanel
            caseId={caseRecord.id}
            documents={documents.map((document) => ({
              id: document.id,
              fileName: document.file_name,
              sizeBytes: document.size_bytes,
              createdAt: document.created_at,
              uploadedByName: nameOf(document.uploaded_by),
            }))}
          />
        </TabsContent>

        {/* Dane sprawy ------------------------------------------------- */}
        <TabsContent value="dane" className="mt-6">
          <Card className="max-w-3xl">
            <CardContent className="pt-6">
              <CaseForm
                clients={await listClientOptions()}
                lawyers={await listLawyers(context.organizationId)}
                clientBillingModel={client.default_billing_model as BillingModel}
                initial={{
                  id: caseRecord.id,
                  clientId: client.id,
                  title: caseRecord.title,
                  caseType: caseRecord.case_type as CaseType,
                  status: caseRecord.status as CaseStatus,
                  signature: caseRecord.signature ?? "",
                  courtName: caseRecord.court_name ?? "",
                  courtDepartment: caseRecord.court_department ?? "",
                  leadLawyerId: caseRecord.lead_lawyer_id ?? "",
                  billingModel: caseRecord.billing_model ?? "",
                  hourlyRate: caseRecord.hourly_rate_grosz
                    ? (caseRecord.hourly_rate_grosz / 100).toFixed(2).replace(".", ",")
                    : "",
                  flatFee: caseRecord.flat_fee_grosz
                    ? (caseRecord.flat_fee_grosz / 100).toFixed(2).replace(".", ",")
                    : "",
                  flatFeeIncluded: caseRecord.flat_fee_included_minutes
                    ? String(caseRecord.flat_fee_included_minutes / 60)
                    : "",
                  description: caseRecord.description ?? "",
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
