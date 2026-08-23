"use client";

import { useActionState } from "react";
import { registerAction, type FormState } from "@/lib/actions/auth";
import { FormError, SubmitButton } from "@/components/form-parts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RegisterForm() {
  const [state, formAction] = useActionState<FormState, FormData>(registerAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <FormError>{state.error}</FormError>

      <div className="space-y-2">
        <Label htmlFor="displayName">Imię i nazwisko</Label>
        <Input
          id="displayName"
          name="displayName"
          autoComplete="name"
          required
          autoFocus
          placeholder="Bartosz Śliwiński"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Adres e-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          placeholder="imie.nazwisko@legal-wise.pl"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Hasło</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
        />
        <p className="text-xs text-muted-foreground">
          Co najmniej 12 znaków. System przechowuje dane objęte tajemnicą zawodową — długie
          hasło chroni skuteczniej niż skomplikowane.
        </p>
      </div>

      <SubmitButton className="w-full" pendingLabel="Zakładanie konta…">
        Załóż konto
      </SubmitButton>
    </form>
  );
}
