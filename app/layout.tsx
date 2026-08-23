import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { PwaProvider } from "@/components/pwa";
import "./globals.css";

// latin-ext jest wymagany dla polskich znaków diakrytycznych (ą ć ę ł ń ó ś ź ż).
// Bez niego przeglądarka podmienia je na font zastępczy i tekst się "rozjeżdża".
const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  variable: "--font-heading",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Legal-Wise — system kancelarii",
    template: "%s · Legal-Wise",
  },
  description:
    "System zarządzania kancelarią: ewidencja czasu pracy, sprawy, zadania, kalendarz i rozliczenia.",
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  applicationName: "Legal-Wise",
  appleWebApp: {
    capable: true,
    title: "Legal-Wise",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#191E39",
  // Aplikacja w trybie samodzielnym musi sięgać pod wcięcia ekranu (notch).
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pl"
      className={`${geistSans.variable} ${geistMono.variable} ${sourceSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="top-right" richColors />
        <PwaProvider />
      </body>
    </html>
  );
}
