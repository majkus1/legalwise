"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, type FormState } from "@/lib/actions/auth";
import { FormError, SubmitButton } from "@/components/form-parts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ returnTo }: { returnTo?: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(loginAction, {});

  return (
    <form action={formAction} className="space-y-4">
      {returnTo && <input type="hidden" name="powrot" value={returnTo} />}

      <FormError>{state.error}</FormError>

      <div className="space-y-2">
        <Label htmlFor="email">Adres e-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          placeholder="imie.nazwisko@legal-wise.pl"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Hasło</Label>
          <Link
            href="/przypomnienie-hasla"
            className="text-xs text-[var(--brand-gold-text)] underline-offset-4 hover:underline"
          >
            Nie pamiętam hasła
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      <SubmitButton className="w-full" pendingLabel="Logowanie…">
        Zaloguj się
      </SubmitButton>
    </form>
  );
}
