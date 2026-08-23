import type { Metadata } from "next";
import { requireOrgContext } from "@/lib/auth";
import { PageHeader } from "@/components/page-parts";
import { Card, CardContent } from "@/components/ui/card";
import { ClientForm } from "../client-form";
import { EMPTY_CLIENT } from "../client-defaults";

export const metadata: Metadata = { title: "Nowy klient" };

export default async function NewClientPage() {
  await requireOrgContext();

  return (
    <>
      <PageHeader
        title="Nowy klient"
        description="Warunki rozliczeń ustawione tutaj będą domyślne dla spraw tego klienta."
      />
      <Card className="max-w-3xl">
        <CardContent className="pt-6">
          <ClientForm initial={EMPTY_CLIENT} />
        </CardContent>
      </Card>
    </>
  );
}
