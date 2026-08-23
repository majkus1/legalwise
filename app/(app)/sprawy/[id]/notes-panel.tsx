"use client";

import { useActionState, useRef } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  addCaseNoteAction,
  deleteCaseNoteAction,
  type ActionState,
} from "@/lib/actions/cases";
import { FormError, SubmitButton } from "@/components/form-parts";
import { EmptyState } from "@/components/page-parts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/time";

export interface CaseNote {
  id: string;
  occurredOn: string;
  content: string;
  authorId: string | null;
  authorName: string;
}

export function NotesPanel({
  caseId,
  notes,
  today,
  currentUserId,
}: {
  caseId: string;
  notes: CaseNote[];
  today: string;
  currentUserId: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(addCaseNoteAction, {});
  const formRef = useRef<HTMLFormElement>(null);

  if (state.message) {
    toast.success(state.message);
    formRef.current?.reset();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div>
        {notes.length === 0 ? (
          <EmptyState
            title="Brak notatek"
            description="Zapisuj tu ustalenia telefoniczne z sądem i klientem — będą częścią historii sprawy."
          />
        ) : (
          <ul className="space-y-3">
            {notes.map((note) => (
              <li key={note.id}>
                <Card>
                  <CardContent className="px-5 py-4">
                    <div className="mb-2 flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">{note.authorName}</p>
                        <p className="tabular text-xs text-muted-foreground">
                          {formatDate(note.occurredOn)}
                        </p>
                      </div>

                      {/* Notatkę może usunąć wyłącznie jej autor — tak samo
                          jak stanowi o tym polityka RLS w bazie. */}
                      {note.authorId === currentUserId && (
                        <form action={deleteCaseNoteAction}>
                          <input type="hidden" name="id" value={note.id} />
                          <input type="hidden" name="caseId" value={caseId} />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="icon-xs"
                            aria-label="Usuń notatkę"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </form>
                      )}
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Card className="h-fit">
        <CardContent className="pt-6">
          <form ref={formRef} action={formAction} className="space-y-4">
            <input type="hidden" name="caseId" value={caseId} />
            <FormError>{state.error}</FormError>

            <div className="space-y-2">
              <Label htmlFor="occurredOn">Data zdarzenia</Label>
              <Input id="occurredOn" name="occurredOn" type="date" defaultValue={today} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Treść notatki</Label>
              <Textarea
                id="content"
                name="content"
                rows={5}
                required
                placeholder="np. Rozmowa z sekretariatem wydziału — akta przekazane biegłemu."
              />
            </div>

            <SubmitButton className="w-full">Dodaj notatkę</SubmitButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
