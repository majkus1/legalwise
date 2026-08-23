"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";

export interface ActionState {
  error?: string;
  message?: string;
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.rpc("mark_all_notifications_read");

  revalidatePath("/powiadomienia");
  revalidatePath("/", "layout");
}

export async function markNotificationReadAction(formData: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;

  const supabase = await createServerSupabase();
  await supabase
    .from("user_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id.data);

  revalidatePath("/powiadomienia");
  revalidatePath("/", "layout");
}

const preferencesSchema = z.object({
  digestEnabled: z.string().optional(),
  includeDeadlines: z.string().optional(),
  includeDeficiencies: z.string().optional(),
  includeTasks: z.string().optional(),
  includeBilling: z.string().optional(),
  notifyTaskAssigned: z.string().optional(),
  notifyCaseAssigned: z.string().optional(),
  notifyDeadlines: z.string().optional(),
  emailEnabled: z.string().optional(),
});

/** Pole wyboru nieobecne w formularzu oznacza wartość wyłączoną. */
const checked = (value: string | undefined) => value === "on";

export async function updateNotificationPreferencesAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getOrgContext();
  if (!context) return { error: "Brak dostępu do kancelarii" };

  const parsed = preferencesSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Nieprawidłowe dane" };

  const supabase = await createServerSupabase();
  const { error } = await supabase.from("notification_preferences").upsert(
    {
      organization_id: context.organizationId,
      user_id: context.userId,
      digest_enabled: checked(parsed.data.digestEnabled),
      include_deadlines: checked(parsed.data.includeDeadlines),
      include_deficiencies: checked(parsed.data.includeDeficiencies),
      include_tasks: checked(parsed.data.includeTasks),
      include_billing: checked(parsed.data.includeBilling),
      notify_task_assigned: checked(parsed.data.notifyTaskAssigned),
      notify_case_assigned: checked(parsed.data.notifyCaseAssigned),
      notify_deadlines: checked(parsed.data.notifyDeadlines),
      email_enabled: checked(parsed.data.emailEnabled),
    },
    { onConflict: "organization_id,user_id" },
  );

  if (error) return { error: "Nie udało się zapisać ustawień" };

  revalidatePath("/powiadomienia");
  return { message: "Zapisano ustawienia powiadomień" };
}
