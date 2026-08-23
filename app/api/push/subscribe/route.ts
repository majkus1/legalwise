import { NextResponse } from "next/server";
import { z } from "zod";
import { getOrgContext } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  userAgent: z.string().max(500).optional(),
});

/**
 * Zapisuje subskrypcję Web Push dla bieżącego urządzenia.
 *
 * Zapytanie idzie klientem z sesją użytkownika, więc obowiązuje RLS —
 * nie da się zapisać subskrypcji na cudze konto.
 */
export async function POST(request: Request) {
  const context = await getOrgContext();
  if (!context) {
    return NextResponse.json({ error: "Brak dostępu" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowy JSON" }, { status: 400 });
  }

  const parsed = subscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Niekompletne dane subskrypcji" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      organization_id: context.organizationId,
      user_id: context.userId,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.p256dh,
      auth: parsed.data.auth,
      user_agent: parsed.data.userAgent ?? null,
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    return NextResponse.json({ error: "Nie udało się zapisać subskrypcji" }, { status: 500 });
  }

  // Zgoda na powiadomienia to decyzja osoby przy urządzeniu — włączamy
  // preferencję bez pośrednictwa właściciela kancelarii.
  const { error: preferenceError } = await supabase.rpc("set_own_push_enabled", {
    p_org: context.organizationId,
    p_enabled: true,
  });

  if (preferenceError) {
    return NextResponse.json({ error: "Nie udało się włączyć powiadomień" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
