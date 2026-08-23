"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createCalendarEventAction, type ActionState } from "@/lib/actions/tasks";
import { CaseCombobox } from "@/components/case-combobox";
import { FormError, SubmitButton } from "@/components/form-parts";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { EVENT_KINDS, EVENT_KIND_LABELS, type EventKind } from "@/lib/domain";
import type { CaseOption } from "@/lib/queries";

export function EventDialog({ cases, today }: { cases: CaseOption[]; today: string }) {
  const [open, setOpen] = useState(false);
  const [caseId, setCaseId] = useState("");
  const [eventKind, setEventKind] = useState<EventKind>("rozprawa");
  const [state, formAction] = useActionState<ActionState, FormData>(
    createCalendarEventAction,
    {},
  );

  useEffect(() => {
    if (state.message) {
      toast.success(state.message);
      setOpen(false);
      setCaseId("");
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="gap-2" />}>
        <Plus className="size-4" aria-hidden="true" />
        Dodaj termin
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nowy termin</DialogTitle>
          <DialogDescription>
            Godzinę podaj w czasie warszawskim — przeliczymy ją poprawnie także
            w okresie zmiany czasu.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="eventKind" value={eventKind} />
          <FormError>{state.error}</FormError>

          <div className="space-y-2">
            <Label htmlFor="title">Nazwa terminu</Label>
            <Input
              id="title"
              name="title"
              required
              autoFocus
              placeholder="np. Rozprawa — Acme przeciwko Beta Trade"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="eventKindSelect">Rodzaj</Label>
            <Select value={eventKind} onValueChange={(value) => setEventKind(value as EventKind)}>
              <SelectTrigger id="eventKindSelect" aria-label="Rodzaj" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_KINDS.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {EVENT_KIND_LABELS[kind]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="caseId">Sprawa</Label>
            <CaseCombobox cases={cases} value={caseId} onChange={setCaseId} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Data</Label>
              <Input id="date" name="date" type="date" defaultValue={today} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Godzina</Label>
              <Input id="time" name="time" type="time" defaultValue="09:00" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="durationMinutes">Czas trwania</Label>
              <Input
                id="durationMinutes"
                name="durationMinutes"
                type="number"
                min={0}
                max={1440}
                step={15}
                defaultValue={120}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Miejsce</Label>
            <Input
              id="location"
              name="location"
              placeholder="np. Sąd Okręgowy w Warszawie, sala 214"
            />
          </div>

          {/* Wprost z opisu klienta: ten sam termin nie ma być wpisywany
              dwa razy — raz w kalendarzu i raz na liście zadań. */}
          <div className="flex items-start gap-2.5 rounded-md border bg-muted/40 px-3 py-2.5">
            <Checkbox id="createTask" name="createTask" className="mt-0.5" />
            <Label htmlFor="createTask" className="text-sm font-normal">
              Utwórz też zadanie przygotowawcze z tym terminem
            </Label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Anuluj
            </Button>
            <SubmitButton>Dodaj termin</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
