/**
 * Odczyt konfiguracji ze zmiennych środowiskowych.
 *
 * Brak wymaganej zmiennej ma się ujawnić natychmiast i z czytelnym komunikatem,
 * a nie jako `undefined` przekazany dalej i błąd sieciowy trzy warstwy niżej.
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    throw new Error(
      `Brak wymaganej zmiennej środowiskowej ${name}. ` +
        `Skopiuj .env.example do .env.local i uzupełnij wartości.`,
    );
  }
  return value;
}

export function supabaseUrl(): string {
  return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function supabaseAnonKey(): string {
  return required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * Klucz serwisowy omija RLS. Wolno go używać wyłącznie po stronie serwera
 * i tylko tam, gdzie jest to naprawdę konieczne.
 */
export function supabaseServiceRoleKey(): string {
  if (typeof window !== "undefined") {
    throw new Error("Klucz serwisowy nie może być używany po stronie przeglądarki");
  }
  return required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}
