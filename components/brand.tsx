import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Logo kancelarii. Wyłącznie z pliku dostarczonego przez klienta.
 *
 * Warianty wytwarza `npm run generate:brand` przez kadrowanie i przebarwienie
 * tuszu w oryginale — nic nie jest tu rysowane od nowa. Znak firmowy jest
 * własnością kancelarii i jego odrysowanie daje kształt, który nie jest ich
 * znakiem, choćby był łudząco podobny.
 */

const PELNE = { width: 1168, height: 292 };
const ZNAK = { width: 243, height: 252 };

/**
 * Pełne logo dopasowane do motywu.
 *
 * Oryginał ma granatowy tusz, więc na ciemnym tle znika. Podmieniamy go
 * wariantem rewersowym tą samą klasą `dark:`, która przełącza resztę motywu —
 * dzięki temu właściwa wersja jest widoczna już przy pierwszym malowaniu
 * i nie mruga po wczytaniu strony.
 */
export function BrandLogo({ className }: { className?: string }) {
  const alt = "Legal-Wise — Śliwiński & Kucharski, adwokaci i radcowie prawni";
  const wspolne = cn("h-auto w-full max-w-[280px]", className);

  // Opis niosą OBA warianty. Element ukryty przez `display: none` nie trafia
  // do drzewa dostępności, więc w danej chwili czytnik ekranu widzi dokładnie
  // jeden obrazek — nie ma ani dublowania, ani logo bez nazwy w jednym motywie.
  return (
    <>
      <Image
        src="/logo-legal-wise.png"
        alt={alt}
        {...PELNE}
        priority
        className={cn(wspolne, "dark:hidden")}
      />
      <Image
        src="/logo-legal-wise-rewers.png"
        alt={alt}
        {...PELNE}
        priority
        className={cn(wspolne, "hidden dark:block")}
      />
    </>
  );
}

/**
 * Pełne logo w wersji rewersowej — na granatowy panel boczny.
 *
 * Panel jest granatowy w OBU motywach, więc nie ma tu czego przełączać:
 * zawsze idzie wariant z jasnym tuszem, w którym napis „LEGALWISE" i podpis
 * kancelarii są czytelne na ciemnym tle.
 */
export function BrandLogoReversed({ className }: { className?: string }) {
  return (
    <Image
      src="/logo-legal-wise-rewers.png"
      alt="Legal-Wise — Śliwiński & Kucharski, adwokaci i radcowie prawni"
      {...PELNE}
      priority
      className={cn("h-auto w-full", className)}
    />
  );
}

/** Sam znak graficzny na ciemne tło — tam, gdzie na napis nie ma miejsca. */
export function BrandMarkReversed({ className }: { className?: string }) {
  return (
    <Image
      src="/logo-legal-wise-znak-rewers.png"
      alt=""
      aria-hidden="true"
      {...ZNAK}
      priority
      className={cn("h-7 w-auto shrink-0", className)}
    />
  );
}

/** Znak graficzny na tle strony — przełączany razem z motywem. */
export function BrandMark({ className }: { className?: string }) {
  const wspolne = cn("h-7 w-auto shrink-0", className);

  return (
    <>
      <Image
        src="/logo-legal-wise-znak.png"
        alt=""
        aria-hidden="true"
        {...ZNAK}
        priority
        className={cn(wspolne, "dark:hidden")}
      />
      <Image
        src="/logo-legal-wise-znak-rewers.png"
        alt=""
        aria-hidden="true"
        {...ZNAK}
        priority
        className={cn(wspolne, "hidden dark:block")}
      />
    </>
  );
}
