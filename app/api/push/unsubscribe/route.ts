import { NextResponse } from "next/server";
import { z } from "zod";
import { getOrgContext } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const context = await getOrgContext();
  if (!context) {
    return NextResponse.json({ error: "Brak dostępu" }, { status: 401 });
  }

  let endpoint: string | undefined;
  try {
    const body = await request.json();
    endpoint = z.string().url().parse(body?.endpoint);
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe dane" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);

  // Wyłączamy preferencję dopiero, gdy nie zostało żadne urządzenie —
  // rezygnacja na telefonie nie powinna wyciszać powiadomień na komputerze.
  const { count } = await supabase
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", context.userId);

  if ((count ?? 0) === 0) {
    await supabase.rpc("set_own_push_enabled", {
      p_org: context.organizationId,
      p_enabled: false,
    });
  }

  return NextResponse.json({ ok: true });
}
