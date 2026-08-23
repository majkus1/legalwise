import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";

/**
 * Klient Supabase działający w kontekście SESJI ZALOGOWANEGO UŻYTKOWNIKA.
 *
 * To jest domyślna droga do danych w całej aplikacji. Zapytania idą z tożsamością
 * użytkownika, więc obowiązuje RLS — nawet błąd w kodzie strony nie może pokazać
 * danych, do których użytkownik nie ma prawa.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Komponenty serwerowe nie mogą zapisywać ciasteczek. Odświeżenie
          // sesji obsługuje middleware, więc ten przypadek można pominąć.
        }
      },
    },
  });
}
