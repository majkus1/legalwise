import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Download, FileCode2, FileText, Info } from "lucide-react";
import { requireFinanceContext } from "@/lib/auth";
import { loadInvoiceBundle, ksefNotice } from "@/lib/invoice-data";
import { formatGrosz } from "@/lib/money";
import { formatDate, formatMinutesAsHours } from "@/lib/time";
import { formatTaxId } from "@/lib/validation";
import {
  INVOICE_STATUS_LABELS,
  KSEF_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/domain";
import { DetailRow, PageHeader } from "@/components/page-parts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InvoiceActions } from "./invoice-actions";

export async function generateMetadata({ params }: PageProps<"/faktury/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Faktura ${id.slice(0, 8)}` };
}

export default async function InvoiceDetailPage({ params }: PageProps<"/faktury/[id]">) {
  const context = await requireFinanceContext();
  const { id } = await params;

  const bundle = await loadInvoiceBundle(id, context.organizationId);
  if (!bundle) notFound();

  const isDraft = bundle.status === "draft";
  const notice = ksefNotice(bundle);

  return (
    <>
      <PageHeader
        title={bundle.number ?? "Projekt faktury"}
        description={
          <>
            {bundle.buyer.name}
            {bundle.periodFrom && bundle.periodTo
              ? ` · okres ${formatDate(bundle.periodFrom)} – ${formatDate(bundle.periodTo)}`
              : ""}
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={isDraft ? "secondary" : "default"}>
              {INVOICE_STATUS_LABELS[bundle.status]}
            </Badge>
            <InvoiceActions
              invoiceId={bundle.id}
              status={bundle.status}
              ksefAccepted={bundle.ksefStatus === "accepted"}
            />
          </div>
        }
      />

      {notice && (
        <p className="mb-6 flex items-start gap-2 rounded-md border border-[var(--brand-gold)]/40 bg-[var(--brand-gold)]/10 px-4 py-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-[var(--brand-gold-text)]" aria-hidden="true" />
          <span>{notice}</span>
        </p>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        <Button
          render={<a href={`/faktury/${bundle.id}/pdf`} target="_blank" rel="noreferrer" />}
          variant="outline"
          className="gap-2"
        >
          <FileText className="size-4" aria-hidden="true" />
          PDF faktury
        </Button>
        <Button
          render={<a href={`/faktury/${bundle.id}/zestawienie`} target="_blank" rel="noreferrer" />}
          variant="outline"
          className="gap-2"
        >
          <Download className="size-4" aria-hidden="true" />
          Zestawienie godzin
        </Button>
        {!isDraft && (
          <>
            <Button
              render={
                <a href={`/faktury/${bundle.id}/xml?podglad=1`} target="_blank" rel="noreferrer" />
              }
              variant="outline"
              className="gap-2"
            >
              <FileCode2 className="size-4" aria-hidden="true" />
              Podgląd XML FA(3)
            </Button>
            <Button
              render={<a href={`/faktury/${bundle.id}/xml`} />}
              variant="ghost"
              className="gap-2"
            >
              Pobierz XML
            </Button>
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pozycje faktury</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">Lp.</TableHead>
                    <TableHead>Nazwa usługi</TableHead>
                    <TableHead className="text-right">Ilość</TableHead>
                    <TableHead className="text-right">Cena netto</TableHead>
                    <TableHead className="text-right">Netto</TableHead>
                    <TableHead className="text-right">VAT</TableHead>
                    <TableHead className="text-right">Brutto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bundle.lines.map((line) => (
                    <TableRow key={line.position}>
                      <TableCell className="tabular">{line.position}</TableCell>
                      <TableCell>{line.description}</TableCell>
                      <TableCell className="tabular text-right whitespace-nowrap">
                        {new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 }).format(
                          line.quantity,
                        )}{" "}
                        {line.unit}
                      </TableCell>
                      <TableCell className="tabular text-right">
                        {formatGrosz(line.unitPriceNetGrosz)}
                      </TableCell>
                      <TableCell className="tabular text-right">
                        {formatGrosz(line.netGrosz)}
                      </TableCell>
                      <TableCell className="tabular text-right text-muted-foreground">
                        {line.vatRate}%
                      </TableCell>
                      <TableCell className="tabular text-right font-medium">
                        {formatGrosz(line.grossGrosz)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex flex-col items-end gap-1 text-sm">
              <div className="flex w-64 justify-between">
                <span className="text-muted-foreground">Razem netto</span>
                <span className="tabular">{formatGrosz(bundle.totals.netGrosz)}</span>
              </div>
              <div className="flex w-64 justify-between">
                <span className="text-muted-foreground">Podatek VAT</span>
                <span className="tabular">{formatGrosz(bundle.totals.vatGrosz)}</span>
              </div>
              <div className="flex w-64 justify-between border-t pt-1.5">
                <span className="font-medium">Do zapłaty</span>
                <span className="tabular font-heading text-lg font-semibold">
                  {formatGrosz(bundle.totals.grossGrosz)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Dokument</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y">
                <DetailRow label="Status">{INVOICE_STATUS_LABELS[bundle.status]}</DetailRow>
                <DetailRow label="Wystawiona">
                  {bundle.issueDate ? formatDate(bundle.issueDate) : "—"}
                </DetailRow>
                <DetailRow label="Data sprzedaży">
                  {bundle.saleDate ? formatDate(bundle.saleDate) : "—"}
                </DetailRow>
                <DetailRow label="Termin płatności">
                  {bundle.dueDate ? formatDate(bundle.dueDate) : "—"}
                </DetailRow>
                <DetailRow label="Forma płatności">
                  {PAYMENT_METHOD_LABELS[bundle.paymentMethod]}
                </DetailRow>
                <DetailRow label="KSeF">{KSEF_STATUS_LABELS[bundle.ksefStatus]}</DetailRow>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Nabywca</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y">
                <DetailRow label="Nazwa">{bundle.buyer.name}</DetailRow>
                <DetailRow label="NIP">
                  {bundle.buyer.taxId ? formatTaxId(bundle.buyer.taxId) : "—"}
                </DetailRow>
                <DetailRow label="Adres">{bundle.buyer.address ?? "—"}</DetailRow>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Podstawa rozliczenia</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y">
                <DetailRow label="Czas łącznie">
                  {formatMinutesAsHours(bundle.annexTotals.totalMinutes)}
                </DetailRow>
                <DetailRow label="W tym rozliczane">
                  {formatMinutesAsHours(bundle.annexTotals.billableMinutes)}
                </DetailRow>
                <DetailRow label="W tym nieodpłatnie">
                  {formatMinutesAsHours(bundle.annexTotals.proBonoMinutes)}
                </DetailRow>
                <DetailRow label="Spraw">{String(bundle.annex.length)}</DetailRow>
              </dl>
              <p className="mt-3 text-xs text-muted-foreground">
                Szczegółowy wykaz czynności znajduje się w zestawieniu godzin przekazywanym
                klientowi razem z fakturą.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        <Link href="/faktury" className="underline-offset-4 hover:underline">
          ← Wróć do listy faktur
        </Link>
      </p>
    </>
  );
}
