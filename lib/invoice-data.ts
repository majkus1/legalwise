import { createServerSupabase } from "@/lib/supabase/server";
import { listMembers } from "@/lib/queries";
import { buildHourAnnex, resolveBillingModel, type AnnexCaseGroup, type BillableEntry, type CaseBillingConfig } from "@/lib/billing";
import { formatTaxId } from "@/lib/validation";
import type { BillingModel, InvoiceStatus, KsefStatus, PaymentMethod } from "@/lib/domain";
import { PAYMENT_METHOD_LABELS } from "@/lib/domain";
import type { InvoicePdfData, InvoicePdfLine } from "@/lib/pdf/invoice-document";
import type { AnnexPdfData } from "@/lib/pdf/annex-document";

/**
 * Komplet danych faktury potrzebny do wygenerowania dokumentów.
 *
 * Jedno miejsce dla PDF faktury, PDF zestawienia i pliku XML — dzięki temu
 * trzy dokumenty nigdy nie rozjadą się co do treści.
 */
export interface InvoiceBundle {
  id: string;
  number: string | null;
  status: InvoiceStatus;
  ksefStatus: KsefStatus;
  issueDate: string | null;
  saleDate: string | null;
  dueDate: string | null;
  paymentMethod: PaymentMethod;
  periodFrom: string | null;
  periodTo: string | null;
  currency: string;
  notes: string | null;
  totals: { netGrosz: number; vatGrosz: number; grossGrosz: number };
  seller: {
    name: string;
    taxId: string | null;
    address: string | null;
    bankAccount: string | null;
    addressLine1: string;
    addressLine2: string;
  };
  buyer: {
    name: string;
    taxId: string | null;
    address: string | null;
    addressLine1: string;
    addressLine2: string;
  };
  lines: InvoicePdfLine[];
  annex: AnnexCaseGroup[];
  annexTotals: {
    totalMinutes: number;
    billableMinutes: number;
    proBonoMinutes: number;
    totalNetGrosz: number;
  };
}

function joinAddress(parts: (string | null | undefined)[]): string {
  return parts.filter((part) => part && part.trim() !== "").join(", ");
}

/**
 * Wczytuje fakturę wraz z pozycjami i powiązaną ewidencją czasu.
 *
 * Zapytania idą przez klienta z sesją użytkownika, więc obowiązuje RLS —
 * osoba bez wglądu w finanse nie otrzyma tu żadnych danych.
 */
export async function loadInvoiceBundle(
  invoiceId: string,
  organizationId: string,
): Promise<InvoiceBundle | null> {
  const supabase = await createServerSupabase();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, clients(name, tax_id, address_line1, address_line2, postal_code, city)")
    .eq("id", invoiceId)
    .maybeSingle();

  if (!invoice?.clients) return null;

  const [{ data: items }, { data: organization }, { data: entries }, members] = await Promise.all([
    supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("position"),
    supabase
      .from("organizations")
      .select("name, legal_name, tax_id, address_line1, address_line2, postal_code, city, bank_account")
      .eq("id", organizationId)
      .single(),
    supabase
      .from("time_entries")
      .select("id, case_id, user_id, work_date, minutes, description, billing_type, rate_snapshot_grosz, billable, cases(case_number, title, billing_model, flat_fee_grosz, flat_fee_included_minutes, clients(default_billing_model))")
      .eq("invoice_id", invoiceId)
      .order("work_date"),
    listMembers(organizationId),
  ]);

  const lawyerNames = Object.fromEntries(members.map((member) => [member.userId, member.displayName]));

  // Konfiguracje spraw odtwarzamy z wpisów czasu powiązanych z fakturą —
  // to dokładnie te sprawy, których dotyczy zestawienie.
  const configMap = new Map<string, CaseBillingConfig>();
  const billableEntries: BillableEntry[] = [];

  for (const row of entries ?? []) {
    if (!row.cases) continue;

    if (!configMap.has(row.case_id)) {
      configMap.set(row.case_id, {
        caseId: row.case_id,
        caseNumber: row.cases.case_number,
        title: row.cases.title,
        billingModel: resolveBillingModel(
          row.cases.billing_model,
          (row.cases.clients?.default_billing_model ?? "godzinowy") as BillingModel,
        ),
        flatFeeGrosz: row.cases.flat_fee_grosz,
        flatFeeIncludedMinutes: row.cases.flat_fee_included_minutes,
      });
    }

    billableEntries.push({
      id: row.id,
      caseId: row.case_id,
      userId: row.user_id,
      workDate: row.work_date,
      minutes: row.minutes,
      description: row.description,
      billingType: row.billing_type as BillingModel,
      rateSnapshotGrosz: row.rate_snapshot_grosz,
      billable: row.billable,
    });
  }

  const annex = buildHourAnnex({
    cases: [...configMap.values()].sort((a, b) => a.caseNumber.localeCompare(b.caseNumber)),
    entries: billableEntries,
    lawyerNames,
  });

  // Dane stron: zatwierdzona faktura ma migawkę utrwaloną przy zatwierdzeniu,
  // szkic pokazuje stan bieżący.
  const sellerName =
    invoice.seller_name ?? organization?.legal_name ?? organization?.name ?? "Kancelaria";
  const sellerAddress =
    invoice.seller_address ??
    joinAddress([
      organization?.address_line1,
      organization?.address_line2,
      joinAddress([organization?.postal_code, organization?.city].filter(Boolean)).replace(", ", " "),
    ]);

  const buyerAddress =
    invoice.buyer_address ??
    joinAddress([
      invoice.clients.address_line1,
      invoice.clients.address_line2,
      [invoice.clients.postal_code, invoice.clients.city].filter(Boolean).join(" "),
    ]);

  return {
    id: invoice.id,
    number: invoice.number,
    status: invoice.status as InvoiceStatus,
    ksefStatus: invoice.ksef_status as KsefStatus,
    issueDate: invoice.issue_date,
    saleDate: invoice.sale_date,
    dueDate: invoice.due_date,
    paymentMethod: invoice.payment_method as PaymentMethod,
    periodFrom: invoice.period_from,
    periodTo: invoice.period_to,
    currency: invoice.currency,
    notes: invoice.notes,
    totals: {
      netGrosz: invoice.total_net_grosz,
      vatGrosz: invoice.total_vat_grosz,
      grossGrosz: invoice.total_gross_grosz,
    },
    seller: {
      name: sellerName,
      taxId: invoice.seller_tax_id ?? organization?.tax_id ?? null,
      address: sellerAddress || null,
      bankAccount: invoice.seller_bank_account ?? organization?.bank_account ?? null,
      addressLine1: organization?.address_line1 ?? "",
      addressLine2: [organization?.postal_code, organization?.city].filter(Boolean).join(" "),
    },
    buyer: {
      name: invoice.buyer_name ?? invoice.clients.name,
      taxId: invoice.buyer_tax_id ?? invoice.clients.tax_id,
      address: buyerAddress || null,
      addressLine1: invoice.clients.address_line1 ?? "",
      addressLine2: [invoice.clients.postal_code, invoice.clients.city].filter(Boolean).join(" "),
    },
    lines: (items ?? []).map((item) => ({
      position: item.position,
      description: item.description,
      quantity: Number(item.quantity),
      unit: item.unit,
      unitPriceNetGrosz: item.unit_price_net_grosz,
      netGrosz: item.net_grosz,
      vatRate: Number(item.vat_rate),
      vatGrosz: item.vat_grosz,
      grossGrosz: item.gross_grosz,
    })),
    annex,
    annexTotals: {
      totalMinutes: annex.reduce((sum, group) => sum + group.totalMinutes, 0),
      billableMinutes: annex.reduce((sum, group) => sum + group.billableMinutes, 0),
      proBonoMinutes: annex.reduce((sum, group) => sum + group.proBonoMinutes, 0),
      totalNetGrosz: annex.reduce((sum, group) => sum + group.totalNetGrosz, 0),
    },
  };
}

