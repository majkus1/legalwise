import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Briefcase, Plus } from "lucide-react";
import { requireOrgContext } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatGrosz } from "@/lib/money";
import { formatDate } from "@/lib/time";
import { formatTaxId } from "@/lib/validation";
import {
  BILLING_MODEL_LABELS,
  CASE_STATUS_LABELS,
  CASE_TYPE_LABELS,
  CLIENT_TYPE_LABELS,
  INVOICE_STATUS_LABELS,
  type BillingModel,
  type CaseStatus,
  type CaseType,
  type ClientType,
  type InvoiceStatus,
} from "@/lib/domain";
import { DetailRow, EmptyState, PageHeader } from "@/components/page-parts";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/button-link";
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
import { ClientForm } from "../client-form";

export async function generateMetadata({ params }: PageProps<"/klienci/[id]">): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("clients").select("name").eq("id", id).maybeSingle();
  return { title: data?.name ?? "Klient" };
}

export default async function ClientDetailPage({ params }: PageProps<"/klienci/[id]">) {
  const context = await requireOrgContext();
  const { id } = await params;
  const supabase = await createServerSupabase();

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!client) notFound();

  const [{ data: cases }, invoicesResult] = await Promise.all([
    supabase
      .from("cases")
      .select("id, case_number, title, case_type, status, signature, opened_at")
      .eq("client_id", id)
      .is("archived_at", null)
      .order("case_number", { ascending: false }),
    context.canSeeFinances
      ? supabase
          .from("invoices")
          .select("id, number, status, issue_date, total_gross_grosz")
          .eq("client_id", id)
          .order("issue_date", { ascending: false, nullsFirst: false })
          .limit(10)
      : Promise.resolve({ data: null }),
  ]);

  const caseRows = cases ?? [];
  const invoices = invoicesResult.data ?? [];

  return (
    <>
      <PageHeader
        title={client.name}
        description={`${CLIENT_TYPE_LABELS[client.client_type as ClientType]}${client.city ? ` · ${client.city}` : ""}`}
        actions={
          <ButtonLink href={`/sprawy/nowa?klient=${client.id}`} className="gap-2">
            <Plus className="size-4" aria-hidden="true" />
            Nowa sprawa
          </ButtonLink>
        }
      />

      <Tabs defaultValue="przeglad">
        <TabsList>
          <TabsTrigger value="przeglad">Przegląd</TabsTrigger>
          <TabsTrigger value="sprawy">Sprawy ({caseRows.length})</TabsTrigger>
          {context.canSeeFinances && <TabsTrigger value="faktury">Faktury</TabsTrigger>}
          <TabsTrigger value="dane">Dane i warunki</TabsTrigger>
        </TabsList>

        <TabsContent value="przeglad" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Dane identyfikacyjne</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="divide-y">
                  <DetailRow label="Nazwa">{client.name}</DetailRow>
                  <DetailRow label="Typ">
                    {CLIENT_TYPE_LABELS[client.client_type as ClientType]}
                  </DetailRow>
                  <DetailRow label="NIP">
                    {client.tax_id ? (
                      <span className="tabular">{formatTaxId(client.tax_id)}</span>
                    ) : (
                      "—"
                    )}
                  </DetailRow>
                  <DetailRow label="Adres">
                    {[client.address_line1, [client.postal_code, client.city].filter(Boolean).join(" ")]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </DetailRow>
                  <DetailRow label="E-mail">{client.email ?? "—"}</DetailRow>
                  <DetailRow label="Telefon">{client.phone ?? "—"}</DetailRow>
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Warunki rozliczeń</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="divide-y">
                  <DetailRow label="Model domyślny">
                    {BILLING_MODEL_LABELS[client.default_billing_model as BillingModel]}
                  </DetailRow>
                  {context.canSeeFinances && (
                    <DetailRow label="Stawka domyślna">
                      {client.default_hourly_rate_grosz
                        ? `${formatGrosz(client.default_hourly_rate_grosz)} / h`
                        : "—"}
                    </DetailRow>
                  )}
                  <DetailRow label="E-mail do faktur">
                    {client.billing_email ?? client.email ?? "—"}
                  </DetailRow>
                </dl>

                {client.notes && (
                  <div className="mt-4 rounded-md border bg-muted/40 px-3 py-2.5">
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      Notatki wewnętrzne
                    </p>
                    <p className="text-sm whitespace-pre-wrap">{client.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sprawy" className="mt-6">
          {caseRows.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="Brak spraw"
              description="Ten klient nie ma jeszcze założonej żadnej sprawy."
              actionLabel="Załóż sprawę"
              actionHref={`/sprawy/nowa?klient=${client.id}`}
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numer</TableHead>
                    <TableHead>Nazwa</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead>Sygnatura</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Otwarta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {caseRows.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="tabular">
                        <Link
                          href={`/sprawy/${item.id}`}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {item.case_number}
                        </Link>
                      </TableCell>
                      <TableCell>{item.title}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {CASE_TYPE_LABELS[item.case_type as CaseType]}
                      </TableCell>
                      <TableCell className="tabular text-muted-foreground">
                        {item.signature ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.status === "aktywna" ? "default" : "secondary"}>
                          {CASE_STATUS_LABELS[item.status as CaseStatus]}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular text-muted-foreground">
                        {formatDate(item.opened_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {context.canSeeFinances && (
          <TabsContent value="faktury" className="mt-6">
            {invoices.length === 0 ? (
              <EmptyState
                title="Brak faktur"
                description="Dla tego klienta nie wystawiono jeszcze żadnej faktury."
                actionLabel="Przejdź do rozliczeń"
                actionHref="/rozliczenia"
              />
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Numer</TableHead>
                      <TableHead>Wystawiona</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Brutto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="tabular">
                          <Link
                            href={`/faktury/${invoice.id}`}
                            className="font-medium underline-offset-4 hover:underline"
                          >
                            {invoice.number ?? "szkic"}
                          </Link>
                        </TableCell>
                        <TableCell className="tabular text-muted-foreground">
                          {invoice.issue_date ? formatDate(invoice.issue_date) : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {INVOICE_STATUS_LABELS[invoice.status as InvoiceStatus]}
                          </Badge>
                        </TableCell>
                        <TableCell className="tabular text-right">
                          {formatGrosz(invoice.total_gross_grosz)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        )}

        <TabsContent value="dane" className="mt-6">
          <Card className="max-w-3xl">
            <CardContent className="pt-6">
              <ClientForm
                initial={{
                  id: client.id,
                  name: client.name,
                  clientType: client.client_type as ClientType,
                  taxId: client.tax_id ?? "",
                  addressLine1: client.address_line1 ?? "",
                  postalCode: client.postal_code ?? "",
                  city: client.city ?? "",
                  email: client.email ?? "",
                  billingEmail: client.billing_email ?? "",
                  phone: client.phone ?? "",
                  defaultBillingModel: client.default_billing_model as BillingModel,
                  defaultHourlyRate: client.default_hourly_rate_grosz
                    ? (client.default_hourly_rate_grosz / 100).toFixed(2).replace(".", ",")
                    : "",
                  notes: client.notes ?? "",
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
