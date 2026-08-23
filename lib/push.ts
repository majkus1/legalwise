import "server-only";
import webpush from "web-push";

/**
 * Wysyłka powiadomień Web Push.
 *
 * Klucze VAPID identyfikują nadawcę wobec usług push przeglądarek.
 * Bez nich wysyłka jest po prostu wyłączona — nie próbujemy jej udawać.
 */

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
  /** Powiadomienie, które nie może zniknąć samo — terminy procesowe, braki. */
  important?: boolean;
}

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export type PushResult =
  | { status: "sent" }
  | { status: "expired" }
  | { status: "failed"; error: string };

let configured = false;

function ensureConfigured(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;

  if (!configured) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:noreply@legal-wise.test",
      publicKey,
      privateKey,
    );
    configured = true;
  }
  return true;
}

export function isPushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

/**
 * Wysyła powiadomienie do jednego urządzenia.
 *
 * Status `expired` oznacza subskrypcję martwą (odinstalowana aplikacja,
 * wyczyszczone dane przeglądarki) — taką trzeba usunąć z bazy, inaczej
 * księga wysyłek zapełni się błędami przy każdej próbie.
 */
export async function sendPush(target: PushTarget, payload: PushPayload): Promise<PushResult> {
  if (!ensureConfigured()) {
    return { status: "failed", error: "Brak kluczy VAPID" };
  }

  try {
    await webpush.sendNotification(
      {
        endpoint: target.endpoint,
        keys: { p256dh: target.p256dh, auth: target.auth },
      },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 12 },
    );
    return { status: "sent" };
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 404 || statusCode === 410) {
      return { status: "expired" };
    }
    return {
      status: "failed",
      error: error instanceof Error ? error.message : "Nieznany błąd wysyłki push",
    };
  }
}
