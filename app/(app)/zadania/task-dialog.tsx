"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";

import { createTaskAction, type ActionState } from "@/lib/actions/tasks";
import { CaseCombobox } from "@/components/case-combobox";
import { FormError, SubmitButton } from "@/components/form-parts";
import { useActionFeedback } from "@/components/use-action-feedback";
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
import {
  TASK_KINDS,
  TASK_KIND_LABELS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  type TaskKind,
  type TaskPriority,
} from "@/lib/domain";
import type { CaseOption, MemberOption } from "@/lib/queries";

export function TaskDialog({
  cases,
  members,
  today,
  defaultCaseId,
}: {
  cases: CaseOption[];
  members: MemberOption[];
  today: string;
  /**
   * Sprawa narzucona z góry — ustawiana, gdy okno otwierane jest z karty
   * konkretnej sprawy. Pole wyboru ustępuje wtedy miejsca nazwie sprawy:
   * skoro ktoś jest w środku sprawy, zmiana jej w tym oknie byłaby
   * zaskoczeniem, a nie udogodnieniem.
   */
  defaultCaseId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [caseId, setCaseId] = useState(defaultCaseId ?? "");
  const [assigneeId, setAssigneeId] = useState("");
  const [taskKind, setTaskKind] = useState<TaskKind>("zadanie");
  const [priority, setPriority] = useState<TaskPriority>("normalny");
  const [state, formAction] = useActionState<ActionState, FormData>(createTaskAction, {});

  useActionFeedback(state, {
    onSuccess: () => {
      setOpen(false);
      setCaseId(defaultCaseId ?? "");
    },
  });

  const isDeficiency = taskKind === "brak_formalny";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="gap-2" />}>
        <Plus className="size-4" aria-hidden="true" />
        Dodaj zadanie
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nowe zadanie</DialogTitle>
          <DialogDescription>
            Braki formalne prowadzimy jako osobny rodzaj — zawsze z terminem.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="assigneeId" value={assigneeId} />
          <input type="hidden" name="taskKind" value={taskKind} />
          <input type="hidden" name="priority" value={priority} />
          <FormError>{state.error}</FormError>

          <div className="space-y-2">
            <Label htmlFor="title">Treść zadania</Label>
            <Input
              id="title"
              name="title"
              required
              autoFocus
              placeholder={
                isDeficiency
                  ? "np. Uzupełnić opłatę od apelacji"
                  : "np. Złożyć wniosek dowodowy o powołanie biegłego"
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="taskKindSelect">Rodzaj</Label>
              <Select value={taskKind} onValueChange={(value) => setTaskKind(value as TaskKind)}>
                <SelectTrigger id="taskKindSelect" aria-label="Rodzaj" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_KINDS.map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {TASK_KIND_LABELS[kind]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prioritySelect">Priorytet</Label>
              <Select
                value={priority}
                onValueChange={(value) => setPriority(value as TaskPriority)}
              >
                <SelectTrigger id="prioritySelect" aria-label="Priorytet" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {TASK_PRIORITY_LABELS[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="caseId">Sprawa</Label>
            {defaultCaseId ? (
              <>
                <input type="hidden" name="caseId" value={defaultCaseId} />
                <p className="rounded-lg border border-input bg-muted/40 px-3 py-2 text-sm">
                  {(() => {
                    const sprawa = cases.find((item) => item.id === defaultCaseId);
                    return sprawa ? `${sprawa.caseNumber} — ${sprawa.title}` : "Bieżąca sprawa";
                  })()}
                </p>
              </>
            ) : (
              <>
                <CaseCombobox cases={cases} value={caseId} onChange={setCaseId} />
                <p className="text-xs text-muted-foreground">
                  Zadanie może nie dotyczyć konkretnej sprawy — pozostaw puste.
                </p>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="assigneeSelect">Odpowiedzialny</Label>
              <Select value={assigneeId} onValueChange={(value) => setAssigneeId(value ?? "")}>
                <SelectTrigger id="assigneeSelect" aria-label="Odpowiedzialny" className="w-full">
                  <SelectValue placeholder="Nikt" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((member) => (
                    <SelectItem key={member.userId} value={member.userId}>
                      {member.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">
                Termin{isDeficiency && <span className="text-destructive"> *</span>}
              </Label>
              <Input
                id="dueDate"
                name="dueDate"
                type="date"
                defaultValue={isDeficiency ? today : ""}
                required={isDeficiency}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Uwagi</Label>
            <Textarea id="description" name="description" rows={2} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Anuluj
            </Button>
            <SubmitButton>Dodaj zadanie</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
