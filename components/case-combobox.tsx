"use client";

import { useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BILLING_MODEL_LABELS } from "@/lib/domain";
import { matchesSearch } from "@/lib/text";
import type { CaseOption } from "@/lib/queries";
import { cn } from "@/lib/utils";

/** Ile pozycji pokazujemy naraz — długa lista i tak jest nieczytelna. */
const MAX_VISIBLE = 50;

export function CaseCombobox({
  cases,
  value,
  onChange,
  name = "caseId",
  autoFocus,
}: {
  cases: CaseOption[];
  value: string;
  onChange: (caseId: string) => void;
  name?: string;
  autoFocus?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = cases.find((item) => item.id === value);

  const filtered = useMemo(() => {
    if (query.trim() === "") return cases.slice(0, MAX_VISIBLE);
    return cases
      .filter((item) =>
        matchesSearch(
          `${item.caseNumber} ${item.title} ${item.clientName} ${item.signature ?? ""}`,
          query,
        ),
      )
      .slice(0, MAX_VISIBLE);
  }, [cases, query]);

  return (
    <>
      <input type="hidden" name={name} value={value} />

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              autoFocus={autoFocus}
              className="h-auto w-full justify-between px-3 py-2 text-left font-normal"
            />
          }
        >
          {selected ? (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {selected.caseNumber} — {selected.title}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {selected.clientName} · {BILLING_MODEL_LABELS[selected.billingModel]}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">Wybierz sprawę…</span>
          )}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" aria-hidden="true" />
        </PopoverTrigger>

        {/* initialFocus kieruje fokus prosto do pola wyszukiwania po otwarciu —
            bez tego trzeba by najpierw przejść przez listę tabulatorem. */}
        <PopoverContent
          className="w-[min(28rem,calc(100vw-2rem))] p-0"
          align="start"
          initialFocus={searchRef}
        >
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <Input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Numer, nazwa, klient lub sygnatura"
              className="border-0 px-0 shadow-none focus-visible:ring-0"
            />
          </div>

          <ul className="max-h-72 overflow-y-auto py-1" role="listbox">
            {filtered.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                Brak spraw pasujących do wyszukiwania.
              </li>
            )}

            {filtered.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={item.id === value}
                  onClick={() => {
                    onChange(item.id);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={cn(
                    "flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-accent",
                    item.id === value && "bg-accent",
                  )}
                >
                  <Check
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      item.id === value ? "opacity-100" : "opacity-0",
                    )}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {item.caseNumber} — {item.title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.clientName}
                      {item.signature ? ` · ${item.signature}` : ""} ·{" "}
                      {BILLING_MODEL_LABELS[item.billingModel]}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    </>
  );
}
