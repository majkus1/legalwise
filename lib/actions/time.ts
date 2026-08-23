"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { parseDurationToMinutes } from "@/lib/time";
import { BILLING_MODELS } from "@/lib/domain";

export interface ActionState {
  error?: string;
  message?: string;
}

const timeEntrySchema = z.object({
  caseId: z.string().uuid("Wybierz sprawę"),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Podaj poprawną datę"),
  duration: z.string().min(1, "Podaj czas"),
  description: z.string().trim().min(3, "Opisz wykonaną czynność").max(1000),
  billingType: z.enum(BILLING_MODELS),
});

/**
 * Rejestracja czasu pracy.
 *
 * Świadomie NIE przyjmujemy stawki z formularza — wypełnia ją trigger w bazie
 * na podstawie łańcucha sprawa → klient → prawnik. Dzięki temu stawki nie da
 * się podmienić z zewnątrz, a wpis dodany z pominięciem interfejsu również
 * będzie policzony poprawnie.
 */
export async function createTimeEntryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getOrgContext();
  if (!context) return { error: "Brak dostępu do kancelarii" };

  const parsed = timeEntrySchema.safeParse({
    caseId: formData.get("caseId"),
    workDate: formData.get("workDate"),
    duration: formData.get("duration"),
    description: formData.get("description"),
    billingType: formData.get("billingType"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" };
  }

  const minutes = parseDurationToMinutes(parsed.data.duration);
  if (minutes === null) {
    return { error: "Nie rozumiem zapisu czasu. Przyjmuję np. 1:30, 1,5 h, 90m albo 90." };
  }
  if (minutes <= 0 || minutes > 1440) {
    return { error: "Czas musi mieścić się w przedziale od 1 minuty do 24 godzin" };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.from("time_entries").insert({
    organization_id: context.organizationId,
    case_id: parsed.data.caseId,
    user_id: context.userId,
    work_date: parsed.data.workDate,
    minutes,
    description: parsed.data.description,
    billing_type: parsed.data.billingType,
  });

  if (error) {
    return { error: "Nie udało się zapisać wpisu. Sprawdź, czy masz dostęp do tej sprawy." };
  }

  revalidatePath("/czas");
  revalidatePath("/");
  return { message: "Zapisano wpis" };
}

const updateSchema = timeEntrySchema.extend({ id: z.string().uuid() });

export async function updateTimeEntryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getOrgContext();
  if (!context) return { error: "Brak dostępu do kancelarii" };

  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    caseId: formData.get("caseId"),
    workDate: formData.get("workDate"),
    duration: formData.get("duration"),
    description: formData.get("description"),
    billingType: formData.get("billingType"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" };
  }

  const minutes = parseDurationToMinutes(parsed.data.duration);
  if (minutes === null || minutes <= 0 || minutes > 1440) {
    return { error: "Nie rozumiem zapisu czasu" };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("time_entries")
    .update({
      case_id: parsed.data.caseId,
      work_date: parsed.data.workDate,
      minutes,
      description: parsed.data.description,
      billing_type: parsed.data.billingType,
    })
    .eq("id", parsed.data.id);

  if (error) {
    // Baza blokuje edycję wpisów powiązanych z zatwierdzoną fakturą.
    return {
      error: error.message.includes("zablokowany")
        ? "Ten wpis jest już rozliczony fakturą i nie można go zmienić"
        : "Nie udało się zapisać zmian",
    };
  }

  revalidatePath("/czas");
  return { message: "Zapisano zmiany" };
}

export async function deleteTimeEntryAction(formData: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;

  const supabase = await createServerSupabase();
  await supabase.from("time_entries").delete().eq("id", id.data);

  revalidatePath("/czas");
  revalidatePath("/");
}
