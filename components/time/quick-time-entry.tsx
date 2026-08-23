"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createTimeEntryAction, type ActionState } from "@/lib/actions/time";
import { CaseCombobox } from "@/components/case-combobox";
import { FormError, SubmitButton } from "@/components/form-parts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BILLING_MODELS, BILLING_MODEL_LABELS, type BillingModel } from "@/lib/domain";
import type { CaseOption } from "@/lib/queries";

/** Czy fokus jest w polu, w którym skrót klawiszowy przeszkadzałby. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
}

export function QuickTimeEntry({
  cases,
  today,
  defaultCaseId,
}: {
  cases: CaseOption[];
  today: string;
  defaultCaseId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [caseId, setCaseId] = useState(defaultCaseId ?? "");
  const [billingType, setBillingType] = useState<BillingModel>("godzinowy");
  const [state, formAction] = useActionState<ActionState, FormData>(createTimeEntryAction, {});

  // Model rozliczenia podpowiadamy z warunków sprawy, ale zostawiamy do zmiany:
  // czynność pro bono zdarza się także w sprawie rozliczanej godzinowo.
  useEffect(() => {
    const selected = cases.find((item) => item.id === caseId);
    if (selected) setBillingType(selected.billingModel);
  }, [caseId, cases]);

  useEffect(() => {
    if (state.message) {
      toast.success(state.message);
      setOpen(false);
      setCaseId(defaultCaseId ?? "");
    }
  }, [state, defaultCaseId]);

  // Rejestracja czasu to czynność wykonywana kilkanaście razy dziennie —
  // musi być osiągalna jednym klawiszem z dowolnego ekranu.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "n" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      setOpen(true);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" className="gap-2" />}>
        <Plus className="size-4" aria-hidden="true" />
        Dodaj czas
        <kbd className="ml-1 hidden rounded border border-primary-foreground/25 px-1.5 py-0.5 font-mono text-[10px] text-primary-foreground/70 sm:inline">
          N
        </kbd>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Rejestracja czasu pracy</DialogTitle>
          <DialogDescription>
            Czas możesz wpisać jako 1:30, 1,5 h, 90m albo po prostu 90.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <FormError>{state.error}</FormError>

          <div className="space-y-2">
            <Label htmlFor="caseId">Sprawa</Label>
            <CaseCombobox cases={cases} value={caseId} onChange={setCaseId} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="workDate">Data</Label>
              <Input id="workDate" name="workDate" type="date" defaultValue={today} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Czas</Label>
              <Input
                id="duration"
                name="duration"
                placeholder="1:30"
                required
                inputMode="text"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="billingType">Model rozliczenia</Label>
            <Select
              name="billingType"
              value={billingType}
              onValueChange={(value) => setBillingType(value as BillingModel)}
            >
              <SelectTrigger id="billingType" aria-label="Model rozliczenia" className="w-full">
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Opis czynności</Label>
            <Textarea
              id="description"
              name="description"
              required
              rows={3}
              placeholder="np. Analiza odpowiedzi na pozew"
            />
            <p className="text-xs text-muted-foreground">
              Ten opis trafia do zestawienia godzin przekazywanego klientowi.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Anuluj
            </Button>
            <SubmitButton pendingLabel="Zapisywanie…">Zapisz wpis</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
