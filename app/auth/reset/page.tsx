"use client";

import { useActionState } from "react";
import { setNewPasswordAction, type FormState } from "@/lib/actions/auth";
import { FormError, SubmitButton } from "@/components/form-parts";
import { BrandLogo } from "@/components/brand";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPasswordPage() {
  const [state, formAction] = useActionState<FormState, FormData>(setNewPasswordAction, {});

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <BrandLogo />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Ustaw nowe hasło</CardTitle>
            <CardDescription>Po zapisaniu zostaniesz zalogowany do systemu.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={formAction} className="space-y-4">
              <FormError>{state.error}</FormError>

              <div className="space-y-2">
                <Label htmlFor="password">Nowe hasło</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">Co najmniej 12 znaków.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="passwordRepeat">Powtórz nowe hasło</Label>
                <Input
                  id="passwordRepeat"
                  name="passwordRepeat"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                />
              </div>

              <SubmitButton className="w-full">Zapisz nowe hasło</SubmitButton>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
