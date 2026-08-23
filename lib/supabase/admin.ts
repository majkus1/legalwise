import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { supabaseServiceRoleKey, supabaseUrl } from "@/lib/env";

/**
 * Klient z kluczem serwisowym — OMIJA RLS.
 *
 * Wolno go używać wyłącznie tam, gdzie nie ma sesji użytkownika, a operacja
 * i tak musi objąć całą kancelarię: cron porannego przeglądu i wysyłka
 * powiadomień. Każde inne miejsce ma korzystać z klienta z sesją, żeby
 * obowiązywały polityki RLS.
 *
 * Nigdy nie importować tego modułu z kodu trafiającego do przeglądarki —
 * pilnuje tego zarówno "server-only", jak i kontrola w lib/env.
 */
export function createAdminSupabase() {
  return createClient<Database>(supabaseUrl(), supabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
