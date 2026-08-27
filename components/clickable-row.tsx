"use client";

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { shouldActivateRow } from "@/lib/row-activation";
import { TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * Wiersz tabeli otwierający rekord kliknięciem w dowolne miejsce.
 *
 * Zaznaczanie tekstu zostaje sprawne: przed przejściem sprawdzamy, czy coś jest
 * zaznaczone i czy mysz nie przejechała drogi — patrz `shouldActivateRow`.
 *
 * Wiersz świadomie NIE dostaje roli przycisku ani `tabIndex`. Klikalny wiersz
 * to udogodnienie dla myszy; drogą dla klawiatury i dla otwierania w nowej
 * karcie zostaje prawdziwy odnośnik w pierwszej kolumnie. Zrobienie z wiersza
 * przycisku odebrałoby ten odnośnik czytnikom ekranu, nic nie dając w zamian.
 */
export function ClickableRow({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);

  const rememberPress = useCallback((event: React.MouseEvent) => {
    pressOrigin.current = { x: event.clientX, y: event.clientY };
  }, []);

  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      const origin = pressOrigin.current;
      pressOrigin.current = null;

      // Kliknięcie w odnośnik lub przycisk wewnątrz wiersza obsługuje sam
      // element — wchodzenie mu w drogę psułoby np. przejście do klienta.
      if ((event.target as HTMLElement).closest("a, button, input, select, textarea")) return;

      // Środkowy przycisk i kliknięcie z modyfikatorem otwierają w nowej karcie
      // tylko przez prawdziwy odnośnik, więc tutaj je pomijamy.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const aktywuj = shouldActivateRow({
        dx: origin ? event.clientX - origin.x : 0,
        dy: origin ? event.clientY - origin.y : 0,
        selectedText: window.getSelection()?.toString() ?? "",
      });

      if (aktywuj) router.push(href);
    },
    [href, router],
  );

  return (
    <TableRow
      onMouseDown={rememberPress}
      onClick={handleClick}
      className={cn("cursor-pointer", className)}
    >
      {children}
    </TableRow>
  );
}
