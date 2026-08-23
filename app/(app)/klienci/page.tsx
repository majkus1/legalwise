import Link from "next/link";
import type { Metadata } from "next";
import { Plus, Search, Users } from "lucide-react";
import { requireOrgContext } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatGrosz } from "@/lib/money";
import { formatTaxId } from "@/lib/validation";
import { BILLING_MODEL_LABELS, CLIENT_TYPE_LABELS, type BillingModel, type ClientType } from "@/lib/domain";
import { EmptyState, PageHeader } from "@/components/page-parts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "Klienci" };

export default async function ClientsPage({ searchParams }: PageProps<"/klienci">) {
  const context = await requireOrgContext();
  const params = await searchParams;
  const query = typeof params.szukaj === "string" ? params.szukaj.trim() : "";

  const supabase = await createServerSupabase();
  let request = supabase
    .from("clients")
    .select("id, name, client_type, tax_id, city, default_billing_model, default_hourly_rate_grosz, cases(count)")
    .is("archived_at", null)
    .order("name");

  if (query !== "") {
    // Wyszukiwanie po nazwie i NIP — dwa najczęstsze sposoby szukania klienta.
    request = request.or(`name.ilike.%${query}%,tax_id.ilike.%${query}%`);
  }

  const { data: clients } = await request;
  const rows = clients ?? [];

  return (
    <>
      <PageHeader
        title="Klienci"
        description={`${rows.length} ${rows.length === 1 ? "klient" : "klientów"} w kartotece`}
        actions={
          <Button render={<Link href="/klienci/nowy" />} className="gap-2">
            <Plus className="size-4" aria-hidden="true" />
            Dodaj klienta
          </Button>
        }
      />

      <form className="mb-6 flex max-w-md items-center gap-2">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            name="szukaj"
            defaultValue={query}
            placeholder="Szukaj po nazwie lub NIP"
            className="pl-9"
            aria-label="Szukaj klienta"
          />
        </div>
        <Button type="submit" variant="outline">
          Szukaj
        </Button>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title={query ? "Brak wyników" : "Kartoteka jest pusta"}
          description={
            query
              ? `Żaden klient nie pasuje do zapytania „${query}”.`
              : "Dodaj pierwszego klienta, aby zacząć zakładać sprawy i rejestrować czas."
          }
          actionLabel={query ? undefined : "Dodaj klienta"}
          actionHref={query ? undefined : "/klienci/nowy"}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nazwa</TableHead>
                <TableHead>NIP</TableHead>
                <TableHead>Miejscowość</TableHead>
                <TableHead>Rozliczenie</TableHead>
                {context.canSeeFinances && <TableHead className="text-right">Stawka</TableHead>}
                <TableHead className="text-right">Sprawy</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((client) => (
                <TableRow key={client.id}>
                  <TableCell>
                    <Link
                      href={`/klienci/${client.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {client.name}
                    </Link>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {CLIENT_TYPE_LABELS[client.client_type as ClientType]}
                    </span>
                  </TableCell>
                  <TableCell className="tabular text-muted-foreground">
                    {client.tax_id ? formatTaxId(client.tax_id) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{client.city ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {BILLING_MODEL_LABELS[client.default_billing_model as BillingModel]}
                    </Badge>
                  </TableCell>
                  {context.canSeeFinances && (
                    <TableCell className="tabular text-right">
                      {client.default_hourly_rate_grosz
                        ? formatGrosz(client.default_hourly_rate_grosz)
                        : "—"}
                    </TableCell>
                  )}
                  <TableCell className="tabular text-right text-muted-foreground">
                    {client.cases?.[0]?.count ?? 0}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
