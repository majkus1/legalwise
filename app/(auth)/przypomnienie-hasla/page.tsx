"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordResetAction, type FormState } from "@/lib/actions/auth";
import { FormError, FormSuccess, SubmitButton } from "@/components/form-parts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [state, formAction] = useActionState<FormState, FormData>(requestPasswordResetAction, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nie pamiętam hasła</CardTitle>
        <CardDescription>
          Wyślemy link do ustawienia nowego hasła na podany adres.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form action={formAction} className="space-y-4">
          <FormError>{state.error}</FormError>
          <FormSuccess>{state.message}</FormSuccess>

          <div className="space-y-2">
            <Label htmlFor="email">Adres e-mail</Label>
            <Input id="email" name="email" type="email" autoComplete="username" required autoFocus />
          </div>

          <SubmitButton className="w-full" pendingLabel="Wysyłanie…">
            Wyślij link
          </SubmitButton>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          <Link
            href="/logowanie"
            className="font-medium text-[var(--brand-gold-text)] underline-offset-4 hover:underline"
          >
            Wróć do logowania
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
