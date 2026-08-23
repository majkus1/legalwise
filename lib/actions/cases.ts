"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { parseAmountToGrosz } from "@/lib/money";
import { parseDurationToMinutes } from "@/lib/time";
import { BILLING_MODELS, CASE_STATUSES, CASE_TYPES, PARTY_ROLES } from "@/lib/domain";

export interface ActionState {
  error?: string;
  message?: string;
}

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable();

const caseSchema = z.object({
  clientId: z.string().uuid("Wybierz klienta"),
  title: z.string().trim().min(3, "Podaj nazwę sprawy").max(300),
  caseType: z.enum(CASE_TYPES),
  status: z.enum(CASE_STATUSES),
  signature: optionalText,
  courtName: optionalText,
  courtDepartment: optionalText,
  leadLawyerId: optionalText,
  billingModel: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .refine(
      (value) => value === null || (BILLING_MODELS as readonly string[]).includes(value),
      "Nieznany model rozliczenia",
    ),
  hourlyRate: z.string().trim(),
  flatFee: z.string().trim(),
  flatFeeIncluded: z.string().trim(),
  description: optionalText,
});

function parseForm(formData: FormData) {
  return caseSchema.safeParse({
    clientId: formData.get("clientId"),
    title: formData.get("title"),
    caseType: formData.get("caseType"),
    status: formData.get("status") ?? "aktywna",
    signature: formData.get("signature"),
    courtName: formData.get("courtName"),
    courtDepartment: formData.get("courtDepartment"),
    leadLawyerId: formData.get("leadLawyerId"),
    billingModel: formData.get("billingModel") ?? "",
    hourlyRate: formData.get("hourlyRate") ?? "",
    flatFee: formData.get("flatFee") ?? "",
    flatFeeIncluded: formData.get("flatFeeIncluded") ?? "",
    description: formData.get("description"),
  });
}

function buildRow(data: z.infer<typeof caseSchema>) {
  const hourlyRateGrosz = data.hourlyRate === "" ? null : parseAmountToGrosz(data.hourlyRate);
  if (data.hourlyRate !== "" && (hourlyRateGrosz === null || hourlyRateGrosz < 0)) {
    return { error: "Stawka godzinowa musi być kwotą, np. 450" } as const;
  }

  const flatFeeGrosz = data.flatFee === "" ? null : parseAmountToGrosz(data.flatFee);
  if (data.flatFee !== "" && (flatFeeGrosz === null || flatFeeGrosz < 0)) {
    return { error: "Kwota ryczałtu musi być kwotą, np. 5000" } as const;
  }

  // Limit godzin wliczonych w ryczałt przyjmujemy w tym samym zapisie
  // co czas pracy — „10”, „10h”, „10:00” znaczą to samo.
  const includedMinutes =
    data.flatFeeIncluded === ""
      ? null
      : (parseDurationToMinutes(data.flatFeeIncluded) ??
        (/^\d+$/.test(data.flatFeeIncluded) ? Number(data.flatFeeIncluded) * 60 : null));

  if (data.flatFeeIncluded !== "" && includedMinutes === null) {
    return { error: "Limit godzin w ryczałcie podaj jako liczbę godzin, np. 20" } as const;
  }

  if (data.billingModel === "ryczalt" && (flatFeeGrosz === null || flatFeeGrosz === 0)) {
    return { error: "Przy ryczałcie podaj kwotę ryczałtu" } as const;
  }

  return {
    row: {
      client_id: data.clientId,
      title: data.title,
      case_type: data.caseType,
      status: data.status,
      signature: data.signature,
      court_name: data.courtName,
      court_department: data.courtDepartment,
      lead_lawyer_id: data.leadLawyerId,
      billing_model: data.billingModel as "godzinowy" | "ryczalt" | "nieodplatny" | null,
      hourly_rate_grosz: hourlyRateGrosz,
      flat_fee_grosz: flatFeeGrosz,
      flat_fee_included_minutes: includedMinutes,
      description: data.description,
    },
  } as const;
}

export async function createCaseAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getOrgContext();
  if (!context) return { error: "Brak dostępu do kancelarii" };

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" };
  }

  const built = buildRow(parsed.data);
  if ("error" in built) return { error: built.error };

  const supabase = await createServerSupabase();

  // Numer nadaje baza — dwie osoby zakładające sprawę równocześnie nie mogą
  // dostać tego samego numeru.
  const { data: caseNumber, error: numberError } = await supabase.rpc("next_case_number", {
    p_org: context.organizationId,
  });
  if (numberError || !caseNumber) {
    return { error: "Nie udało się nadać numeru sprawy" };
  }

  const { data, error } = await supabase
    .from("cases")
    .insert({
      ...built.row,
      organization_id: context.organizationId,
      case_number: caseNumber,
      created_by: context.userId,
    })
    .select("id")
    .single();

  if (error) return { error: "Nie udało się utworzyć sprawy" };

  await supabase.rpc("log_audit", {
    p_org: context.organizationId,
    p_action: "case.create",
    p_entity: "case",
    p_entity_id: data.id,
    p_metadata: { case_number: caseNumber, title: parsed.data.title },
  });

  revalidatePath("/sprawy");
  redirect(`/sprawy/${data.id}`);
}

