import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Origin Supabase musi być na liście connect-src, inaczej CSP zablokuje
 * wywołania do bazy, auth i storage.
 */
function supabaseOrigins(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return "";
  try {
    const { origin, host } = new URL(url);
    return `${origin} wss://${host}`;
  } catch {
    return "";
  }
}

const csp = [
  `default-src 'self'`,
  // 'unsafe-eval' jest potrzebny wyłącznie dla hot-reloadu w trybie deweloperskim.
  // Docelowo (Faza 2) CSP oparte na nonce zamiast 'unsafe-inline'.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  `style-src 'self' 'unsafe-inline'`,
  // next/font pobiera fonty w czasie builda i serwuje je z własnej domeny,
  // więc nie ma potrzeby otwierać font-src na Google.
  `font-src 'self' data:`,
  `img-src 'self' data: blob:`,
  `connect-src 'self' ${supabaseOrigins()}`.trim(),
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `object-src 'none'`,
  // Bez worker-src przeglądarka zablokuje rejestrację service workera,
  // a bez manifest-src nie wczyta manifestu — aplikacja przestanie być
  // instalowalna, i to bez czytelnego komunikatu.
  `worker-src 'self'`,
  `manifest-src 'self'`,
]
  .filter(Boolean)
  .join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Wskaźnik narzędzi deweloperskich Next.js domyślnie siada w lewym dolnym
  // rogu, czyli dokładnie na przycisku „Wyloguj się" w panelu bocznym.
  // W wersji produkcyjnej go nie ma, ale podczas pokazu klientowi zasłaniałby
  // element interfejsu. `devIndicators: false` schowałoby go całkiem.
  devIndicators: {
    position: "bottom-right",
  },
  // Bez tego Turbopack szuka katalogu głównego wyżej w drzewie i trafia na
  // package-lock.json w katalogu domowym użytkownika, poza repozytorium.
  turbopack: {
    root: import.meta.dirname,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // Dane objęte tajemnicą zawodową nie mogą trafiać do pamięci podręcznej proxy.
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
