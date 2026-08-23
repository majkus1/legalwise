import Link from "next/link";
import type { VariantProps } from "class-variance-authority";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ButtonStyle = VariantProps<typeof buttonVariants>;

/**
 * Odnośnik wyglądający jak przycisk.
 *
 * Świadomie NIE używamy tu komponentu Button z podmienionym znacznikiem.
 * Base UI zakłada, że przycisk jest przyciskiem, i przy podmianie na odnośnik
 * albo ostrzega w konsoli, albo — po wyłączeniu tego założenia — nadaje
 * elementowi role="button". Kotwica z rolą przycisku traci to, po co sięga się
 * po odnośnik: otwieranie w nowej karcie, kliknięcie środkowym przyciskiem
 * i menu kontekstowe przeglądarki.
 *
 * Bierzemy więc same klasy wyglądu i nakładamy je na prawdziwy odnośnik.
 */
export function ButtonLink({
  href,
  variant,
  size,
  className,
  children,
  ...props
}: React.ComponentProps<typeof Link> & ButtonStyle) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant, size }), className)} {...props}>
      {children}
    </Link>
  );
}

/** Wariant dla adresów obsługiwanych poza nawigacją Next (pliki PDF, XML). */
export function ButtonAnchor({
  variant,
  size,
  className,
  children,
  ...props
}: React.ComponentProps<"a"> & ButtonStyle) {
  return (
    <a className={cn(buttonVariants({ variant, size }), className)} {...props}>
      {children}
    </a>
  );
}
