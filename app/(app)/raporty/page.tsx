import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { requireFinanceContext } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { listMembers } from "@/lib/queries";
import { buildProfitability, type BillableEntry } from "@/lib/billing";
import { formatGrosz } from "@/lib/money";
import {
  formatDate,
  formatMinutesAsHours,
  monthRange,
  todayInWarsaw,
} from "@/lib/time";
import type { BillingModel } from "@/lib/domain";
import {
  EmptyState,
  PageHeader,
  RecordCard,
  RecordCardList,
  StatTile,
} from "@/components/page-parts";
import { ButtonLink } from "@/components/button-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "Raporty" };

const PERCENT = new Intl.NumberFormat("pl-PL", {
  style: "percent",
  maximumFractionDigits: 0,
});

export default async function ReportsPage({
  searchParams,
}: PageProps<"/raporty">) {
  const context = await requireFinanceContext();
  const params = await searchParams;

  const anchor =
    typeof params.miesiac === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(params.miesiac)
      ? params.miesiac
      : todayInWarsaw();
  const { from, to } = monthRange(anchor);
  const wholeYear = params.zakres === "rok";
  const periodFrom = wholeYear ? `${from.slice(0, 4)}-01-01` : from;
  const periodTo = wholeYear ? `${from.slice(0, 4)}-12-31` : to;

  const supabase = await createServerSupabase();
  const [{ data: entries }, members] = await Promise.all([
    supabase
      .from("time_entries")
      .select(
        "id, case_id, user_id, work_date, minutes, description, billing_type, rate_snapshot_grosz, billable, invoice_id",
      )
      .gte("work_date", periodFrom)
      .lte("work_date", periodTo),
    listMembers(context.organizationId),
  ]);

  const lawyerNames = Object.fromEntries(
    members.map((m) => [m.userId, m.displayName]),
  );
  const rows = buildProfitability({
    entries: (entries ?? []).map(
      (row): BillableEntry & { invoiceId: string | null } => ({
        id: row.id,
        caseId: row.case_id,
        userId: row.user_id,
        workDate: row.work_date,
        minutes: row.minutes,
        description: row.description,
        billingType: row.billing_type as BillingModel,
        rateSnapshotGrosz: row.rate_snapshot_grosz,
        billable: row.billable,
        invoiceId: row.invoice_id,
      }),
    ),
    lawyerNames,
  });

  const totalWorked = rows.reduce((sum, row) => sum + row.workedMinutes, 0);
  const totalBilled = rows.reduce((sum, row) => sum + row.billedMinutes, 0);
  const totalProBono = rows.reduce((sum, row) => sum + row.proBonoMinutes, 0);
  const totalValue = rows.reduce((sum, row) => sum + row.billedNetGrosz, 0);
  const scaleMax = Math.max(1, ...rows.map((row) => row.workedMinutes));

  const periodLabel = wholeYear
    ? `Rok ${from.slice(0, 4)}`
    : `${formatDate(periodFrom)} – ${formatDate(periodTo)}`;

  return (
    <>
      <PageHeader
        title="Rentowność"
        description={`Godziny przepracowane wobec zafakturowanych · ${periodLabel}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink
              href={
                wholeYear
                  ? `/raporty?miesiac=${anchor}`
                  : `/raporty?miesiac=${anchor}&zakres=rok`
              }
              variant="outline"
              size="sm"
            >
              {wholeYear ? "Bieżący miesiąc" : "Cały rok"}
            </ButtonLink>
          </div>
        }
      />

      <section className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile
          label="Godziny przepracowane"
          value={formatMinutesAsHours(totalWorked)}
        />
        <StatTile
          label="Godziny zafakturowane"
          value={formatMinutesAsHours(totalBilled)}
        />
        <StatTile
          label="Realizacja"
          value={
            totalWorked > 0 ? PERCENT.format(totalBilled / totalWorked) : "—"
          }
          hint="Udział godzin ujętych na fakturach"
        />
        <StatTile
          label="Nieodpłatnie"
          value={formatMinutesAsHours(totalProBono)}
          tone="muted"
        />
      </section>

      {rows.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="Brak danych w tym okresie"
          description="W wybranym okresie nikt nie zarejestrował czasu pracy."
        />
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Godziny przepracowane a zafakturowane
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Dwie serie, więc legenda jest obowiązkowa — identyczności nie
                  niesie sam kolor. Wartości są dopisane bezpośrednio przy
                  słupkach, a pełne dane powtarza tabela poniżej. */}
              <div className="mb-5 flex flex-wrap items-center gap-5 text-xs">
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block size-3 rounded-sm"
                    style={{ backgroundColor: "var(--chart-1)" }}
                    aria-hidden="true"
                  />
                  Przepracowane
                </span>
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block size-3 rounded-sm"
                    style={{ backgroundColor: "var(--chart-2)" }}
                    aria-hidden="true"
                  />
                  Zafakturowane
                </span>
              </div>

              <ul className="space-y-5">
                {rows.map((row) => (
                  <li key={row.userId}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-4">
                      <span className="text-sm font-medium">
                        {row.lawyerName}
                      </span>
                      <span className="tabular text-xs text-muted-foreground">
                        realizacja {PERCENT.format(row.realizationRate)}
                      </span>
                    </div>

                    <div className="space-y-[2px]">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 rounded-r-[3px]"
                          style={{
                            backgroundColor: "var(--chart-1)",
                            width: `${Math.max(1, (row.workedMinutes / scaleMax) * 100)}%`,
                          }}
                        />
                        <span className="tabular text-xs whitespace-nowrap text-muted-foreground">
                          {formatMinutesAsHours(row.workedMinutes)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 rounded-r-[3px]"
                          style={{
                            backgroundColor: "var(--chart-2)",
                            width: `${Math.max(0.5, (row.billedMinutes / scaleMax) * 100)}%`,
                          }}
                        />
                        <span className="tabular text-xs whitespace-nowrap text-muted-foreground">
                          {formatMinutesAsHours(row.billedMinutes)}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Zestawienie szczegółowe
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Wąskie ekrany: kafelek na prawnika. Siedem kolumn liczbowych
                  wymagałoby 450 px przewijania w bok. */}
              <RecordCardList>
                {rows.map((row) => (
                  <RecordCard
                    key={row.userId}
                    title={row.lawyerName}
                    subtitle={`Realizacja ${PERCENT.format(row.realizationRate)}`}
                    fields={[
                      {
                        label: "Przepracowane",
                        value: formatMinutesAsHours(row.workedMinutes),
                      },
                      {
                        label: "Do rozliczenia",
                        value: formatMinutesAsHours(row.billableMinutes),
                      },
                      {
                        label: "Zafakturowane",
                        value: formatMinutesAsHours(row.billedMinutes),
                      },
                      {
                        label: "Nieodpłatnie",
                        value: formatMinutesAsHours(row.proBonoMinutes),
                      },
                      {
                        label: "Wartość netto",
                        value: formatGrosz(row.billedNetGrosz),
                      },
                    ]}
                  />
                ))}
                <RecordCard
                  title="Razem"
                  subtitle={
                    totalWorked > 0
                      ? `Realizacja ${PERCENT.format(totalBilled / totalWorked)}`
                      : undefined
                  }
                  fields={[
                    {
                      label: "Przepracowane",
                      value: formatMinutesAsHours(totalWorked),
                    },
                    {
                      label: "Zafakturowane",
                      value: formatMinutesAsHours(totalBilled),
                    },
                    {
                      label: "Nieodpłatnie",
                      value: formatMinutesAsHours(totalProBono),
                    },
                    { label: "Wartość netto", value: formatGrosz(totalValue) },
                  ]}
                />
              </RecordCardList>

              <div className="hidden overflow-x-auto rounded-lg border md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Prawnik</TableHead>
                      <TableHead className="text-right">
                        Przepracowane
                      </TableHead>
                      <TableHead className="text-right">
                        Do rozliczenia
                      </TableHead>
                      <TableHead className="text-right">
                        Zafakturowane
                      </TableHead>
                      <TableHead className="text-right">Nieodpłatnie</TableHead>
                      <TableHead className="text-right">Realizacja</TableHead>
                      <TableHead className="text-right">
                        Wartość netto
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.userId}>
                        <TableCell className="font-medium">
                          {row.lawyerName}
                        </TableCell>
                        <TableCell className="tabular text-right">
                          {formatMinutesAsHours(row.workedMinutes)}
                        </TableCell>
                        <TableCell className="tabular text-right text-muted-foreground">
                          {formatMinutesAsHours(row.billableMinutes)}
                        </TableCell>
                        <TableCell className="tabular text-right">
                          {formatMinutesAsHours(row.billedMinutes)}
                        </TableCell>
                        <TableCell className="tabular text-right text-muted-foreground">
                          {formatMinutesAsHours(row.proBonoMinutes)}
                        </TableCell>
                        <TableCell className="tabular text-right">
                          {PERCENT.format(row.realizationRate)}
                        </TableCell>
                        <TableCell className="tabular text-right font-medium">
                          {formatGrosz(row.billedNetGrosz)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2">
                      <TableCell className="font-semibold">Razem</TableCell>
                      <TableCell className="tabular text-right font-semibold">
                        {formatMinutesAsHours(totalWorked)}
                      </TableCell>
                      <TableCell />
                      <TableCell className="tabular text-right font-semibold">
                        {formatMinutesAsHours(totalBilled)}
                      </TableCell>
                      <TableCell className="tabular text-right font-semibold">
                        {formatMinutesAsHours(totalProBono)}
                      </TableCell>
                      <TableCell className="tabular text-right font-semibold">
                        {totalWorked > 0
                          ? PERCENT.format(totalBilled / totalWorked)
                          : "—"}
                      </TableCell>
                      <TableCell className="tabular text-right font-semibold">
                        {formatGrosz(totalValue)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <p className="mt-3 text-xs text-muted-foreground">
                {"„Zafakturowane”"} oznacza czas powiązany z fakturą — dopiero
                to odróżnia pracę wykonaną od pracy rozliczonej. Wartość netto
                obejmuje wyłącznie rozliczenia godzinowe; kwoty ryczałtowe są na
                fakturach, nie przy pojedynczych wpisach.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
