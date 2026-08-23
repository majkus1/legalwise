"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Rejestruje service workera i proponuje instalację aplikacji.
 *
 * Propozycja pojawia się dyskretnie i tylko raz — odrzucona, nie wraca
 * w tej sesji. Pasek zachęty wyskakujący przy każdym wejściu jest
 * w narzędziu do codziennej pracy zwyczajnie irytujący.
 */
export function PwaProvider() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Rejestrujemy po załadowaniu strony, żeby nie konkurować o pasmo
    // z zasobami potrzebnymi do pierwszego wyświetlenia.
    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Brak service workera nie może uniemożliwić korzystania z aplikacji.
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  useEffect(() => {
    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  if (!installEvent || dismissed) return null;

  return (
    <div className="fixed right-4 bottom-4 z-50 flex max-w-sm items-start gap-3 rounded-lg border bg-card p-4 shadow-lg">
      <Download className="mt-0.5 size-4 shrink-0 text-[var(--brand-gold-text)]" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Zainstaluj aplikację</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Szybszy dostęp z pulpitu i telefonu, bez paska przeglądarki.
        </p>
        <Button
          size="sm"
          className="mt-3"
          onClick={async () => {
            await installEvent.prompt();
            await installEvent.userChoice;
            setInstallEvent(null);
          }}
        >
          Zainstaluj
        </Button>
      </div>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Zamknij propozycję instalacji"
        onClick={() => setDismissed(true)}
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}
