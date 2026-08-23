"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { CheckCircle2, Ban, Trash2, Wallet } from "lucide-react";
import {
  approveInvoiceAction,
  cancelInvoiceAction,
  deleteInvoiceDraftAction,
  markInvoicePaidAction,
  type ActionState,
} from "@/lib/actions/invoices";
import { FormError, SubmitButton } from "@/components/form-parts";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { InvoiceStatus } from "@/lib/domain";

export function InvoiceActions({
  invoiceId,
  status,
  ksefAccepted,
}: {
  invoiceId: string;
  status: InvoiceStatus;
  ksefAccepted: boolean;
}) {
  const [approveState, approve] = useActionState<ActionState, FormData>(approveInvoiceAction, {});
  const [cancelState, cancel] = useActionState<ActionState, FormData>(cancelInvoiceAction, {});

  useEffect(() => {
    if (approveState.message) toast.success(approveState.message);
    if (approveState.error) toast.error(approveState.error);
  }, [approveState]);

  useEffect(() => {
    if (cancelState.message) toast.success(cancelState.message);
    if (cancelState.error) toast.error(cancelState.error);
  }, [cancelState]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "draft" && (
        <>
          <AlertDialog>
            <AlertDialogTrigger render={<Button className="gap-2" />}>
              <CheckCircle2 className="size-4" aria-hidden="true" />
              Zatwierdź fakturę
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Zatwierdzić fakturę?</AlertDialogTitle>
                <AlertDialogDescription>
                  Faktura otrzyma kolejny numer z ciągu, a dane sprzedawcy i nabywcy zostaną
                  utrwalone. Powiązane wpisy czasu zostaną zablokowane i nie będzie już można ich
                  edytować. Tej operacji nie da się cofnąć — błędną fakturę można wyłącznie
                  anulować.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <FormError>{approveState.error}</FormError>
              <AlertDialogFooter>
                <AlertDialogCancel>Jeszcze nie</AlertDialogCancel>
                <form action={approve}>
                  <input type="hidden" name="id" value={invoiceId} />
                  <SubmitButton pendingLabel="Zatwierdzanie…">Zatwierdź i nadaj numer</SubmitButton>
                </form>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger render={<Button variant="ghost" className="gap-2" />}>
              <Trash2 className="size-4" aria-hidden="true" />
              Usuń szkic
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Usunąć projekt faktury?</AlertDialogTitle>
                <AlertDialogDescription>
                  Godziny wrócą do puli niezafakturowanych i będzie je można ująć na innej
                  fakturze. Szkic nie ma numeru, więc jego usunięcie nie robi dziury w numeracji.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Anuluj</AlertDialogCancel>
                <form action={deleteInvoiceDraftAction}>
                  <input type="hidden" name="id" value={invoiceId} />
                  <SubmitButton variant="destructive">Usuń szkic</SubmitButton>
                </form>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}

      {(status === "approved" || status === "sent") && (
        <>
          <form action={markInvoicePaidAction}>
            <input type="hidden" name="id" value={invoiceId} />
            <SubmitButton variant="outline" className="gap-2">
              <Wallet className="size-4" aria-hidden="true" />
              Oznacz jako opłaconą
            </SubmitButton>
          </form>

          {/* Faktura przyjęta przez KSeF wymaga korekty, nie anulowania —
              blokujemy tę ścieżkę już w interfejsie. */}
          {!ksefAccepted && (
            <AlertDialog>
              <AlertDialogTrigger render={<Button variant="ghost" className="gap-2" />}>
                <Ban className="size-4" aria-hidden="true" />
                Anuluj fakturę
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Anulować fakturę?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Numer pozostanie zajęty — zwolnienie go zrobiłoby dziurę w numeracji.
                    Powiązane godziny wrócą do puli niezafakturowanych.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <form action={cancel} className="space-y-4">
                  <input type="hidden" name="id" value={invoiceId} />
                  <FormError>{cancelState.error}</FormError>
                  <div className="space-y-2">
                    <Label htmlFor="reason">Powód anulowania</Label>
                    <Input id="reason" name="reason" placeholder="np. błędne dane nabywcy" />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Wróć</AlertDialogCancel>
                    <SubmitButton variant="destructive">Anuluj fakturę</SubmitButton>
                  </AlertDialogFooter>
                </form>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </>
      )}
    </div>
  );
}
