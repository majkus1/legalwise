import type { Metadata } from "next";
import { requireFinanceContext } from "@/lib/auth";
import { listClientOptions } from "@/lib/queries";
import { monthRange, todayInWarsaw } from "@/lib/time";
import { PageHeader } from "@/components/page-parts";
import { PeriodWizard } from "./period-wizard";

export const metadata: Metadata = { title: "Zamknięcie okresu" };

export default async function BillingPage() {
  await requireFinanceContext();
  const clients = await listClientOptions();

  // Domyślnie proponujemy miesiąc poprzedni — zamknięcie okresu robi się
  // po jego zakończeniu, a nie w trakcie.
  const today = todayInWarsaw();
  const [year, month] = today.split("-").map(Number);
  const previousMonthDay =
    month === 1 ? `${year - 1}-12-15` : `${year}-${String(month - 1).padStart(2, "0")}-15`;
  const { from, to } = monthRange(previousMonthDay);

  return (
    <>
      <PageHeader
        title="Zamknięcie okresu"
        description="Wybierz klienta i okres, aby zamienić zarejestrowane godziny w projekt faktury wraz z zestawieniem dla klienta."
      />
      <PeriodWizard clients={clients} defaultFrom={from} defaultTo={to} />
    </>
  );
}
