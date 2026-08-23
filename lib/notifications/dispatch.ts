import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getMailer, isMailerConfigured } from "@/lib/mailer";
import { isPushConfigured, sendPush } from "@/lib/push";
import { siteUrl } from "@/lib/env";
import { dispatchKey } from "@/lib/notifications/digest";

type Admin = SupabaseClient<Database>;

/**
 * Limit tempa wysyłki.
 *
 * Zabezpieczenie przed lawiną: gdyby cron albo pętla w kodzie zaczęły
 * generować wiadomości bez końca, kancelaria dostanie ich najwyżej tyle,
 * zanim wysyłka się zatrzyma.
 */
const MAX_DISPATCHES_PER_MINUTE = 60;

export type Channel = "inbox" | "push" | "email";

export interface NotificationInput {
  organizationId: string;
  userId: string;
  kind: Database["public"]["Enums"]["notification_kind"];
  title: string;
  body: string;
  /** Ścieżka w aplikacji, do której prowadzi powiadomienie. */
  url: string;
  /** Klucz zdarzenia — ta sama wartość nie utworzy drugiego powiadomienia. */
  eventKey: string;
  /** Powiadomienie, które nie może zniknąć samo z ekranu. */
  important?: boolean;
  /** Adres e-mail odbiorcy; brak oznacza pominięcie kanału pocztowego. */
  email?: string | null;
  /**
   * Treść wiadomości e-mail, gdy ma być obszerniejsza niż powiadomienie
   * w skrzynce. Poranny przegląd wysyła tu pełne zestawienie, a w skrzynce
   * i w powiadomieniu push zostawia samo podsumowanie.
   */
  emailText?: string;
}

export interface DispatchOutcome {
  inbox: boolean;
  push: number;
  email: boolean;
  skipped: boolean;
}

/**
 * Rejestruje wysyłkę w księdze.
 *
 * Zwraca false, gdy klucz już istnieje — czyli dokładnie ta wiadomość
 * w tym kanale została już wysłana. Unikalność klucza w bazie jest tu
 * mechanizmem deduplikacji, a nie tylko zapisem historycznym.
 */
async function claimDispatch(
  admin: Admin,
  organizationId: string,
  userId: string,
  channel: Channel,
  eventKey: string,
): Promise<boolean> {
  const { error } = await admin.from("notification_dispatch_events").insert({
    organization_id: organizationId,
    user_id: userId,
    channel,
    dedupe_key: dispatchKey(channel, userId, eventKey),
    status: "sent",
  });

  // Kod 23505 to naruszenie unikalności — wiadomość już poszła.
  return !error;
}

async function isRateLimited(admin: Admin): Promise<boolean> {
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await admin
    .from("notification_dispatch_events")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);

  return (count ?? 0) >= MAX_DISPATCHES_PER_MINUTE;
}

async function recordFailure(
  admin: Admin,
  organizationId: string,
  userId: string,
  channel: Channel,
  eventKey: string,
  message: string,
): Promise<void> {
  await admin
    .from("notification_dispatch_events")
    .update({ status: "failed", error: message.slice(0, 500) })
    .eq("dedupe_key", dispatchKey(channel, userId, eventKey));
}

/**
 * Dostarcza powiadomienie wszystkimi kanałami, na które odbiorca się zgodził.
 *
 * Skrzynka w aplikacji jest zawsze; push i e-mail zależą od preferencji
 * i od tego, czy dany kanał jest w ogóle skonfigurowany.
 */
export async function dispatchNotification(
  admin: Admin,
  input: NotificationInput,
): Promise<DispatchOutcome> {
  const outcome: DispatchOutcome = { inbox: false, push: 0, email: false, skipped: false };

  if (await isRateLimited(admin)) {
    outcome.skipped = true;
    return outcome;
  }

  const { data: preferences } = await admin
    .from("notification_preferences")
    .select("push_enabled, email_enabled")
    .eq("organization_id", input.organizationId)
    .eq("user_id", input.userId)
    .maybeSingle();

  // Brak zapisanych preferencji oznacza ustawienia domyślne: skrzynka i poczta
  // włączone, push wyłączony do czasu wyrażenia zgody w przeglądarce.
  const emailEnabled = preferences?.email_enabled ?? true;
  const pushEnabled = preferences?.push_enabled ?? false;

  // --- Skrzynka w aplikacji -------------------------------------------------
  if (await claimDispatch(admin, input.organizationId, input.userId, "inbox", input.eventKey)) {
    const { error } = await admin.from("user_notifications").insert({
      organization_id: input.organizationId,
      user_id: input.userId,
      kind: input.kind,
      title: input.title,
      body: input.body,
      url: input.url,
      event_key: input.eventKey,
    });

    if (error) {
      await recordFailure(
        admin,
        input.organizationId,
        input.userId,
        "inbox",
        input.eventKey,
        error.message,
      );
    } else {
      outcome.inbox = true;
    }
  }

  // --- Web Push -------------------------------------------------------------
  if (
    pushEnabled &&
    isPushConfigured() &&
    (await claimDispatch(admin, input.organizationId, input.userId, "push", input.eventKey))
  ) {
    const { data: subscriptions } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", input.userId);

    for (const subscription of subscriptions ?? []) {
      const result = await sendPush(subscription, {
        title: input.title,
        body: input.body,
        url: `${siteUrl()}${input.url}`,
        tag: input.eventKey,
        important: input.important,
      });

      if (result.status === "sent") {
        outcome.push += 1;
        await admin
          .from("push_subscriptions")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", subscription.id);
      } else if (result.status === "expired") {
        // Martwa subskrypcja: odinstalowana aplikacja albo wyczyszczone dane
        // przeglądarki. Zostawiona w bazie generowałaby błąd przy każdej próbie.
        await admin.from("push_subscriptions").delete().eq("id", subscription.id);
      }
    }
  }

  // --- Poczta ---------------------------------------------------------------
  if (
    emailEnabled &&
    input.email &&
    isMailerConfigured() &&
    (await claimDispatch(admin, input.organizationId, input.userId, "email", input.eventKey))
  ) {
    try {
      await getMailer().send({
        to: input.email,
        subject: input.title,
        text:
          input.emailText ??
          `${input.body}\n\nSzczegóły: ${siteUrl()}${input.url}\n\nWiadomość wygenerowana automatycznie przez system kancelarii.`,
      });
      outcome.email = true;
    } catch (error) {
      await recordFailure(
        admin,
        input.organizationId,
        input.userId,
        "email",
        input.eventKey,
        error instanceof Error ? error.message : "Nieznany błąd",
      );
    }
  }

  return outcome;
}
