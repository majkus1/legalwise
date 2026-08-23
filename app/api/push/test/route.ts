import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { isPushConfigured, sendPush } from "@/lib/push";
import { siteUrl } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Powiadomienie testowe na urządzenia bieżącego użytkownika.
 *
 * Pozwala sprawdzić, czy zgoda w przeglądarce faktycznie działa, zanim
 * ktoś zacznie polegać na przypomnieniach o terminach procesowych.
 */
export async function POST() {
  const context = await getOrgContext();
  if (!context) {
    return NextResponse.json({ error: "Brak dostępu" }, { status: 401 });
  }

  if (!isPushConfigured()) {
    return NextResponse.json(
      { error: "Powiadomienia push nie są skonfigurowane (brak kluczy VAPID)" },
      { status: 503 },
    );
  }

  const supabase = await createServerSupabase();
  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", context.userId);

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json(
      { error: "To urządzenie nie ma jeszcze włączonych powiadomień" },
      { status: 404 },
    );
  }

  let sent = 0;
  let removed = 0;

  for (const subscription of subscriptions) {
    const result = await sendPush(subscription, {
      title: "Legal-Wise — powiadomienie testowe",
      body: "Powiadomienia działają. Tak będą wyglądać przypomnienia o terminach.",
      url: `${siteUrl()}/`,
      tag: "test",
    });

    if (result.status === "sent") sent += 1;
    if (result.status === "expired") {
      await supabase.from("push_subscriptions").delete().eq("id", subscription.id);
      removed += 1;
    }
  }

  if (sent === 0) {
    return NextResponse.json(
      { error: "Nie udało się dostarczyć powiadomienia", removed },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, sent, removed });
}
