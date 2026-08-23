import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Logo kancelarii w wersji obrazkowej.
 *
 * Plik z logo ma granatowy napis, więc nadaje się wyłącznie na jasne tło.
 * Na granatowym panelu bocznym używamy wersji tekstowej poniżej.
 */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/logo-legal-wise.png"
      alt="Legal-Wise — Śliwiński & Kucharski, adwokaci i radcowie prawni"
      width={1164}
      height={289}
      priority
      className={cn("h-auto w-full max-w-[280px]", className)}
    />
  );
}

/**
 * Znak słowny odtworzony tekstem — dostosowuje się do tła.
 *
 * Złoto jest tu użyte jako wypełnienie liter na ciemnym tle, gdzie ma
 * wystarczający kontrast. Na jasnym tle złoty tekst dawałby 2,89:1
 * i nie spełniałby WCAG AA.
 */
export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-heading text-lg font-bold tracking-[0.18em]", className)}>
      LEGAL<span className="text-[var(--brand-gold)]">WISE</span>
    </span>
  );
}

/** Kwadratowy znak graficzny — schodkowa forma z logo. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn("size-7 shrink-0", className)}
      fill="none"
    >
      <path d="M3 3h7v20h9v6H3V3Z" fill="currentColor" />
      <path d="M15 3h14v7h-7v13h-7V3Z" fill="var(--brand-gold)" />
    </svg>
  );
}
