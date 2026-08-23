"use client";

import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";
import {
  addCasePartyAction,
  removeCasePartyAction,
  type ActionState,
} from "@/lib/actions/cases";
import { FormError, SubmitButton } from "@/components/form-parts";
import { EmptyState } from "@/components/page-parts";
import { useActionFeedback } from "@/components/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PARTY_ROLES, PARTY_ROLE_LABELS, type PartyRole } from "@/lib/domain";

export interface CaseParty {
  id: string;
  role: PartyRole;
  name: string;
  contact: string | null;
}

export function PartiesPanel({ caseId, parties }: { caseId: string; parties: CaseParty[] }) {
  const [state, formAction] = useActionState<ActionState, FormData>(addCasePartyAction, {});
  const [role, setRole] = useState<PartyRole>("powod");

  useActionFeedback(state);

  // Klucz zależny od komunikatu wymusza przemontowanie formularza po udanym
  // zapisie, co czyści pola bez sięgania po referencję w trakcie renderu.
  const formKey = state.message ?? "nowy";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div>
        {parties.length === 0 ? (
          <EmptyState
            title="Brak oznaczonych stron"
            description="Dodaj strony postępowania oraz pełnomocnika drugiej strony — będą widoczne w metryce sprawy."
          />
        ) : (
          <ul className="space-y-2">
            {parties.map((party) => (
              <li key={party.id}>
                <Card>
                  <CardContent className="flex items-start justify-between gap-4 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {PARTY_ROLE_LABELS[party.role]}
                      </p>
                      <p className="text-sm font-medium">{party.name}</p>
                      {party.contact && (
                        <p className="text-xs text-muted-foreground">{party.contact}</p>
                      )}
                    </div>

                    <form action={removeCasePartyAction}>
                      <input type="hidden" name="id" value={party.id} />
                      <input type="hidden" name="caseId" value={caseId} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Usuń stronę ${party.name}`}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Card className="h-fit">
        <CardContent className="pt-6">
          <form key={formKey} action={formAction} className="space-y-4">
            <input type="hidden" name="caseId" value={caseId} />
            <input type="hidden" name="role" value={role} />
            <FormError>{state.error}</FormError>

            <div className="space-y-2">
              <Label htmlFor="roleSelect">Rola w postępowaniu</Label>
              <Select value={role} onValueChange={(value) => setRole(value as PartyRole)}>
                <SelectTrigger id="roleSelect" aria-label="Rola w postępowaniu" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PARTY_ROLES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {PARTY_ROLE_LABELS[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="partyName">Oznaczenie strony</Label>
              <Input id="partyName" name="name" required placeholder="np. Beta Trade Sp. z o.o." />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact">Kontakt lub uwagi</Label>
              <Input
                id="contact"
                name="contact"
                placeholder="np. adw. Tomasz Lewandowski"
              />
            </div>

            <SubmitButton className="w-full">Dodaj stronę</SubmitButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
