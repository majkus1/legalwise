import type { Metadata } from "next";
import { requireOrgContext } from "@/lib/auth";
import { listClientOptions, listLawyers } from "@/lib/queries";
import { EmptyState, PageHeader } from "@/components/page-parts";
import { Card, CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";
import { CaseForm } from "../case-form";
import { emptyCase } from "../case-defaults";

export const metadata: Metadata = { title: "Nowa sprawa" };

export default async function NewCasePage({ searchParams }: PageProps<"/sprawy/nowa">) {
  const context = await requireOrgContext();
  const params = await searchParams;
  const preselectedClient = typeof params.klient === "string" ? params.klient : "";

  const [clients, lawyers] = await Promise.all([
    listClientOptions(),
    listLawyers(context.organizationId),
  ]);

  if (clients.length === 0) {
    return (
      <>
        <PageHeader title="Nowa sprawa" />
        <EmptyState
          icon={Users}
          title="Najpierw dodaj klienta"
          description="Sprawa zawsze należy do klienta, więc kartoteka nie może być pusta."
          actionLabel="Dodaj klienta"
          actionHref="/klienci/nowy"
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Nowa sprawa"
        description="Numer sprawy nadamy automatycznie po zapisaniu."
      />
      <Card className="max-w-3xl">
        <CardContent className="pt-6">
          <CaseForm
            initial={emptyCase(preselectedClient)}
            clients={clients}
            lawyers={lawyers}
          />
        </CardContent>
      </Card>
    </>
  );
}
