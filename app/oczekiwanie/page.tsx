import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Clock, Building2 } from "lucide-react";
import { getCurrentUser, getOrgContext } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { logoutAction } from "@/lib/actions/auth";
import { BrandLogo } from "@/components/brand";
import { SubmitButton } from "@/components/form-parts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BootstrapForm } from "./bootstrap-form";

export const metadata: Metadata = { title: "Oczekiwanie na dostęp" };

export default async function PendingAccessPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/logowanie");

  // Osoba, która ma już przyznany dostęp, nie ma tu czego szukać.
  const context = await getOrgContext();
  if (context) redirect("/");

  const supabase = await createServerSupabase();
  const { data: organizationExists } = await supabase.rpc("any_organization_exists");

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <BrandLogo />
        </div>

        {organizationExists ? (
          <Card>
            <CardHeader>
              <div className="mb-2 flex size-11 items-center justify-center rounded-full bg-[var(--brand-gold)]/15">
                <Clock className="size-5 text-[var(--brand-gold-text)]" aria-hidden="true" />
              </div>
              <CardTitle>Konto oczekuje na przyznanie dostępu</CardTitle>
              <CardDescription>
                Twoje konto zostało założone, ale nie ma jeszcze dostępu do danych kancelarii.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-md border bg-background px-4 py-3 text-sm">
                <p className="text-muted-foreground">Zarejestrowany adres</p>
                <p className="font-medium">{user.email}</p>
              </div>

              <p className="text-sm text-muted-foreground">
                Poproś właściciela kancelarii o dodanie tego adresu w sekcji{" "}
                <strong className="text-foreground">Ustawienia → Zespół</strong> i nadanie roli.
                Dostęp pojawi się natychmiast po zapisaniu — wystarczy odświeżyć stronę.
              </p>

              <form action={logoutAction}>
                <SubmitButton variant="outline" className="w-full" pendingLabel="Wylogowywanie…">
                  Wyloguj się
                </SubmitButton>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <div className="mb-2 flex size-11 items-center justify-center rounded-full bg-[var(--brand-gold)]/15">
                <Building2 className="size-5 text-[var(--brand-gold-text)]" aria-hidden="true" />
              </div>
              <CardTitle>Skonfiguruj kancelarię</CardTitle>
              <CardDescription>
                System nie jest jeszcze skonfigurowany. Jako pierwsza osoba zakładasz kancelarię
                i zostajesz jej właścicielem.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <BootstrapForm />
              <p className="text-xs text-muted-foreground">
                Tę operację można wykonać tylko raz. Kolejne osoby zakładają konta samodzielnie,
                a dostęp nadajesz im Ty w ustawieniach zespołu.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