export async function updateCaseAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getOrgContext();
  if (!context) return { error: "Brak dostępu do kancelarii" };

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Nieprawidłowy identyfikator sprawy" };

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" };
  }

  const built = buildRow(parsed.data);
  if ("error" in built) return { error: built.error };

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("cases")
    .update({
      ...built.row,
      closed_at: parsed.data.status === "zakonczona" ? new Date().toISOString().slice(0, 10) : null,
    })
    .eq("id", id.data);

  if (error) return { error: "Nie udało się zapisać zmian" };

  revalidatePath(`/sprawy/${id.data}`);
  revalidatePath("/sprawy");
  return { message: "Zapisano dane sprawy" };
}

// ---------------------------------------------------------------------------
// Strony postępowania
// ---------------------------------------------------------------------------

export async function addCasePartyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getOrgContext();
  if (!context) return { error: "Brak dostępu do kancelarii" };

  const parsed = z
    .object({
      caseId: z.string().uuid(),
      role: z.enum(PARTY_ROLES),
      name: z.string().trim().min(2, "Podaj oznaczenie strony").max(300),
      contact: optionalText,
    })
    .safeParse({
      caseId: formData.get("caseId"),
      role: formData.get("role"),
      name: formData.get("name"),
      contact: formData.get("contact"),
    });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.from("case_parties").insert({
    organization_id: context.organizationId,
    case_id: parsed.data.caseId,
    role: parsed.data.role,
    name: parsed.data.name,
    contact: parsed.data.contact,
  });

  if (error) return { error: "Nie udało się dodać strony" };

  revalidatePath(`/sprawy/${parsed.data.caseId}`);
  return { message: "Dodano stronę postępowania" };
}

export async function removeCasePartyAction(formData: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(formData.get("id"));
  const caseId = z.string().uuid().safeParse(formData.get("caseId"));
  if (!id.success || !caseId.success) return;

  const supabase = await createServerSupabase();
  await supabase.from("case_parties").delete().eq("id", id.data);

  revalidatePath(`/sprawy/${caseId.data}`);
}

// ---------------------------------------------------------------------------
// Notatki ze zdarzeń
// ---------------------------------------------------------------------------

export async function addCaseNoteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getOrgContext();
  if (!context) return { error: "Brak dostępu do kancelarii" };

  const parsed = z
    .object({
      caseId: z.string().uuid(),
      occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Podaj poprawną datę"),
      content: z.string().trim().min(3, "Treść notatki jest za krótka").max(5000),
    })
    .safeParse({
      caseId: formData.get("caseId"),
      occurredOn: formData.get("occurredOn"),
      content: formData.get("content"),
    });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.from("case_notes").insert({
    organization_id: context.organizationId,
    case_id: parsed.data.caseId,
    author_id: context.userId,
    occurred_on: parsed.data.occurredOn,
    content: parsed.data.content,
  });

  if (error) return { error: "Nie udało się zapisać notatki" };

  revalidatePath(`/sprawy/${parsed.data.caseId}`);
  return { message: "Zapisano notatkę" };
}

export async function deleteCaseNoteAction(formData: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(formData.get("id"));
  const caseId = z.string().uuid().safeParse(formData.get("caseId"));
  if (!id.success || !caseId.success) return;

  const supabase = await createServerSupabase();
  // Polityka RLS przepuści usunięcie wyłącznie autorowi notatki.
  await supabase.from("case_notes").delete().eq("id", id.data);

  revalidatePath(`/sprawy/${caseId.data}`);
}

// ---------------------------------------------------------------------------
// Zespół przy sprawie
// ---------------------------------------------------------------------------

export async function setCaseAssigneesAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getOrgContext();
  if (!context) return { error: "Brak dostępu do kancelarii" };
  if (!context.canSeeFinances) {
    return { error: "Skład zespołu przy sprawie zmienia właściciel lub partner" };
  }

  const caseId = z.string().uuid().safeParse(formData.get("caseId"));
  if (!caseId.success) return { error: "Nieprawidłowy identyfikator sprawy" };

  const userIds = formData
    .getAll("userIds")
    .filter((value): value is string => typeof value === "string")
    .filter((value) => z.string().uuid().safeParse(value).success);

  const supabase = await createServerSupabase();

  // Prościej i pewniej odtworzyć listę od zera niż wyliczać różnicę —
  // przy zespole rzędu kilku osób koszt jest bez znaczenia.
  await supabase.from("case_assignees").delete().eq("case_id", caseId.data);

  if (userIds.length > 0) {
    const { error } = await supabase.from("case_assignees").insert(
      userIds.map((userId) => ({
        organization_id: context.organizationId,
        case_id: caseId.data,
        user_id: userId,
        assignment_role: "member" as const,
      })),
    );
    if (error) return { error: "Nie udało się zapisać zespołu" };
  }

  revalidatePath(`/sprawy/${caseId.data}`);
  return { message: "Zapisano zespół przy sprawie" };
}
