import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Odbiera powrót z linku wysłanego e-mailem (potwierdzenie adresu, reset hasła)
 * i wymienia jednorazowy kod na sesję.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  // Cel przekierowania musi być ścieżką w tej aplikacji. Bez tej kontroli
  // parametr `next` byłby otwartym przekierowaniem, które da się wykorzystać
  // do uwiarygodnienia linku phishingowego.
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/logowanie?blad=brak-kodu`);
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/logowanie?blad=link-wygasl`);
  }

  return NextResponse.redirect(`${origin}${target}`);
}
