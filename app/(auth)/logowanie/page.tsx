import Link from "next/link";
import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Logowanie" };

export default async function LoginPage({ searchParams }: PageProps<"/logowanie">) {
  const params = await searchParams;
  const returnTo = typeof params.powrot === "string" ? params.powrot : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Zaloguj się</CardTitle>
        <CardDescription>Wprowadź dane dostępowe do systemu kancelarii.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <LoginForm returnTo={returnTo} />
        <p className="text-center text-sm text-muted-foreground">
          Nie masz jeszcze konta?{" "}
          <Link
            href="/rejestracja"
            className="font-medium text-[var(--brand-gold-text)] underline-offset-4 hover:underline"
          >
            Załóż konto
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
