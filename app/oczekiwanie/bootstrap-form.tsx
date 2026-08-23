"use client";

import { useActionState } from "react";
import { bootstrapOrganizationAction, type FormState } from "@/lib/actions/auth";
import { FormError, SubmitButton } from "@/components/form-parts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function BootstrapForm() {
  const [state, formAction] = useActionState<FormState, FormData>(bootstrapOrganizationAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <FormError>{state.error}</FormError>

      <div className="space-y-2">
        <Label htmlFor="name">Nazwa kancelarii</Label>
        <Input id="name" name="name" required autoFocus defaultValue="Legal-Wise" />
      </div>

      <SubmitButton className="w-full" pendingLabel="Konfigurowanie…">
        Utwórz kancelarię
      </SubmitButton>
    </form>
  );
}
