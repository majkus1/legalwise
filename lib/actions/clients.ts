"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { parseAmountToGrosz } from "@/lib/money";
import { isValidTaxId, normalizeTaxId } from "@/lib/validation";
import { BILLING_MODELS, CLIENT_TYPES } from "@/lib/domain";

export interface ActionState {
  error?: string;
  message?: string;
}

/** Puste pole formularza to brak wartości, a nie pusty tekst w bazie. */
const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable();

const clientSchema = z.object({
  name: z.string().trim().min(2, "Podaj nazwę klienta").max(200),
  clientType: z.enum(CLIENT_TYPES),
  taxId: optionalText,
  addressLine1: optionalText,
  postalCode: optionalText,
  city: optionalText,
  email: optionalText,
  billingEmail: optionalText,
  phone: optionalText,
  defaultBillingModel: z.enum(BILLING_MODELS),
  defaultHourlyRate: z.string().trim(),
  notes: optionalText,
});

function parseForm(formData: FormData) {
  return clientSchema.safeParse({
    name: formData.get("name"),
    clientType: formData.get("clientType"),
    taxId: formData.get("taxId"),
    addressLine1: formData.get("addressLine1"),
    postalCode: formData.get("postalCode"),
    city: formData.get("city"),
    email: formData.get("email"),
    billingEmail: formData.get("billingEmail"),
    phone: formData.get("phone"),
    defaultBillingModel: formData.get("defaultBillingModel"),
    defaultHourlyRate: formData.get("defaultHourlyRate") ?? "",
  notes: formData.get("notes"),
  });
}

/**
 * Wspólna walidacja pól, które wymagają czegoś więcej niż sprawdzenia typu.
 * Zwraca komunikat błędu albo gotowe wartości.
 */
function validateBusinessRules(data: z.infer<typeof clientSchema>) {
  // NIP trafia na fakturę i do struktury FA(3). Literówka oznacza dokument
  // odrzucony przez KSeF albo wystawiony na cudzy podmiot.
  if (data.taxId && !isValidTaxId(data.taxId)) {
    return { error: "Numer NIP jest niepoprawny — sprawdź cyfrę kontrolną" } as const;
  }

  const rateInput = data.defaultHourlyRate.trim();
  let rateGrosz: number | null = null;
  if (rateInput !== "") {
    rateGrosz = parseAmountToGrosz(rateInput);
    if (rateGrosz === null || rateGrosz < 0) {
      return { error: "Stawka godzinowa musi być kwotą, np. 450 albo 450,00" } as const;
    }
  }

  if (data.defaultBillingModel === "godzinowy" && rateGrosz === null) {
    return {
      error:
        "Przy rozliczeniu godzinowym podaj stawkę domyślną — inaczej wpisy czasu policzą się po zero złotych",
    } as const;
  }

  return { rateGrosz } as const;
}

function toRow(data: z.infer<typeof clientSchema>, rateGrosz: number | null) {
  return {
    name: data.name,
    client_type: data.clientType,
    tax_id: data.taxId ? normalizeTaxId(data.taxId) : null,
    address_line1: data.addressLine1,
    postal_code: data.postalCode,
    city: data.city,
    email: data.email,
    billing_email: data.billingEmail ?? data.email,
    phone: data.phone,
    default_billing_model: data.defaultBillingModel,
    default_hourly_rate_grosz: rateGrosz,
    notes: data.notes,
  };
}

export async function createClientAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getOrgContext();
  if (!context) return { error: "Brak dostępu do kancelarii" };

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" };
  }

  const checked = validateBusinessRules(parsed.data);
  if ("error" in checked) return { error: checked.error };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("clients")
    .insert({
      ...toRow(parsed.data, checked.rateGrosz),
      organization_id: context.organizationId,
      relationship_owner_id: context.userId,
    })
    .select("id")
    .single();

  if (error) return { error: "Nie udało się zapisać klienta" };

  await supabase.rpc("log_audit", {
    p_org: context.organizationId,
    p_action: "client.create",
    p_entity: "client",
    p_entity_id: data.id,
    p_metadata: { name: parsed.data.name },
  });

  revalidatePath("/klienci");
  redirect(`/klienci/${data.id}`);
}

export async function updateClientAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getOrgContext();
  if (!context) return { error: "Brak dostępu do kancelarii" };

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Nieprawidłowy identyfikator klienta" };

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" };
  }

  const checked = validateBusinessRules(parsed.data);
  if ("error" in checked) return { error: checked.error };

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("clients")
    .update(toRow(parsed.data, checked.rateGrosz))
    .eq("id", id.data);

  if (error) return { error: "Nie udało się zapisać zmian" };

  revalidatePath("/klienci");
  revalidatePath(`/klienci/${id.data}`);
  return { message: "Zapisano dane klienta" };
}

/**
 * Archiwizacja zamiast usunięcia.
 *
 * Klient jest powiązany ze sprawami, wpisami czasu i fakturami — twarde
 * usunięcie zerwałoby spójność dokumentacji, która podlega retencji.
 */
export async function archiveClientAction(formData: FormData): Promise<void> {
  const context = await getOrgContext();
  if (!context) return;

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;

  const supabase = await createServerSupabase();
  await supabase
    .from("clients")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id.data);

  await supabase.rpc("log_audit", {
    p_org: context.organizationId,
    p_action: "client.archive",
    p_entity: "client",
    p_entity_id: id.data,
    p_metadata: {},
  });

  revalidatePath("/klienci");
  redirect("/klienci");
}
