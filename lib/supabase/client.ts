"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

/**
 * Klient przeglądarkowy — używany tylko tam, gdzie interakcja musi zadziałać
 * bez przeładowania strony (logowanie, wylogowanie, podgląd sesji).
 *
 * Odczyt i zapis danych domenowych idzie przez akcje serwerowe, nie tędy.
 */
export function createBrowserSupabase() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
