"use client";

import { useActionState, useState } from "react";
import { createCaseAction, updateCaseAction, type ActionState } from "@/lib/actions/cases";
import { FormError, SubmitButton } from "@/components/form-parts";
import { useActionFeedback } from "@/components/use-action-feedback";
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
import {
  BILLING_MODELS,
  BILLING_MODEL_LABELS,
  CASE_STATUSES,
  CASE_STATUS_LABELS,
  CASE_TYPES,
  CASE_TYPE_LABELS,
  LITIGATION_CASE_TYPES,
  type BillingModel,
  type CaseStatus,
  type CaseType,
} from "@/lib/domain";
import type { MemberOption } from "@/lib/queries";
import type { CaseFormValues } from "./case-defaults";


export function CaseForm({
  initial,
  clients,
  lawyers,
  clientBillingModel,
}: {
  initial: CaseFormValues;
  clients: { id: string; name: string; billingModel: BillingModel }[];
  lawyers: MemberOption[];
  clientBillingModel?: BillingModel;
}) {
  const isEdit = Boolean(initial.id);
  const action = isEdit ? updateCaseAction : createCaseAction;
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});

  const [clientId, setClientId] = useState(initial.clientId);
  const [caseType, setCaseType] = useState<CaseType>(initial.caseType);
  const [status, setStatus] = useState<CaseStatus>(initial.status);
  const [leadLawyerId, setLeadLawyerId] = useState(initial.leadLawyerId);
  const [billingModel, setBillingModel] = useState(initial.billingModel);

  useActionFeedback(state);

  const isLitigation = LITIGATION_CASE_TYPES.includes(caseType);
  const inheritedModel =
    clients.find((client) => client.id === clientId)?.billingModel ?? clientBillingModel;
  const effectiveModel = (billingModel || inheritedModel) as BillingModel | undefined;

  return (
    <form action={formAction} className="space-y-8">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="leadLawyerId" value={leadLawyerId} />
      <input type="hidden" name="billingModel" value={billingModel} />
      <input type="hidden" name="status" value={status} />

      <FormError>{state.error}</FormError>

      <section className="space-y-4">
        <h2 className="font-heading text-lg font-semibold">Podstawowe dane</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="clientSelect">Klient</Label>
            <Select value={clientId} onValueChange={(value) => setClientId(value ?? "")}>
              <SelectTrigger id="clientSelect" aria-label="Klient" className="w-full">
                <SelectValue placeholder="Wybierz klienta" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="caseTypeSelect">Typ sprawy</Label>
            <Select value={caseType} onValueChange={(value) => setCaseType(value as CaseType)}>
              <SelectTrigger id="caseTypeSelect" aria-label="Typ sprawy" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CASE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {CASE_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="caseType" value={caseType} />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="title">Nazwa sprawy</Label>
            <Input
              id="title"
              name="title"
              required
              defaultValue={initial.title}
              placeholder="np. Acme przeciwko Beta Trade — zapłata za dostawy"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="leadSelect">Prawnik prowadzący</Label>
            <Select value={leadLawyerId} onValueChange={(value) => setLeadLawyerId(value ?? "")}>
              <SelectTrigger id="leadSelect" aria-label="Prawnik prowadzący" className="w-full">
                <SelectValue placeholder="Wybierz prowadzącego" />
              </SelectTrigger>
              <SelectContent>
                {lawyers.map((lawyer) => (
                  <SelectItem key={lawyer.userId} value={lawyer.userId}>
                    {lawyer.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isEdit && (
            <div className="space-y-2">
              <Label htmlFor="statusSelect">Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as CaseStatus)}>
                <SelectTrigger id="statusSelect" aria-label="Status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CASE_STATUSES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {CASE_STATUS_LABELS[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </section>

      {isLitigation && (
        <section className="space-y-4">
          <h2 className="font-heading text-lg font-semibold">Metryka sądowa</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="signature">Sygnatura akt</Label>
              <Input
                id="signature"
                name="signature"
                defaultValue={initial.signature}
                placeholder="I C 1234/25"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="courtName">Sąd lub organ</Label>
              <Input
                id="courtName"
                name="courtName"
                defaultValue={initial.courtName}
                placeholder="Sąd Okręgowy w Warszawie"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="courtDepartment">Wydział</Label>
              <Input
                id="courtDepartment"
                name="courtDepartment"
                defaultValue={initial.courtDepartment}
                placeholder="XVI Wydział Gospodarczy"
              />
            </div>
          </div>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="font-heading text-lg font-semibold">Warunki rozliczeń</h2>
        <p className="text-sm text-muted-foreground">
          Pozostaw puste, aby korzystać z ustawień klienta
          {inheritedModel ? ` (${BILLING_MODEL_LABELS[inheritedModel]})` : ""}.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="billingSelect">Model rozliczenia</Label>
            <Select
              value={billingModel === "" ? "__inherit__" : billingModel}
              onValueChange={(value) => setBillingModel(!value || value === "__inherit__" ? "" : value)}
            >
              <SelectTrigger id="billingSelect" aria-label="Model rozliczenia" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__inherit__">Jak u klienta</SelectItem>
                {BILLING_MODELS.map((model) => (
                  <SelectItem key={model} value={model}>
                    {BILLING_MODEL_LABELS[model]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {effectiveModel !== "ryczalt" && effectiveModel !== "nieodplatny" && (
            <div className="space-y-2">
              <Label htmlFor="hourlyRate">Stawka godzinowa (zł netto)</Label>
              <Input
                id="hourlyRate"
                name="hourlyRate"
                defaultValue={initial.hourlyRate}
                placeholder="Jak u klienta"
                inputMode="decimal"
              />
            </div>
          )}

          {effectiveModel === "ryczalt" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="flatFee">Kwota ryczałtu (zł netto)</Label>
                <Input
                  id="flatFee"
                  name="flatFee"
                  defaultValue={initial.flatFee}
                  placeholder="5000"
                  inputMode="decimal"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="flatFeeIncluded">Limit godzin w ryczałcie</Label>
                <Input
                  id="flatFeeIncluded"
                  name="flatFeeIncluded"
                  defaultValue={initial.flatFeeIncluded}
                  placeholder="20"
                  inputMode="decimal"
                />
                <p className="text-xs text-muted-foreground">
                  Godziny ponad limit doliczymy do faktury po stawce godzinowej.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hourlyRate">Stawka za nadwyżkę (zł netto)</Label>
                <Input
                  id="hourlyRate"
                  name="hourlyRate"
                  defaultValue={initial.hourlyRate}
                  placeholder="Jak u klienta"
                  inputMode="decimal"
                />
              </div>
            </>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Opis sprawy</Label>
          <Textarea id="description" name="description" rows={3} defaultValue={initial.description} />
        </div>
      </section>

      <div className="flex justify-end gap-2 border-t pt-6">
        <SubmitButton pendingLabel="Zapisywanie…">
          {isEdit ? "Zapisz zmiany" : "Załóż sprawę"}
        </SubmitButton>
      </div>
    </form>
  );
}
