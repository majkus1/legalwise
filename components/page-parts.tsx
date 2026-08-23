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
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
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
      <CardContent className="px-5 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p
          className={cn(
            "tabular mt-1.5 font-heading text-2xl font-semibold",
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
