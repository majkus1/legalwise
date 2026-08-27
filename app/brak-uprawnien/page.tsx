import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { requireOrgContext } from "@/lib/auth";
import { ORG_ROLE_LABELS } from "@/lib/domain";
import { ButtonLink } from "@/components/button-link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Brak uprawnień" };

export default async function NoAccessPage() {
  const context = await requireOrgContext();

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex size-11 items-center justify-center rounded-full bg-muted">
            <ShieldAlert className="size-5 text-muted-foreground" aria-hidden="true" />
          </div>
          <CardTitle>Ta część systemu jest poza Twoim zakresem</CardTitle>
          <CardDescription>
            Pracujesz w roli: <strong>{ORG_ROLE_LABELS[context.role]}</strong>. Dostęp do
            rozliczeń i danych finansowych mają właściciel oraz partnerzy kancelarii.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ButtonLink href="/" className="w-full">
            Wróć do pulpitu
          </ButtonLink>
        </CardContent>
      </Card>
    </div>
  );
}
