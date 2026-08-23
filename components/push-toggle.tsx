"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Zamienia klucz VAPID z postaci base64url na bufor bajtów.
 *
 * Zwracamy ArrayBuffer, a nie Uint8Array: applicationServerKey wymaga bufora
 * opartego o ArrayBuffer, a domyślny typ Uint8Array dopuszcza także
 * SharedArrayBuffer i nie przechodzi kontroli typów.
 */
function urlBase64ToBuffer(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);

  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let index = 0; index < raw.length; index += 1) {
    view[index] = raw.charCodeAt(index);
  }
  return buffer;
}

type State = "nieznany" | "wylaczone" | "wlaczone" | "zablokowane" | "niedostepne";

/**
 * Włączanie powiadomień push na bieżącym urządzeniu.
 *
 * Zgoda jest przypisana do urządzenia i przeglądarki, nie do konta — dlatego
 * przełącznik pokazuje stan tego urządzenia, a nie ustawienie z bazy.
 */
export function PushToggle({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [state, setState] = useState<State>("nieznany");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;

    // Cała detekcja jest asynchroniczna, a stan ustawiamy wyłącznie
    // w wywołaniu zwrotnym — dzięki temu render pozostaje wolny od skutków
    // ubocznych, a odmontowanie komponentu w trakcie sprawdzania nie kończy
    // się zapisem do nieistniejącego już komponentu.
    async function detect(): Promise<State> {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !vapidPublicKey) {
        return "niedostepne";
      }
      if (Notification.permission === "denied") return "zablokowane";

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      return subscription ? "wlaczone" : "wylaczone";
    }

    detect()
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch(() => {
        if (!cancelled) setState("niedostepne");
      });

    return () => {
      cancelled = true;
    };
  }, [vapidPublicKey]);

  async function enable() {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setState(permission === "denied" ? "zablokowane" : "wylaczone");
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToBuffer(vapidPublicKey),
    });

    const json = subscription.toJSON();
    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
        userAgent: navigator.userAgent.slice(0, 500),
      }),
    });

    if (!response.ok) {
      toast.error("Nie udało się włączyć powiadomień");
      return;
    }

    setState("wlaczone");
    toast.success("Powiadomienia włączone na tym urządzeniu");
  }

  async function disable() {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      await subscription.unsubscribe();
    }

    setState("wylaczone");
    toast.success("Powiadomienia wyłączone na tym urządzeniu");
  }

  if (state === "niedostepne") {
    return (
      <p className="text-sm text-muted-foreground">
        Ta przeglądarka nie obsługuje powiadomień push.
      </p>
    );
  }

  if (state === "zablokowane") {
    return (
      <p className="text-sm text-muted-foreground">
        Powiadomienia zostały zablokowane w ustawieniach przeglądarki. Aby je włączyć, zmień
        uprawnienia dla tej strony w ustawieniach witryny.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant={state === "wlaczone" ? "outline" : "default"}
        disabled={pending || state === "nieznany"}
        className="gap-2"
        onClick={() =>
          startTransition(async () => {
            try {
              if (state === "wlaczone") await disable();
              else await enable();
            } catch {
              toast.error("Operacja nie powiodła się");
            }
          })
        }
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : state === "wlaczone" ? (
          <BellOff className="size-4" />
        ) : (
          <Bell className="size-4" />
        )}
        {state === "wlaczone" ? "Wyłącz na tym urządzeniu" : "Włącz na tym urządzeniu"}
      </Button>

      {state === "wlaczone" && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const response = await fetch("/api/push/test", { method: "POST" });
              const result = await response.json().catch(() => ({}));
              if (response.ok) toast.success("Wysłano powiadomienie testowe");
              else toast.error(result.error ?? "Nie udało się wysłać");
            })
          }
        >
          Wyślij testowe
        </Button>
      )}
    </div>
  );
}
