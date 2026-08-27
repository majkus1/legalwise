import Link from "next/link";
import type { Metadata } from "next";
import { Briefcase, Plus, Search } from "lucide-react";
import { requireOrgContext } from "@/lib/auth";
import { countLabel, plural } from "@/lib/text";
import { createServerSupabase } from "@/lib/supabase/server";
import { listMembers } from "@/lib/queries";
import { formatDate } from "@/lib/time";
import {
  CASE_STATUS_LABELS,
  CASE_TYPE_LABELS,
  type CaseStatus,
  type CaseType,
} from "@/lib/domain";
import {
  EmptyState,
  PageHeader,
  RecordCard,
  RecordCardList,
  ScopeSwitch,
} from "@/components/page-parts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/button-link";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClickableRow } from "@/components/clickable-row";

export const metadata: Metadata = { title: "Sprawy" };

export default async function CasesPage({
  searchParams,
}: PageProps<"/sprawy">) {
  const context = await requireOrgContext();
  const params = await searchParams;
  const query = typeof params.szukaj === "string" ? params.szukaj.trim() : "";
  // Zakres jest jawny: „w toku", „zakończone" albo „wszystkie". Poprzedni
  // przełącznik „Pokaż/Ukryj zakończone" nie mówił, czy zakończone dołączają
  // do bieżących, czy je zastępują — a widok pokazywał jedno i drugie naraz.
  const ZAKRESY = ["w-toku", "zakonczone", "wszystkie"] as const;
  type Zakres = (typeof ZAKRESY)[number];
  const zakres: Zakres = ZAKRESY.includes(params.zakres as Zakres)
    ? (params.zakres as Zakres)
    : "w-toku";

  const supabase = await createServerSupabase();

  // Prowadzącego dociągamy osobno: cases.lead_lawyer_id wskazuje na auth.users,
  // a nie na katalog profili, więc PostgREST nie ma tu relacji do przejścia.
  // Sięganie wprost do auth.users jest wykluczone (wyciek danych kont).
  const members = await listMembers(context.organizationId);
  const memberName = new Map(
    members.map((member) => [member.userId, member.displayName]),
  );

  let request = supabase
    .from("cases")
    .select(
      "id, case_number, title, case_type, status, signature, court_name, opened_at, lead_lawyer_id, clients(name)",
    )
    .is("archived_at", null)
    .order("case_number", { ascending: false });

  if (zakres === "w-toku") request = request.neq("status", "zakonczona");
  if (zakres === "zakonczone") request = request.eq("status", "zakonczona");

  if (query !== "") {
    request = request.or(
      `case_number.ilike.%${query}%,title.ilike.%${query}%,signature.ilike.%${query}%`,
    );
  }

  // Zmiana zakresu nie może gubić wpisanej frazy — inaczej po każdym
  // przełączeniu trzeba by szukać od nowa.
  const adresZakresu = (nowy: Zakres) => {
    const qs = new URLSearchParams();
    if (query !== "") qs.set("szukaj", query);
    if (nowy !== "w-toku") qs.set("zakres", nowy);
    const suffix = qs.toString();
    return suffix ? `/sprawy?${suffix}` : "/sprawy";
  };

  const { data: cases } = await request;
  const rows = cases ?? [];

  return (
    <>
      <PageHeader
        title="Sprawy"
        description={`${countLabel(rows.length, ["sprawa", "sprawy", "spraw"])}${
          zakres === "w-toku"
            ? " w toku"
            : zakres === "zakonczone"
              ? ` ${plural(rows.length, ["zakończona", "zakończone", "zakończonych"])}`
              : " łącznie"
        }`}
        actions={
          <ButtonLink href="/sprawy/nowa" className="gap-2">
            <Plus className="size-4" aria-hidden="true" />
            Załóż sprawę
          </ButtonLink>
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
        <ScopeSwitch
          label="Zakres spraw"
          options={[
            {
              href: adresZakresu("w-toku"),
              label: "W toku",
              active: zakres === "w-toku",
            },
            {
              href: adresZakresu("zakonczone"),
              label: "Zakończone",
              active: zakres === "zakonczone",
            },
            {
              href: adresZakresu("wszystkie"),
              label: "Wszystkie",
              active: zakres === "wszystkie",
            },
          ]}
        />
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
        <>
          {/* Wąskie ekrany: kafelki. Tabela wymagałaby tu 536 px przewijania
              w bok, więc status sprawy byłby poza widokiem. */}
          <RecordCardList>
            {rows.map((item) => (
              <RecordCard
                key={item.id}
                href={`/sprawy/${item.id}`}
                title={`${item.case_number} — ${item.title}`}
                subtitle={item.clients?.name ?? undefined}
                badge={
                  <Badge
                    variant={
                      item.status === "aktywna" ? "default" : "secondary"
                    }
                  >
                    {CASE_STATUS_LABELS[item.status as CaseStatus]}
                  </Badge>
                }
                fields={[
                  {
                    label: "Typ",
                    value: CASE_TYPE_LABELS[item.case_type as CaseType],
                  },
                  { label: "Sygnatura", value: item.signature ?? "—" },
                  {
                    label: "Prowadzący",
                    value: item.lead_lawyer_id
                      ? (memberName.get(item.lead_lawyer_id) ?? "—")
                      : "—",
                  },
                  { label: "Otwarta", value: formatDate(item.opened_at) },
                ]}
              />
            ))}
          </RecordCardList>

          <div className="hidden overflow-x-auto rounded-lg border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numer</TableHead>
                  <TableHead>Nazwa</TableHead>
                  <TableHead>Klient</TableHead>
                  <TableHead className="hidden 2xl:table-cell">Typ</TableHead>
                  <TableHead>Sygnatura</TableHead>
                  <TableHead>Prowadzący</TableHead>
                  <TableHead className="whitespace-nowrap">Status</TableHead>
                  <TableHead className="hidden 2xl:table-cell">
                    Otwarta
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((item) => (
                  <ClickableRow key={item.id} href={`/sprawy/${item.id}`}>
                    <TableCell className="tabular whitespace-nowrap">
                      <Link
                        href={`/sprawy/${item.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {item.case_number}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-64">
                      <span className="block truncate" title={item.title}>
                        {item.title}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-52 text-muted-foreground">
                      <span
                        className="block truncate"
                        title={item.clients?.name ?? undefined}
                      >
                        {item.clients?.name ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground 2xl:table-cell">
                      {CASE_TYPE_LABELS[item.case_type as CaseType]}
                    </TableCell>
                    <TableCell className="tabular whitespace-nowrap text-muted-foreground">
                      {item.signature ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.lead_lawyer_id
                        ? (memberName.get(item.lead_lawyer_id) ?? "—")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          item.status === "aktywna" ? "default" : "secondary"
                        }
                      >
                        {CASE_STATUS_LABELS[item.status as CaseStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular hidden whitespace-nowrap text-muted-foreground 2xl:table-cell">
                      {formatDate(item.opened_at)}
                    </TableCell>
                  </ClickableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </>
  );
}
