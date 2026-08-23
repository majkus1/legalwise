"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { parseAmountToGrosz } from "@/lib/money";
import { isValidTaxId, normalizeTaxId } from "@/lib/validation";
import { ORG_ROLES } from "@/lib/domain";

export interface ActionState {
  error?: string;
  message?: string;
}

/**
 * Nadanie lub zmiana roli po adresie e-mail.
 *
 * Jedyna droga wejścia do kancelarii. Tabela organization_members nie przyjmuje
 * zapisów od zalogowanego użytkownika — całą operację wykonuje RPC, które
 * sprawdza uprawnienia i zapisuje ślad w dzienniku audytu.
 */
export async function setMemberRoleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getOrgContext();
  if (!context) return { error: "Brak dostępu do kancelarii" };

  const parsed = z
    .object({
      email: z.string().trim().email("Podaj poprawny adres e-mail"),
      role: z.enum(ORG_ROLES),
    })
    .safeParse({ email: formData.get("email"), role: formData.get("role") });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("set_member_role", {
    p_org: context.organizationId,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  });

  if (error) {
    // Komunikaty z bazy są pisane pod użytkownika, więc podajemy je wprost —
    // np. informację, że osoba musi najpierw założyć konto.
    return { error: error.message };
  }

  revalidatePath("/ustawienia");
  return { message: `Nadano dostęp: ${parsed.data.email}` };
}

export async function deactivateMemberAction(formData: FormData): Promise<void> {
  const context = await getOrgContext();
  if (!context) return;

  const email = z.string().email().safeParse(formData.get("email"));
  if (!email.success) return;

  const supabase = await createServerSupabase();
  await supabase.rpc("deactivate_member", {
    p_org: context.organizationId,
    p_email: email.data,
  });

  revalidatePath("/ustawienia");
}

export async function setMemberRateAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getOrgContext();
  if (!context) return { error: "Brak dostępu do kancelarii" };
  if (!context.canManageOrganization) return { error: "Stawki ustala właściciel kancelarii" };

  const userId = z.string().uuid().safeParse(formData.get("userId"));
  if (!userId.success) return { error: "Nieprawidłowy użytkownik" };

  const rateGrosz = parseAmountToGrosz(String(formData.get("rate") ?? ""));
  if (rateGrosz === null || rateGrosz < 0) {
    return { error: "Stawka musi być kwotą, np. 450" };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.from("member_rates").upsert(
    {
      organization_id: context.organizationId,
      user_id: userId.data,
      default_hourly_rate_grosz: rateGrosz,
    },
    { onConflict: "organization_id,user_id" },
  );

  if (error) return { error: "Nie udało się zapisać stawki" };

  revalidatePath("/ustawienia");
  return { message: "Zapisano stawkę" };
}

const organizationSchema = z.object({
  name: z.string().trim().min(2, "Podaj nazwę kancelarii").max(200),
  legalName: z.string().trim().max(300).optional(),
  taxId: z.string().trim().optional(),
  addressLine1: z.string().trim().max(200).optional(),
  postalCode: z.string().trim().max(20).optional(),
  city: z.string().trim().max(100).optional(),
  bankAccount: z.string().trim().max(50).optional(),
  email: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(50).optional(),
  invoiceNumberPattern: z.string().trim().min(1).max(50),
  defaultVatRate: z.coerce.number().min(0).max(100),
  defaultPaymentDays: z.coerce.number().int().min(0).max(180),
});

export async function updateOrganizationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getOrgContext();
  if (!context) return { error: "Brak dostępu do kancelarii" };
  if (!context.canManageOrganization) return { error: "Dane kancelarii zmienia właściciel" };

  const parsed = organizationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" };
  }

  if (parsed.data.taxId && !isValidTaxId(parsed.data.taxId)) {
    return { error: "Numer NIP kancelarii jest niepoprawny — sprawdź cyfrę kontrolną" };
  }

  // Wzorzec numeru musi zawierać {nr}, inaczej wszystkie faktury dostałyby
  // ten sam numer i naruszyłyby ograniczenie unikalności przy drugiej z rzędu.
  if (!parsed.data.invoiceNumberPattern.includes("{nr}")) {
    return { error: "Wzorzec numeru faktury musi zawierać {nr}" };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("organizations")
    .update({
      name: parsed.data.name,
      legal_name: parsed.data.legalName || null,
      tax_id: parsed.data.taxId ? normalizeTaxId(parsed.data.taxId) : null,
      address_line1: parsed.data.addressLine1 || null,
      postal_code: parsed.data.postalCode || null,
      city: parsed.data.city || null,
      bank_account: parsed.data.bankAccount || null,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      invoice_number_pattern: parsed.data.invoiceNumberPattern,
      default_vat_rate: parsed.data.defaultVatRate,
      default_payment_days: parsed.data.defaultPaymentDays,
    })
    .eq("id", context.organizationId);

  if (error) return { error: "Nie udało się zapisać danych kancelarii" };

  revalidatePath("/ustawienia");
  return { message: "Zapisano dane kancelarii" };
}
