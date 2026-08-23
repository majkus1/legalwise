import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export default async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Pomijamy zasoby statyczne i pliki graficzne — odświeżanie sesji przy
     * każdej ikonie byłoby marnowaniem żądań do Supabase.
     *
     * sw.js i manifest.webmanifest MUSZĄ być tu wyłączone: przepuszczone przez
     * warstwę sesji kończyłyby przekierowaniem na ekran logowania, przez co
     * service worker nigdy by się nie zarejestrował, a aplikacja przestałaby
     * być instalowalna — i to bez żadnego czytelnego komunikatu.
     */
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
