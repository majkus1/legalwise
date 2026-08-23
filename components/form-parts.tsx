"use client";

import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Przycisk zatwierdzający formularz, który sam pokazuje stan wysyłki.
 *
 * Blokada podczas wysyłki nie jest kosmetyką: bez niej podwójne kliknięcie
 * przy zatwierdzaniu faktury potrafi utworzyć dwa dokumenty.
 */
export function SubmitButton({
  children,
  className,
  variant,
  size,
  pendingLabel,
}: {
  children: React.ReactNode;
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className={className} variant={variant} size={size}>
      {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
      {pending ? (pendingLabel ?? "Zapisywanie…") : children}
    </Button>
  );
}

export function FormError({ children, className }: { children?: string; className?: string }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive",
        className,
      )}
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

export function FormSuccess({ children, className }: { children?: string; className?: string }) {
  if (!children) return null;
  return (
    <p
      role="status"
      className={cn(
        "flex items-start gap-2 rounded-md border border-[var(--success)]/30 bg-[var(--success)]/5 px-3 py-2 text-sm text-[var(--success)]",
        className,
      )}
    >
      <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
