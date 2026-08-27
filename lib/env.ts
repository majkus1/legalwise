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

/**
 * Adres aplikacji, używany w linkach wysyłanych mailem.
 *
 * Na produkcji jest WYMAGANY. Cicha wartość zastępcza kończyłaby się tym, że
 * kancelaria dostaje w mailu link do `localhost` — martwy u odbiorcy i bez
 * śladu błędu w logach. Lepiej, żeby brak konfiguracji ujawnił się od razu.
 *
 * Lokalnie zostaje wygodna wartość domyślna, zgodna z portem serwera
 * deweloperskiego (`next dev -p 3200`).
 */
export function siteUrl(): string {
  const value = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (value) return value;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Brak NEXT_PUBLIC_SITE_URL. Bez niego linki w mailach (reset hasła, " +
        "powiadomienia) prowadziłyby do localhost. Ustaw adres aplikacji w zmiennych środowiskowych.",
    );
  }

  return "http://localhost:3200";
}
