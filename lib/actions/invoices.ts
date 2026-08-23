"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth";
import { buildInvoiceDraft, type BillableEntry, type CaseBillingConfig } from "@/lib/billing";
import { resolveBillingModel } from "@/lib/billing";
import type { BillingModel } from "@/lib/domain";

export interface ActionState {
  error?: string;
  message?: string;
}

const periodSchema = z.object({
  clientId: z.string().uuid("Wybierz klienta"),
  periodFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Podaj początek okresu"),
  periodTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Podaj koniec okresu"),
});

/**
 * Zbiera dane potrzebne do wyceny okresu.
 *
 * Wspólne dla podglądu w kreatorze i dla utworzenia projektu faktury —
 * dzięki temu to, co użytkownik widzi przed zatwierdzeniem, jest liczone
 * dokładnie tym samym kodem co to, co trafi na fakturę.
 */
async function collectPeriodData(clientId: string, periodFrom: string, periodTo: string) {
  const supabase = await createServerSupabase();

  const { data: cases } = await supabase
    .from("cases")
    .select("id, case_number, title, billing_model, flat_fee_grosz, flat_fee_included_minutes, clients(default_billing_model)")
    .eq("client_id", clientId);

  if (!cases || cases.length === 0) {
    return { configs: [] as CaseBillingConfig[], entries: [] as BillableEntry[] };
  }

  const caseIds = cases.map((row) => row.id);

  // Bierzemy wyłącznie wpisy jeszcze niepowiązane z żadną fakturą.
  const { data: entries } = await supabase
    .from("time_entries")
    .select("id, case_id, user_id, work_date, minutes, description, billing_type, rate_snapshot_grosz, billable")
    .in("case_id", caseIds)
    .is("invoice_id", null)
    .gte("work_date", periodFrom)
    .lte("work_date", periodTo)
    .order("work_date");

  const configs: CaseBillingConfig[] = cases.map((row) => ({
    caseId: row.id,
    caseNumber: row.case_number,
    title: row.title,
    billingModel: resolveBillingModel(
      row.billing_model,
      (row.clients?.default_billing_model ?? "godzinowy") as BillingModel,
    ),
    flatFeeGrosz: row.flat_fee_grosz,
    flatFeeIncludedMinutes: row.flat_fee_included_minutes,
  }));

  const billable: BillableEntry[] = (entries ?? []).map((row) => ({
    id: row.id,
    caseId: row.case_id,
    userId: row.user_id,
    workDate: row.work_date,
    minutes: row.minutes,
    description: row.description,
    billingType: row.billing_type as BillingModel,
    rateSnapshotGrosz: row.rate_snapshot_grosz,
    billable: row.billable,
  }));

  return { configs, entries: billable };
}

/**
 * Tworzy projekt faktury z niezafakturowanych godzin za wybrany okres.
 *
 * To jest operacja, która zastępuje ręczne przepisywanie danych z arkusza
 * kalkulacyjnego przy miesięcznym zamykaniu okresu. Faktura powstaje jako
 * SZKIC — numer zostanie nadany dopiero przy zatwierdzeniu.
 */
export async function createInvoiceDraftAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getOrgContext();
  if (!context) return { error: "Brak dostępu do kancelarii" };
  if (!context.canSeeFinances) return { error: "Brak uprawnień do wystawiania faktur" };

  const parsed = periodSchema.safeParse({
    clientId: formData.get("clientId"),
    periodFrom: formData.get("periodFrom"),
    periodTo: formData.get("periodTo"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" };
  }

  if (parsed.data.periodTo < parsed.data.periodFrom) {
    return { error: "Koniec okresu nie może być wcześniejszy niż jego początek" };
  }

  const supabase = await createServerSupabase();
  const { data: organization } = await supabase
    .from("organizations")
    .select("default_vat_rate, default_payment_days")
    .eq("id", context.organizationId)
    .single();

  const vatRate = Number(organization?.default_vat_rate ?? 23);

  const { configs, entries } = await collectPeriodData(
    parsed.data.clientId,
    parsed.data.periodFrom,
    parsed.data.periodTo,
  );

  const draft = buildInvoiceDraft({ cases: configs, entries, vatRate });

  if (draft.lines.length === 0) {
    return {
      error:
        "W tym okresie nie ma nic do zafakturowania. Sprawdź, czy godziny zostały zarejestrowane i czy nie trafiły już na inną fakturę.",
    };
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      organization_id: context.organizationId,
      client_id: parsed.data.clientId,
      status: "draft",
      period_from: parsed.data.periodFrom,
      period_to: parsed.data.periodTo,
      currency: "PLN",
      created_by: context.userId,
    })
    .select("id")
    .single();

  if (invoiceError || !invoice) return { error: "Nie udało się utworzyć projektu faktury" };

  const { error: itemsError } = await supabase.from("invoice_items").insert(
    draft.lines.map((line, index) => ({
      organization_id: context.organizationId,
      invoice_id: invoice.id,
      case_id: line.caseId,
      position: index + 1,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      unit_price_net_grosz: line.unitPriceNetGrosz,
      vat_rate: line.vatRate,
    })),
  );

  if (itemsError) {
    // Faktura bez pozycji jest bezużyteczna — sprzątamy, zamiast zostawiać śmieć.
    await supabase.from("invoices").delete().eq("id", invoice.id);
    return { error: "Nie udało się zapisać pozycji faktury" };
  }

  // Powiązanie wpisów czasu z fakturą. Na tej podstawie powstaje załącznik
  // godzinowy, a przy zatwierdzeniu wpisy zostaną zablokowane.
  if (draft.linkedEntryIds.length > 0) {
    await supabase
      .from("time_entries")
      .update({ invoice_id: invoice.id })
      .in("id", draft.linkedEntryIds);
  }

  await supabase.rpc("log_audit", {
    p_org: context.organizationId,
    p_action: "invoice.draft_create",
    p_entity: "invoice",
    p_entity_id: invoice.id,
    p_metadata: {
      period_from: parsed.data.periodFrom,
      period_to: parsed.data.periodTo,
      lines: draft.lines.length,
      total_gross_grosz: draft.totals.grossGrosz,
    },
  });

  revalidatePath("/faktury");
  redirect(`/faktury/${invoice.id}`);
}

