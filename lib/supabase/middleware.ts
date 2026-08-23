import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";

/** Ścieżki dostępne bez zalogowania. */
const PUBLIC_PATHS = [
  "/logowanie",
  "/rejestracja",
  "/przypomnienie-hasla",
  "/auth/reset",
  "/auth/callback",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * Odświeża sesję przy każdym żądaniu i odcina niezalogowanych od stron aplikacji.
 *
 * To jest wyłącznie pierwsza bariera i wygodne przekierowanie. Właściwym
 * zabezpieczeniem jest RLS w bazie — przekierowanie w middleware chroni przed
 * pomyłką, nie przed atakiem.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser() weryfikuje token u dostawcy. getSession() czyta wyłącznie
  // ciasteczko, które może być podrobione — nie wolno go używać do decyzji
  // o dostępie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/logowanie";
    // Po zalogowaniu wracamy tam, gdzie użytkownik chciał wejść.
    url.searchParams.set("powrot", pathname);
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/logowanie" || pathname === "/rejestracja")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
