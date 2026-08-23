import Link from "next/link";
import type { Metadata } from "next";
import { Briefcase, Plus, Search } from "lucide-react";
import { requireOrgContext } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { listMembers } from "@/lib/queries";
import { formatDate } from "@/lib/time";
import {
  CASE_STATUS_LABELS,
  CASE_TYPE_LABELS,
  type CaseStatus,
  type CaseType,
} from "@/lib/domain";
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

export const metadata: Metadata = { title: "Sprawy" };

export default async function CasesPage({ searchParams }: PageProps<"/sprawy">) {
  const context = await requireOrgContext();
  const params = await searchParams;
  const query = typeof params.szukaj === "string" ? params.szukaj.trim() : "";
  const showClosed = params.zakonczone === "1";

  const supabase = await createServerSupabase();

  // Prowadzącego dociągamy osobno: cases.lead_lawyer_id wskazuje na auth.users,
  // a nie na katalog profili, więc PostgREST nie ma tu relacji do przejścia.
  // Sięganie wprost do auth.users jest wykluczone (wyciek danych kont).
  const members = await listMembers(context.organizationId);
  const memberName = new Map(members.map((member) => [member.userId, member.displayName]));

  let request = supabase
    .from("cases")
    .select(
      "id, case_number, title, case_type, status, signature, court_name, opened_at, lead_lawyer_id, clients(name)",
    )
    .is("archived_at", null)
    .order("case_number", { ascending: false });

  if (!showClosed) request = request.neq("status", "zakonczona");

  if (query !== "") {
    request = request.or(
      `case_number.ilike.%${query}%,title.ilike.%${query}%,signature.ilike.%${query}%`,
    );
  }

  const { data: cases } = await request;
  const rows = cases ?? [];

  return (
    <>
      <PageHeader
        title="Sprawy"
        description={`${rows.length} ${rows.length === 1 ? "sprawa" : "spraw"}${showClosed ? "" : " w toku"}`}
        actions={
          <Button render={<Link href="/sprawy/nowa" />} className="gap-2">
            <Plus className="size-4" aria-hidden="true" />
            Załóż sprawę
          </Button>
        }
      />

      <form className="mb-6 flex max-w-2xl flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            name="szukaj"
            defaultValue={query}
            placeholder="Szukaj po numerze, nazwie lub sygnaturze"
            className="pl-9"
            aria-label="Szukaj sprawy"
          />
        </div>
        <Button type="submit" variant="outline">
          Szukaj
        </Button>
        <Button
          render={
            <Link href={showClosed ? "/sprawy" : "/sprawy?zakonczone=1"} />
          }
          variant="ghost"
        >
          {showClosed ? "Ukryj zakończone" : "Pokaż zakończone"}
        </Button>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title={query ? "Brak wyników" : "Brak spraw"}
          description={
            query
              ? `Żadna sprawa nie pasuje do zapytania „${query}”.`
              : "Załóż pierwszą sprawę, aby rejestrować przy niej czas, zadania i terminy."
          }
          actionLabel={query ? undefined : "Załóż sprawę"}
          actionHref={query ? undefined : "/sprawy/nowa"}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numer</TableHead>
                <TableHead>Nazwa</TableHead>
                <TableHead>Klient</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Sygnatura</TableHead>
                <TableHead>Prowadzący</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Otwarta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="tabular whitespace-nowrap">
                    <Link
                      href={`/sprawy/${item.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {item.case_number}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-72">
                    <span className="block truncate">{item.title}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.clients?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {CASE_TYPE_LABELS[item.case_type as CaseType]}
                  </TableCell>
                  <TableCell className="tabular whitespace-nowrap text-muted-foreground">
                    {item.signature ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.lead_lawyer_id ? (memberName.get(item.lead_lawyer_id) ?? "—") : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.status === "aktywna" ? "default" : "secondary"}>
                      {CASE_STATUS_LABELS[item.status as CaseStatus]}
                    </Badge>
                  </TableCell>
                  <TableCell className="tabular whitespace-nowrap text-muted-foreground">
                    {formatDate(item.opened_at)}
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