export async function approveInvoiceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Nieprawidłowy identyfikator faktury" };

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("approve_invoice", { p_invoice: id.data });

  if (error) return { error: error.message };

  revalidatePath("/faktury");
  revalidatePath(`/faktury/${id.data}`);
  revalidatePath("/czas");
  return { message: "Faktura zatwierdzona i ponumerowana" };
}

export async function cancelInvoiceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Nieprawidłowy identyfikator faktury" };

  const reason = String(formData.get("reason") ?? "").trim();

  const supabase = await createServerSupabase();
  // Parametr o wartości domyślnej pomijamy, zamiast przekazywać null —
  // tak oczekuje wygenerowany typ RPC.
  const { error } = await supabase.rpc("cancel_invoice", {
    p_invoice: id.data,
    ...(reason === "" ? {} : { p_reason: reason }),
  });

  if (error) return { error: error.message };

  revalidatePath("/faktury");
  revalidatePath(`/faktury/${id.data}`);
  revalidatePath("/czas");
  return { message: "Faktura anulowana, godziny wróciły do rozliczenia" };
}

export async function markInvoicePaidAction(formData: FormData): Promise<void> {
  const context = await getOrgContext();
  if (!context?.canSeeFinances) return;

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;

  const supabase = await createServerSupabase();
  await supabase
    .from("invoices")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", id.data);

  await supabase.rpc("log_audit", {
    p_org: context.organizationId,
    p_action: "invoice.mark_paid",
    p_entity: "invoice",
    p_entity_id: id.data,
    p_metadata: {},
  });

  revalidatePath("/faktury");
  revalidatePath(`/faktury/${id.data}`);
}

export async function deleteInvoiceDraftAction(formData: FormData): Promise<void> {
  const context = await getOrgContext();
  if (!context?.canSeeFinances) return;

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;

  const supabase = await createServerSupabase();

  // Odpinamy wpisy czasu, żeby wróciły do puli niezafakturowanych.
  await supabase.from("time_entries").update({ invoice_id: null }).eq("invoice_id", id.data);
  // Baza pozwala usunąć wyłącznie szkic — zatwierdzona faktura ma numer
  // i musi zostać w ewidencji, nawet jeśli została anulowana.
  await supabase.from("invoices").delete().eq("id", id.data).eq("status", "draft");

  revalidatePath("/faktury");
  redirect("/faktury");
}

/** Podgląd wyceny okresu — bez zapisywania czegokolwiek. */
export async function previewPeriodAction(
  clientId: string,
  periodFrom: string,
  periodTo: string,
): Promise<{
  lines: { description: string; quantity: number; unit: string; netGrosz: number }[];
  totalNetGrosz: number;
  totalGrossGrosz: number;
  entryCount: number;
  error?: string;
}> {
  const context = await getOrgContext();
  const empty = { lines: [], totalNetGrosz: 0, totalGrossGrosz: 0, entryCount: 0 };

  if (!context?.canSeeFinances) return { ...empty, error: "Brak uprawnień" };

  const parsed = periodSchema.safeParse({ clientId, periodFrom, periodTo });
  if (!parsed.success) return { ...empty, error: "Nieprawidłowy okres" };

  const supabase = await createServerSupabase();
  const { data: organization } = await supabase
    .from("organizations")
    .select("default_vat_rate")
    .eq("id", context.organizationId)
    .single();

  const { configs, entries } = await collectPeriodData(clientId, periodFrom, periodTo);
  const draft = buildInvoiceDraft({
    cases: configs,
    entries,
    vatRate: Number(organization?.default_vat_rate ?? 23),
  });

  return {
    lines: draft.lines.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      netGrosz: line.amounts.netGrosz,
    })),
    totalNetGrosz: draft.totals.netGrosz,
    totalGrossGrosz: draft.totals.grossGrosz,
    entryCount: entries.length,
  };
}