/**
 * Adnotacja o statusie wobec KSeF.
 *
 * Umieszczana wprost na fakturze. Dokument, który nie trafił do KSeF, nie jest
 * fakturą ustrukturyzowaną — przemilczenie tego wprowadzałoby odbiorcę w błąd.
 */
export function ksefNotice(bundle: InvoiceBundle): string | null {
  if (bundle.ksefStatus === "accepted") return null;
  if (bundle.status === "draft") {
    return "Dokument roboczy — projekt faktury. Nie stanowi dowodu księgowego.";
  }
  return "Dokument nie został jeszcze przesłany do Krajowego Systemu e-Faktur.";
}

export function toInvoicePdfData(bundle: InvoiceBundle): InvoicePdfData {
  return {
    number: bundle.number ?? "PROJEKT",
    issueDate: bundle.issueDate ?? new Date().toISOString().slice(0, 10),
    saleDate: bundle.saleDate,
    dueDate: bundle.dueDate,
    paymentMethod: PAYMENT_METHOD_LABELS[bundle.paymentMethod],
    periodFrom: bundle.periodFrom,
    periodTo: bundle.periodTo,
    sellerName: bundle.seller.name,
    sellerTaxId: bundle.seller.taxId ? formatTaxId(bundle.seller.taxId) : null,
    sellerAddress: bundle.seller.address,
    sellerBankAccount: bundle.seller.bankAccount,
    buyerName: bundle.buyer.name,
    buyerTaxId: bundle.buyer.taxId ? formatTaxId(bundle.buyer.taxId) : null,
    buyerAddress: bundle.buyer.address,
    lines: bundle.lines,
    totalNetGrosz: bundle.totals.netGrosz,
    totalVatGrosz: bundle.totals.vatGrosz,
    totalGrossGrosz: bundle.totals.grossGrosz,
    notes: bundle.notes,
    ksefNotice: ksefNotice(bundle),
  };
}

export function toAnnexPdfData(bundle: InvoiceBundle): AnnexPdfData {
  return {
    invoiceNumber: bundle.number ?? "PROJEKT",
    sellerName: bundle.seller.name,
    sellerTaxId: bundle.seller.taxId ? formatTaxId(bundle.seller.taxId) : null,
    buyerName: bundle.buyer.name,
    periodFrom: bundle.periodFrom,
    periodTo: bundle.periodTo,
    groups: bundle.annex,
    ...bundle.annexTotals,
  };
}
