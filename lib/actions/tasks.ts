"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { EVENT_KINDS, TASK_KINDS, TASK_PRIORITIES, TASK_STATUSES } from "@/lib/domain";
import { warsawLocalToUtc } from "@/lib/time";

export interface ActionState {
  error?: string;
  message?: string;
}

const optionalUuid = z
  .string()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .refine(
    (value) => value === null || z.string().uuid().safeParse(value).success,
    "Nieprawidłowy identyfikator",
  );

const optionalDate = z
  .string()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .refine(
    (value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value),
    "Podaj poprawną datę",
  );

const taskSchema = z.object({
  title: z.string().trim().min(3, "Podaj treść zadania").max(300),
  description: z.string().trim().max(2000).optional(),
  caseId: optionalUuid,
  assigneeId: optionalUuid,
  taskKind: z.enum(TASK_KINDS),
  priority: z.enum(TASK_PRIORITIES),
  dueDate: optionalDate,
});

export async function createTaskAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getOrgContext();
  if (!context) return { error: "Brak dostępu do kancelarii" };

  const parsed = taskSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? undefined,
    caseId: formData.get("caseId") ?? "",
    assigneeId: formData.get("assigneeId") ?? "",
    taskKind: formData.get("taskKind") ?? "zadanie",
    priority: formData.get("priority") ?? "normalny",
    dueDate: formData.get("dueDate") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" };
  }

  // Brak formalny bez terminu jest bezużyteczny — termin jest tu istotą rzeczy
  // i to samo ograniczenie egzekwuje baza.
  if (parsed.data.taskKind === "brak_formalny" && parsed.data.dueDate === null) {
    return { error: "Brak formalny wymaga podania terminu — to jego najważniejsza cecha" };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.from("tasks").insert({
    organization_id: context.organizationId,
    case_id: parsed.data.caseId,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    task_kind: parsed.data.taskKind,
    priority: parsed.data.priority,
    assignee_id: parsed.data.assigneeId,
    due_date: parsed.data.dueDate,
    created_by: context.userId,
  });

  if (error) {
    return { error: "Nie udało się zapisać zadania. Sprawdź, czy masz dostęp do wskazanej sprawy." };
  }

  revalidatePath("/zadania");
  revalidatePath("/");
  return { message: "Dodano zadanie" };
}

export async function setTaskStatusAction(formData: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(formData.get("id"));
  const status = z.enum(TASK_STATUSES).safeParse(formData.get("status"));
  if (!id.success || !status.success) return;

  const supabase = await createServerSupabase();
  await supabase.from("tasks").update({ status: status.data }).eq("id", id.data);

  revalidatePath("/zadania");
  revalidatePath("/");
}

export async function deleteTaskAction(formData: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;

  const supabase = await createServerSupabase();
  await supabase.from("tasks").delete().eq("id", id.data);

  revalidatePath("/zadania");
  revalidatePath("/");
}

// ---------------------------------------------------------------------------
// Kalendarz
// ---------------------------------------------------------------------------

const eventSchema = z.object({
  title: z.string().trim().min(3, "Podaj nazwę terminu").max(300),
  eventKind: z.enum(EVENT_KINDS),
  caseId: optionalUuid,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Podaj datę"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Podaj godzinę"),
  durationMinutes: z.coerce.number().int().min(0).max(24 * 60),
  location: z.string().trim().max(300).optional(),
  description: z.string().trim().max(2000).optional(),
  createTask: z.string().optional(),
});

export async function createCalendarEventAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getOrgContext();
  if (!context) return { error: "Brak dostępu do kancelarii" };

  const parsed = eventSchema.safeParse({
    title: formData.get("title"),
    eventKind: formData.get("eventKind") ?? "rozprawa",
    caseId: formData.get("caseId") ?? "",
    date: formData.get("date"),
    time: formData.get("time") ?? "09:00",
    durationMinutes: formData.get("durationMinutes") ?? 120,
    location: formData.get("location") ?? undefined,
    description: formData.get("description") ?? undefined,
    createTask: formData.get("createTask") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" };
  }

  // Datę i godzinę podaje użytkownik w czasie warszawskim; do bazy trafia
  // moment w UTC. Przesunięcie wyliczamy z faktycznej strefy, a nie ze stałej,
  // żeby zdarzenie nie skakało o godzinę przy zmianie czasu.
  const startsAt = warsawLocalToUtc(parsed.data.date, parsed.data.time);
  const endsAt =
    parsed.data.durationMinutes > 0
      ? new Date(startsAt.getTime() + parsed.data.durationMinutes * 60_000)
      : null;

  const supabase = await createServerSupabase();
  const { data: event, error } = await supabase
    .from("calendar_events")
    .insert({
      organization_id: context.organizationId,
      case_id: parsed.data.caseId,
      title: parsed.data.title,
      event_kind: parsed.data.eventKind,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt?.toISOString() ?? null,
      location: parsed.data.location ?? null,
      description: parsed.data.description ?? null,
      source: "manual",
      created_by: context.userId,
    })
    .select("id")
    .single();

  if (error) return { error: "Nie udało się zapisać terminu" };

  // Powiązane zadanie pozwala uniknąć wpisywania tego samego terminu dwa razy —
  // raz w kalendarzu i raz na liście zadań. O to prosił klient wprost.
  if (parsed.data.createTask === "on") {
    await supabase.from("tasks").insert({
      organization_id: context.organizationId,
      case_id: parsed.data.caseId,
      title: `Przygotowanie: ${parsed.data.title}`,
      task_kind: "zadanie",
      priority: "normalny",
      due_date: parsed.data.date,
      created_by: context.userId,
    });
  }

  void event;

  revalidatePath("/kalendarz");
  revalidatePath("/");
  return { message: "Dodano termin do kalendarza" };
}

export async function deleteCalendarEventAction(formData: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;

  const supabase = await createServerSupabase();
  await supabase.from("calendar_events").delete().eq("id", id.data);

  revalidatePath("/kalendarz");
  revalidatePath("/");
}

