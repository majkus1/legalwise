"use client";

import { useEffect, useState } from "react";
import { ThemeProvider as NextThemeProvider, useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Dostawca motywu.
 *
 * Dwa motywy: jasny i ciemny. Świadomie bez opcji „jak w systemie" — dawała
 * pozorny trzeci wybór, który u większości osób pokazywał to samo co jasny,
 * a jednocześnie kazała się zastanawiać, dlaczego aplikacja wygląda inaczej
 * na dwóch komputerach.
 *
 * Klasa motywu trafia na <html> skryptem wykonywanym przed pierwszym
 * malowaniem, więc przy wejściu w trybie ciemnym nie mignie białe tło.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      themes={["light", "dark"]}
      disableTransitionOnChange
    >
      {children}
    </NextThemeProvider>
  );
}

/**
 * Odczytuje motyw z klasy faktycznie ustawionej na <html>.
 *
 * Świadomie NIE opieramy się na `resolvedTheme` z biblioteki: po pełnym
 * przeładowaniu strony wartość ta pozostawała pusta, przez co opis przycisku
 * mówił „Włącz motyw ciemny", choć ciemny był już włączony — przycisk kłamał
 * o tym, co zrobi kliknięcie.
 *
 * Klasa na <html> jest ustawiana skryptem biblioteki przed pierwszym malowaniem
 * i jest jedynym miejscem, które zawsze odpowiada temu, co widzi użytkownik.
 * Obserwator pilnuje zmian wprowadzonych z innej karty lub przez samą bibliotekę.
 */
function useAppliedDarkMode(): boolean {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setIsDark(root.classList.contains("dark"));

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

/**
 * Przełącznik motywu — jedno kliknięcie zamienia jasny na ciemny i odwrotnie.
 *
 * Ikona pokazuje motyw, NA KTÓRY przełączy kliknięcie, spójnie z opisem
 * przycisku: w trybie jasnym widać księżyc i „Włącz motyw ciemny".
 */
export function ThemeToggle() {
  const { setTheme } = useTheme();
  const isDark = useAppliedDarkMode();
  const label = isDark ? "Włącz motyw jasny" : "Włącz motyw ciemny";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      className="text-muted-foreground hover:text-foreground"
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {/* Księżyc w trybie jasnym, słońce w ciemnym. Obie ikony są w drzewie,
          a przełącza je klasa motywu — dzięki temu ikona jest poprawna już
          przy pierwszym malowaniu i nie przeskakuje po wczytaniu strony. */}
      <Moon className="size-4 dark:hidden" aria-hidden="true" />
      <Sun className="hidden size-4 dark:block" aria-hidden="true" />
    </Button>
  );
}
