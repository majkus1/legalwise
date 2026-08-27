import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  /** Może zawierać odnośniki, np. do klienta przy nagłówku sprawy. */
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {/* Bez `min-w-0` i z `shrink-0` ten kontener przyjmowal szerokosc swojej
          tresci i odmawial jej oddania, wiec na waskim ekranie przyciski
          wychodzily poza krawedz zamiast przejsc do nastepnego wiersza. */}
      {actions && (
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
      )}
    </div>
  );
}

/**
 * Kafelek wskaźnika — forma bez wykresu.
 *
 * Liczba jest tu treścią, więc niesie ją token tekstu, a nie kolor serii.
 * Cyfry tabelaryczne trzymają wartości w jednej kolumnie przy porównywaniu
 * kafelków obok siebie.
 */
export function StatTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "warning" | "muted";
}) {
  return (
    <Card>
      {/* Karta ma juz wlasny odstep pionowy — dokladanie tu `py-4` dawalo
          64 px pustki na dwuwierszowy kafelek, czyli pol ekranu telefonu
          na cztery liczby. */}
      <CardContent className="px-4 sm:px-5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">
          {label}
        </p>
        <p
          className={cn(
            "tabular mt-1 font-heading text-xl font-semibold sm:mt-1.5 sm:text-2xl",
            tone === "warning" && "text-[var(--warning)]",
            tone === "muted" && "text-muted-foreground",
          )}
        >
          {value}
        </p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

/**
 * Stan pusty: jedno zdanie wyjaśnienia i jedna akcja.
 *
 * Pusta tabela bez wyjaśnienia wygląda jak awaria. Użytkownik ma od razu
 * wiedzieć, czy czegoś nie ma, czy czegoś nie widzi.
 */
export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  icon: Icon,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-12 text-center">
      {Icon && (
        <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-muted">
          <Icon className="size-5 text-muted-foreground" />
        </div>
      )}
      <p className="font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="mt-4 text-sm font-medium text-[var(--brand-gold-text)] underline-offset-4 hover:underline"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

/** Etykieta pola w karcie szczegółów. */
export function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(9rem,auto)_1fr] gap-x-4 gap-y-1 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 font-medium">{children ?? "—"}</dd>
    </div>
  );
}

/**
 * Kafelek rekordu na wąskie ekrany — zamiennik wiersza tabeli.
 *
 * Tabele kartoteki potrzebują na telefonie od 450 do 700 px przewijania w bok,
 * więc status sprawy czy kwota faktury są poza zasięgiem wzroku, dopóki ktoś
 * nie przesunie widoku palcem. Na wąskim ekranie ten sam rekord układamy więc
 * pionowo: nazwa, podpis i pola jedno pod drugim.
 *
 * Tabela zostaje dla szerokich ekranów — tam porównywanie wierszy w kolumnach
 * jest właśnie tym, czego się oczekuje.
 */
export function RecordCard({
  href,
  title,
  subtitle,
  badge,
  fields,
}: {
  href?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  /** Pary etykieta–wartość. Puste wartości pomijamy, żeby nie mnożyć myślników. */
  fields: { label: string; value: React.ReactNode }[];
}) {
  const naglowek = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate font-medium">{title}</p>
        {subtitle && <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {badge && <div className="shrink-0">{badge}</div>}
    </div>
  );

  return (
    <li className="rounded-lg border bg-card p-4 text-sm">
      {href ? (
        <Link href={href} className="block underline-offset-4 hover:underline">
          {naglowek}
        </Link>
      ) : (
        naglowek
      )}

      {fields.length > 0 && (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
          {fields.map((field) => (
            <div key={field.label} className="min-w-0">
              <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">
                {field.label}
              </dt>
              <dd className="truncate">{field.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </li>
  );
}

/** Lista kafelków — widoczna wyłącznie tam, gdzie tabela się nie mieści. */
export function RecordCardList({ children }: { children: React.ReactNode }) {
  return <ul className="space-y-3 md:hidden">{children}</ul>;
}

/**
 * Przełącznik zakresu listy — jawny wybór zamiast dwuznacznego „pokaż/ukryj".
 *
 * Napis „Pokaż zakończone" nie rozstrzygał, czy zakończone mają dołączyć do
 * bieżących, czy je zastąpić. Widok pokazywał jedno i drugie naraz, więc nie
 * dało się tego odgadnąć nawet po kliknięciu. Tu każda opcja mówi wprost, co
 * będzie na liście, a zaznaczona jest widoczna na pierwszy rzut oka.
 */
export function ScopeSwitch({
  label,
  options,
}: {
  /** Opis dla czytnika ekranu, np. „Zakres spraw". */
  label: string;
  options: { href: string; label: string; active: boolean }[];
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex flex-wrap items-center gap-1 rounded-lg border bg-muted/40 p-1"
    >
      {options.map((option) => (
        <Link
          key={option.href}
          href={option.href}
          aria-current={option.active ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm transition-colors",
            option.active
              ? "bg-background font-medium text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}
