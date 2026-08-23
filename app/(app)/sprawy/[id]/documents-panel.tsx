"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Download, FileText, Loader2, Trash2 } from "lucide-react";
import {
  createDocumentDownloadUrl,
  deleteDocumentAction,
  uploadDocumentAction,
  type ActionState,
} from "@/lib/actions/documents";
import { FormError, SubmitButton } from "@/components/form-parts";
import { EmptyState } from "@/components/page-parts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/time";

export interface CaseDocument {
  id: string;
  fileName: string;
  sizeBytes: number | null;
  createdAt: string;
  uploadedByName: string;
}

function formatSize(bytes: number | null): string {
  if (bytes === null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DownloadButton({ documentId, fileName }: { documentId: string; fileName: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={`Pobierz ${fileName}`}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          // Bucket jest prywatny — adres do pobrania powstaje dopiero teraz,
          // po sprawdzeniu uprawnień, i wygasa po minucie.
          const result = await createDocumentDownloadUrl(documentId);
          if (result.error || !result.url) {
            toast.error(result.error ?? "Nie udało się przygotować pobrania");
            return;
          }
          window.location.href = result.url;
        })
      }
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
    </Button>
  );
}

export function DocumentsPanel({
  caseId,
  documents,
}: {
  caseId: string;
  documents: CaseDocument[];
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(uploadDocumentAction, {});
  const [fileName, setFileName] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  if (state.message) {
    toast.success(state.message);
    formRef.current?.reset();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div>
        {documents.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Brak dokumentów"
            description="Wgraj pisma, umowy i dokumentację źródłową. Pliki są prywatne — pobranie wymaga dostępu do sprawy."
          />
        ) : (
          <ul className="space-y-2">
            {documents.map((document) => (
              <li key={document.id}>
                <Card>
                  <CardContent className="flex items-center justify-between gap-4 px-5 py-3.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{document.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {document.uploadedByName} · {formatDateTime(document.createdAt)}
                          {document.sizeBytes ? ` · ${formatSize(document.sizeBytes)}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <DownloadButton documentId={document.id} fileName={document.fileName} />
                      <form action={deleteDocumentAction}>
                        <input type="hidden" name="id" value={document.id} />
                        <input type="hidden" name="caseId" value={caseId} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Usuń ${document.fileName}`}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </form>
                    </div>
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
              <Label htmlFor="file">Dokument</Label>
              <Input
                id="file"
                name="file"
                type="file"
                required
                onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}
              />
              <p className="text-xs text-muted-foreground">
                Do 25 MB. PDF, dokumenty, arkusze, obrazy i wiadomości e-mail.
              </p>
            </div>

            <SubmitButton className="w-full" pendingLabel="Wgrywanie…">
              {fileName ? `Wgraj ${fileName.slice(0, 24)}` : "Wgraj plik"}
            </SubmitButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
