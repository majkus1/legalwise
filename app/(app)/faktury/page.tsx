import Link from "next/link";
import type { Metadata } from "next";
import { FileText, Plus } from "lucide-react";
import { requireFinanceContext } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatGrosz } from "@/lib/money";
import { formatDate, todayInWarsaw } from "@/lib/time";
import {
  INVOICE_STATUS_LABELS,
  KSEF_STATUS_LABELS,
  type InvoiceStatus,
  type KsefStatus,
} from "@/lib/domain";
import { EmptyState, PageHeader, StatTile } from "@/components/page-parts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "Faktury" };

const STATUS_VARIANT: Record<InvoiceStatus, "default" | "secondary" | "destructive"> = {
  draft: "secondary",
  approved: "default",
  sent: "default",
  paid: "default",
  anulowana: "destructive",
};

export default async function InvoicesPage() {
  await requireFinanceContext();
  const supabase = await createServerSupabase();
  const today = todayInWarsaw();

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, number, status, ksef_status, issue_date, due_date, paid_at, total_gross_grosz, period_from, period_to, clients(name)")
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = invoices ?? [];
  const drafts = rows.filter((row) => row.status === "draft");
  const unpaid = rows.filter((row) => ["approved", "sent"].includes(row.status));
  const overdue = unpaid.filter((row) => row.due_date !== null && row.due_date < today);
  const unpaidTotal = unpaid.reduce((sum, row) => sum + row.total_gross_grosz, 0);

  return (
    <>
      <PageHeader
        title="Faktury"
        description={`${rows.length} ${rows.length === 1 ? "dokument" : "dokumentów"}`}
        actions={
          <Button render={<Link href="/rozliczenia" />} className="gap-2">
            <Plus className="size-4" aria-hidden="true" />
            Zamknij okres
          </Button>
        }
      />

      <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Szkice" value={String(drafts.length)} hint="Projekty do zatwierdzenia" />
        <StatTile label="Nieopłacone" value={String(unpaid.length)} />
        <StatTile
          label="Po terminie"
          value={String(overdue.length)}
          tone={overdue.length > 0 ? "warning" : "default"}
        />
        <StatTile label="Do zapłaty" value={formatGrosz(unpaidTotal)} hint="Brutto, faktury nieopłacone" />
      </section>

      {rows.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Brak faktur"
          description="Zamknij okres rozliczeniowy, aby utworzyć pierwszy projekt faktury z zarejestrowanych godzin."
          actionLabel="Zamknij okres"
          actionHref="/rozliczenia"
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numer</TableHead>
                <TableHead>Klient</TableHead>
                <TableHead>Okres</TableHead>
                <TableHead>Wystawiona</TableHead>
                <TableHead>Termin</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>KSeF</TableHead>
                <TableHead className="text-right">Brutto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((invoice) => {
                const isOverdue =
                  ["approved", "sent"].includes(invoice.status) &&
                  invoice.due_date !== null &&
                  invoice.due_date < today;

                return (
                  <TableRow key={invoice.id}>
                    <TableCell className="tabular whitespace-nowrap">
                      <Link
                        href={`/faktury/${invoice.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {invoice.number ?? "szkic"}
                      </Link>
                    </TableCell>
                    <TableCell>{invoice.clients?.name ?? "—"}</TableCell>
                    <TableCell className="tabular whitespace-nowrap text-muted-foreground">
                      {invoice.period_from && invoice.period_to
                        ? `${formatDate(invoice.period_from)} – ${formatDate(invoice.period_to)}`
                        : "—"}
                    </TableCell>
                    <TableCell className="tabular whitespace-nowrap text-muted-foreground">
                      {invoice.issue_date ? formatDate(invoice.issue_date) : "—"}
                    </TableCell>
                    <TableCell
                      className={
                        isOverdue
                          ? "tabular whitespace-nowrap font-semibold text-destructive"
                          : "tabular whitespace-nowrap text-muted-foreground"
                      }
                    >
                      {invoice.due_date ? formatDate(invoice.due_date) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[invoice.status as InvoiceStatus]}>
                        {INVOICE_STATUS_LABELS[invoice.status as InvoiceStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {KSEF_STATUS_LABELS[invoice.ksef_status as KsefStatus]}
                    </TableCell>
                    <TableCell className="tabular text-right font-medium">
                      {formatGrosz(invoice.total_gross_grosz)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
