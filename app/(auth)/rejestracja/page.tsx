import Link from "next/link";
import type { Metadata } from "next";
import { Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Rejestracja" };

export default function RegisterPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Załóż konto</CardTitle>
        <CardDescription>
          Konto zakładasz samodzielnie, ale dostęp do danych kancelarii nadaje właściciel.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="flex items-start gap-2 rounded-md border bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            Po założeniu konta nie zobaczysz jeszcze żadnych danych. Właściciel kancelarii musi
            dodać Twój adres e-mail w ustawieniach zespołu i nadać Ci rolę.
          </span>
        </p>

        <RegisterForm />

        <p className="text-center text-sm text-muted-foreground">
          Masz już konto?{" "}
          <Link
            href="/logowanie"
            className="font-medium text-[var(--brand-gold-text)] underline-offset-4 hover:underline"
          >
            Zaloguj się
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
