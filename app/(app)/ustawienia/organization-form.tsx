"use client";

import { useActionState } from "react";
import { toast } from "sonner";
import { updateOrganizationAction, type ActionState } from "@/lib/actions/settings";
import { FormError, SubmitButton } from "@/components/form-parts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface OrganizationFormValues {
  name: string;
  legalName: string;
  taxId: string;
  addressLine1: string;
  postalCode: string;
  city: string;
  bankAccount: string;
  email: string;
  phone: string;
  invoiceNumberPattern: string;
  defaultVatRate: string;
  defaultPaymentDays: string;
}

export function OrganizationForm({ initial }: { initial: OrganizationFormValues }) {
  const [state, formAction] = useActionState<ActionState, FormData>(updateOrganizationAction, {});

  if (state.message) toast.success(state.message);

  return (
    <form action={formAction} className="space-y-8">
      <FormError>{state.error}</FormError>

      <section className="space-y-4">
        <h2 className="font-heading text-lg font-semibold">Dane kancelarii</h2>
        <p className="text-sm text-muted-foreground">
          Te dane trafiają na faktury jako dane sprzedawcy i do pliku XML wysyłanego do KSeF.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Nazwa skrócona</Label>
            <Input id="name" name="name" required defaultValue={initial.name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="legalName">Pełna nazwa</Label>
            <Input id="legalName" name="legalName" defaultValue={initial.legalName} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="taxId">NIP</Label>
            <Input id="taxId" name="taxId" defaultValue={initial.taxId} inputMode="numeric" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bankAccount">Numer rachunku</Label>
            <Input id="bankAccount" name="bankAccount" defaultValue={initial.bankAccount} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="addressLine1">Ulica i numer</Label>
            <Input id="addressLine1" name="addressLine1" defaultValue={initial.addressLine1} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="postalCode">Kod pocztowy</Label>
            <Input id="postalCode" name="postalCode" defaultValue={initial.postalCode} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">Miejscowość</Label>
            <Input id="city" name="city" defaultValue={initial.city} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" defaultValue={initial.email} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Telefon</Label>
            <Input id="phone" name="phone" defaultValue={initial.phone} />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-lg font-semibold">Fakturowanie</h2>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="invoiceNumberPattern">Wzorzec numeru</Label>
            <Input
              id="invoiceNumberPattern"
              name="invoiceNumberPattern"
              required
              defaultValue={initial.invoiceNumberPattern}
            />
            <p className="text-xs text-muted-foreground">
              {"{nr}"} — kolejny numer, {"{rok}"} — rok, {"{mies}"} — miesiąc.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultVatRate">Domyślna stawka VAT (%)</Label>
            <Input
              id="defaultVatRate"
              name="defaultVatRate"
              type="number"
              min={0}
              max={100}
              step={1}
              defaultValue={initial.defaultVatRate}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultPaymentDays">Termin płatności (dni)</Label>
            <Input
              id="defaultPaymentDays"
              name="defaultPaymentDays"
              type="number"
              min={0}
              max={180}
              defaultValue={initial.defaultPaymentDays}
            />
          </div>
        </div>
      </section>

      <div className="flex justify-end border-t pt-6">
        <SubmitButton>Zapisz dane kancelarii</SubmitButton>
      </div>
    </form>
  );
}
