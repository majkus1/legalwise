"use client";

import { ThemeProvider as NextThemeProvider, useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Dostawca motywu.
 *
 * Zapisuje wybór w pamięci przeglądarki i ustawia klasę na elemencie <html>
 * jeszcze przed pierwszym malowaniem — dzięki temu przy wejściu na stronę
 * w trybie ciemnym nie mignie białe tło.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemeProvider>
  );
}

const OPTIONS = [
  { value: "light", label: "Jasny", icon: Sun },
  { value: "dark", label: "Ciemny", icon: Moon },
  { value: "system", label: "Jak w systemie", icon: Monitor },
] as const;

/**
 * Przełącznik motywu.
 *
 * Trzy opcje zamiast prostego przełącznika: „jak w systemie" jest wartością
 * domyślną i pozwala aplikacji ściemnić się razem z resztą urządzenia
 * wieczorem, bez ręcznego przestawiania.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
            aria-label="Zmień motyw"
          />
        }
      >
        {/* Obie ikony są w drzewie, a przełącza je klasa motywu — dzięki temu
            nie trzeba czekać na montowanie komponentu po stronie przeglądarki
            i ikona nie przeskakuje po wczytaniu strony. */}
        <Sun className="size-4 dark:hidden" aria-hidden="true" />
        <Moon className="hidden size-4 dark:block" aria-hidden="true" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => setTheme(option.value)}
              className="gap-2"
            >
              <Icon className="size-4" aria-hidden="true" />
              {option.label}
              {theme === option.value && (
                <span className="ml-auto text-[var(--brand-gold-text)]" aria-hidden="true">
                  ●
                </span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
