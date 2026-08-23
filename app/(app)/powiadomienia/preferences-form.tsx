"use client";

import { useActionState } from "react";
import { toast } from "sonner";
import {
  updateNotificationPreferencesAction,
  type ActionState,
} from "@/lib/actions/notifications";
import { FormError, SubmitButton } from "@/components/form-parts";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export interface NotificationPreferences {
  digestEnabled: boolean;
  includeDeadlines: boolean;
  includeDeficiencies: boolean;
  includeTasks: boolean;
  includeBilling: boolean;
  notifyTaskAssigned: boolean;
  notifyCaseAssigned: boolean;
  notifyDeadlines: boolean;
  emailEnabled: boolean;
}

function Toggle({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint: string;
  defaultChecked: boolean;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Checkbox id={name} name={name} defaultChecked={defaultChecked} className="mt-0.5" />
      <div className="min-w-0">
        <Label htmlFor={name} className="font-normal">
          {label}
        </Label>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

export function PreferencesForm({
  initial,
  canSeeFinances,
}: {
  initial: NotificationPreferences;
  canSeeFinances: boolean;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    updateNotificationPreferencesAction,
    {},
  );

  if (state.message) toast.success(state.message);

  return (
    <form action={formAction} className="space-y-6">
      <FormError>{state.error}</FormError>

      <section>
        <h3 className="mb-1 font-heading text-sm font-semibold">Poranny przegląd</h3>
        <p className="mb-2 text-xs text-muted-foreground">
          Jedna wiadomość w dni robocze, o siódmej rano. Wysyłana tylko wtedy, gdy jest o czym
          napisać — pusty przegląd nauczyłby, że tych maili można nie czytać.
        </p>

        <div className="divide-y">
          <Toggle
            name="digestEnabled"
            label="Wysyłaj poranny przegląd"
            hint="Wyłączenie zatrzymuje całą wiadomość, niezależnie od sekcji poniżej."
            defaultChecked={initial.digestEnabled}
          />
          <Toggle
            name="includeDeficiencies"
            label="Braki formalne"
            hint="Eskalacja na trzy dni przed terminem, dzień przed, w dniu terminu i codziennie po jego upływie."
            defaultChecked={initial.includeDeficiencies}
          />
          <Toggle
            name="includeDeadlines"
            label="Rozprawy i terminy procesowe"
            hint="Terminy przypadające na dany dzień."
            defaultChecked={initial.includeDeadlines}
          />
          <Toggle
            name="includeTasks"
            label="Zadania"
            hint="Zadania na dziś oraz zaległe."
            defaultChecked={initial.includeTasks}
          />
          {canSeeFinances && (
            <Toggle
              name="includeBilling"
              label="Rozliczenia"
              hint="Godziny czekające na zafakturowanie i faktury po terminie płatności."
              defaultChecked={initial.includeBilling}
            />
          )}
        </div>
      </section>

      <section>
        <h3 className="mb-1 font-heading text-sm font-semibold">Powiadomienia natychmiastowe</h3>

        <div className="divide-y">
          <Toggle
            name="notifyTaskAssigned"
            label="Przypisanie zadania"
            hint="Gdy ktoś powierzy Ci zadanie lub brak formalny."
            defaultChecked={initial.notifyTaskAssigned}
          />
          <Toggle
            name="notifyCaseAssigned"
            label="Przypisanie do sprawy"
            hint="Gdy zostaniesz dodany do zespołu przy sprawie."
            defaultChecked={initial.notifyCaseAssigned}
          />
          <Toggle
            name="notifyDeadlines"
            label="Zbliżające się terminy"
            hint="Przypomnienie dzień przed rozprawą lub terminem procesowym."
            defaultChecked={initial.notifyDeadlines}
          />
        </div>
      </section>

      <section>
        <h3 className="mb-1 font-heading text-sm font-semibold">Kanały</h3>
        <div className="divide-y">
          <Toggle
            name="emailEnabled"
            label="Powiadomienia e-mail"
            hint="Skrzynka w aplikacji działa zawsze; to ustawienie dotyczy wyłącznie poczty."
            defaultChecked={initial.emailEnabled}
          />
        </div>
      </section>

      <div className="flex justify-end border-t pt-4">
        <SubmitButton>Zapisz ustawienia</SubmitButton>
      </div>
    </form>
  );
}
