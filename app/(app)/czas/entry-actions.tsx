"use client";

import { useActionState, useState } from "react";
import { Lock, Pencil, Trash2 } from "lucide-react";

import {
  deleteTimeEntryAction,
  updateTimeEntryAction,
  type ActionState,
} from "@/lib/actions/time";
import { CaseCombobox } from "@/components/case-combobox";
import { FormError, SubmitButton } from "@/components/form-parts";
import { useActionFeedback } from "@/components/use-action-feedback";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BILLING_MODELS, BILLING_MODEL_LABELS, type BillingModel } from "@/lib/domain";
import { formatMinutesAsClock } from "@/lib/time";
import type { CaseOption } from "@/lib/queries";

export interface EditableEntry {
  id: string;
  caseId: string;
  workDate: string;
  minutes: number;
  description: string;
  billingType: BillingModel;
  locked: boolean;
}

export function EntryActions({
  entry,
  cases,
}: {
  entry: EditableEntry;
  cases: CaseOption[];
}) {
  const [open, setOpen] = useState(false);
  const [caseId, setCaseId] = useState(entry.caseId);
  const [billingType, setBillingType] = useState<BillingModel>(entry.billingType);
  const [state, formAction] = useActionState<ActionState, FormData>(updateTimeEntryAction, {});

  useActionFeedback(state, {
    onSuccess: () => {
      setOpen(false);
    },
  });

  // Wpis powiązany z zatwierdzoną fakturą jest zamknięty. Baza i tak odmówi
  // zmiany, ale interfejs ma to pokazać, a nie pozwolić się o to potknąć.
  if (entry.locked) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              className="inline-flex size-6 items-center justify-center text-muted-foreground"
              aria-label="Wpis rozliczony fakturą"
            />
          }
        >
          <Lock className="size-3.5" aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>Wpis jest rozliczony fakturą i nie można go zmienić</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="flex items-center gap-0.5">
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="Edytuj wpis"
        onClick={() => setOpen(true)}
      >
        <Pencil className="size-3.5" />
      </Button>

      <AlertDialog>
        <AlertDialogTrigger
          render={<Button variant="ghost" size="icon-xs" aria-label="Usuń wpis" />}
        >
          <Trash2 className="size-3.5" />
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć ten wpis?</AlertDialogTitle>
            <AlertDialogDescription>
              Wpis zniknie z ewidencji i przestanie być widoczny w zestawieniach.
              Tej operacji nie da się cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <form action={deleteTimeEntryAction}>
              <input type="hidden" name="id" value={entry.id} />
              <AlertDialogAction render={<button type="submit" />}>Usuń wpis</AlertDialogAction>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edycja wpisu</DialogTitle>
            <DialogDescription>
              Czas możesz wpisać jako 1:30, 1,5 h, 90m albo po prostu 90.
            </DialogDescription>
          </DialogHeader>

          <form action={formAction} className="space-y-4">
            <input type="hidden" name="id" value={entry.id} />
            <FormError>{state.error}</FormError>

            <div className="space-y-2">
              <Label htmlFor={`case-${entry.id}`}>Sprawa</Label>
              <CaseCombobox cases={cases} value={caseId} onChange={setCaseId} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor={`date-${entry.id}`}>Data</Label>
                <Input
                  id={`date-${entry.id}`}
                  name="workDate"
                  type="date"
                  defaultValue={entry.workDate}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`duration-${entry.id}`}>Czas</Label>
                <Input
                  id={`duration-${entry.id}`}
                  name="duration"
                  defaultValue={formatMinutesAsClock(entry.minutes)}
                  required
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`billing-${entry.id}`}>Model rozliczenia</Label>
              <Select
                name="billingType"
                value={billingType}
                onValueChange={(value) => setBillingType((value ?? "godzinowy") as BillingModel)}
              >
                <SelectTrigger
                  id={`billing-${entry.id}`}
                  aria-label="Model rozliczenia"
                  className="w-full"
                >
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
              <Label htmlFor={`desc-${entry.id}`}>Opis czynności</Label>
              <Textarea
                id={`desc-${entry.id}`}
                name="description"
                rows={3}
                required
                defaultValue={entry.description}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Anuluj
              </Button>
              <SubmitButton>Zapisz zmiany</SubmitButton>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
