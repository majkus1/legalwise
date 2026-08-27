"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Calculator, Loader2 } from "lucide-react";
import {
  createInvoiceDraftAction,
  previewPeriodAction,
  type ActionState,
} from "@/lib/actions/invoices";
import { FormError, SubmitButton } from "@/components/form-parts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatGrosz } from "@/lib/money";

type Preview = Awaited<ReturnType<typeof previewPeriodAction>>;

export function PeriodWizard({
  clients,
  defaultFrom,
  defaultTo,
}: {
  clients: { id: string; name: string }[];
  defaultFrom: string;
  defaultTo: string;
}) {
  const [clientId, setClientId] = useState("");
  const [periodFrom, setPeriodFrom] = useState(defaultFrom);
  const [periodTo, setPeriodTo] = useState(defaultTo);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [pending, startTransition] = useTransition();
  const [state, formAction] = useActionState<ActionState, FormData>(createInvoiceDraftAction, {});

  // Podgląd liczy dokładnie ten sam kod, co utworzenie faktury — to, co
  // użytkownik zobaczy przed zatwierdzeniem, jest tym, co powstanie.
  useEffect(() => {
    startTransition(async () => {
      if (!clientId) {
        setPreview(null);
        return;
      }
      setPreview(await previewPeriodAction(clientId, periodFrom, periodTo));
    });
  }, [clientId, periodFrom, periodTo]);

  const hasLines = (preview?.lines.length ?? 0) > 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <Card className="h-fit">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Zakres rozliczenia</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="clientId" value={clientId} />
            <FormError>{state.error}</FormError>

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
              <Label htmlFor="periodFrom">Okres od</Label>
              <Input
                id="periodFrom"
                name="periodFrom"
                type="date"
                value={periodFrom}
                onChange={(event) => setPeriodFrom(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="periodTo">Okres do</Label>
              <Input
                id="periodTo"
                name="periodTo"
                type="date"
                value={periodTo}
                onChange={(event) => setPeriodTo(event.target.value)}
                required
              />
            </div>

            <SubmitButton className="w-full" pendingLabel="Tworzenie projektu…">
              Utwórz projekt faktury
            </SubmitButton>

            <p className="text-xs text-muted-foreground">
              Powstanie szkic. Numer zostanie nadany dopiero przy zatwierdzeniu, więc porzucone
              projekty nie robią dziur w numeracji.
            </p>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calculator className="size-4 text-muted-foreground" aria-hidden="true" />
            Podgląd wyceny
            {pending && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!clientId ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Wybierz klienta, aby zobaczyć, co zostanie zafakturowane.
            </p>
          ) : !hasLines ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              W tym okresie nie ma nic do zafakturowania.
              {preview?.entryCount === 0
                ? " Nie zarejestrowano żadnych godzin."
                : " Zarejestrowane godziny trafiły już na inną fakturę albo są nieodpłatne."}
            </p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pozycja</TableHead>
                      <TableHead className="text-right">Ilość</TableHead>
                      <TableHead className="text-right">Netto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview!.lines.map((line, index) => (
                      <TableRow key={index}>
                        <TableCell>{line.description}</TableCell>
                        <TableCell className="tabular text-right whitespace-nowrap">
                          {new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 }).format(
                            line.quantity,
                          )}{" "}
                          {line.unit}
                        </TableCell>
                        <TableCell className="tabular text-right">
                          {formatGrosz(line.netGrosz)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-4 flex flex-col items-end gap-1 text-sm">
                <div className="flex w-56 justify-between">
                  <span className="text-muted-foreground">Razem netto</span>
                  <span className="tabular font-medium">
                    {formatGrosz(preview!.totalNetGrosz)}
                  </span>
                </div>
                <div className="flex w-56 justify-between border-t pt-1">
                  <span className="font-medium">Razem brutto</span>
                  <span className="tabular font-heading text-base font-semibold">
                    {formatGrosz(preview!.totalGrossGrosz)}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Na podstawie {preview!.entryCount}{" "}
                  {preview!.entryCount === 1 ? "wpisu" : "wpisów"} czasu
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
