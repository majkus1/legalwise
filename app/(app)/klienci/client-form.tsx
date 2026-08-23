"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";
import {
  createClientAction,
  updateClientAction,
  type ActionState,
} from "@/lib/actions/clients";
import { FormError, SubmitButton } from "@/components/form-parts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ClientFormValues } from "./client-defaults";
import {
  BILLING_MODELS,
  BILLING_MODEL_LABELS,
  CLIENT_TYPES,
  CLIENT_TYPE_LABELS,
  type BillingModel,
  type ClientType,
} from "@/lib/domain";


export function ClientForm({ initial }: { initial: ClientFormValues }) {
  const isEdit = Boolean(initial.id);
  const action = isEdit ? updateClientAction : createClientAction;
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});

  const [clientType, setClientType] = useState<ClientType>(initial.clientType);
  const [billingModel, setBillingModel] = useState<BillingModel>(initial.defaultBillingModel);

  if (state.message) toast.success(state.message);

  return (
    <form action={formAction} className="space-y-8">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}

      <FormError>{state.error}</FormError>

      <section className="space-y-4">
        <h2 className="font-heading text-lg font-semibold">Dane klienta</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">Nazwa klienta</Label>
            <Input id="name" name="name" required defaultValue={initial.name} autoFocus />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientType">Typ</Label>
            <Select
              name="clientType"
              value={clientType}
              onValueChange={(value) => setClientType(value as ClientType)}
            >
              <SelectTrigger id="clientType" aria-label="Typ" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLIENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {CLIENT_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="taxId">NIP</Label>
            <Input
              id="taxId"
              name="taxId"
              defaultValue={initial.taxId}
              placeholder="1234567890"
              inputMode="numeric"
              disabled={clientType === "osoba_fizyczna"}
            />
            <p className="text-xs text-muted-foreground">
              {clientType === "osoba_fizyczna"
                ? "Osoba fizyczna nieprowadząca działalności nie ma NIP."
                : "Sprawdzamy cyfrę kontrolną — NIP trafia na fakturę i do KSeF."}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-lg font-semibold">Adres i kontakt</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="addressLine1">Ulica i numer</Label>
            <Input id="addressLine1" name="addressLine1" defaultValue={initial.addressLine1} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="postalCode">Kod pocztowy</Label>
            <Input
              id="postalCode"
              name="postalCode"
              defaultValue={initial.postalCode}
              placeholder="00-113"
            />
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

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="billingEmail">E-mail do faktur i zestawień</Label>
            <Input
              id="billingEmail"
              name="billingEmail"
              type="email"
              defaultValue={initial.billingEmail}
            />
            <p className="text-xs text-muted-foreground">
              Pozostaw puste, aby używać adresu kontaktowego.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-lg font-semibold">Warunki rozliczeń</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="defaultBillingModel">Domyślny model</Label>
            <Select
              name="defaultBillingModel"
              value={billingModel}
              onValueChange={(value) => setBillingModel(value as BillingModel)}
            >
              <SelectTrigger id="defaultBillingModel" aria-label="Domyślny model" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BILLING_MODELS.map((model) => (
                  <SelectItem key={model} value={model}>
                    {BILLING_MODEL_LABELS[model]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Pojedyncza sprawa może mieć własne warunki, nadpisujące te ustawienia.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="defaultHourlyRate">Domyślna stawka godzinowa (zł netto)</Label>
            <Input
              id="defaultHourlyRate"
              name="defaultHourlyRate"
              defaultValue={initial.defaultHourlyRate}
              placeholder="450"
              inputMode="decimal"
            />
            <p className="text-xs text-muted-foreground">
              {billingModel === "godzinowy"
                ? "Wymagana przy rozliczeniu godzinowym."
                : "Używana, gdy sprawa tego klienta rozlicza się godzinowo."}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notatki wewnętrzne</Label>
          <Textarea id="notes" name="notes" rows={3} defaultValue={initial.notes} />
        </div>
      </section>

      <div className="flex justify-end gap-2 border-t pt-6">
        <SubmitButton pendingLabel="Zapisywanie…">
          {isEdit ? "Zapisz zmiany" : "Dodaj klienta"}
        </SubmitButton>
      </div>
    </form>
  );
}
