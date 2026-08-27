import { requireOrgContext } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/auth";
import { listCaseOptions } from "@/lib/queries";
import { createServerSupabase } from "@/lib/supabase/server";
import { todayInWarsaw } from "@/lib/time";
import { AppShell } from "@/components/app-shell";
import { QuickTimeEntry } from "@/components/time/quick-time-entry";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const context = await requireOrgContext();

  // Sekretariat nie prowadzi ewidencji czasu (polityka RLS na time_entries),
  // więc nie pokazujemy mu przycisku, który i tak zakończyłby się odmową.
  const canLogTime = context.role !== "staff";
  const cases = canLogTime ? await listCaseOptions() : [];

  // Licznik nieprzeczytanych powiadomień w nagłówku. RLS ogranicza wynik
  // do powiadomień zalogowanej osoby.
  const supabase = await createServerSupabase();
  const { count: unreadCount } = await supabase
    .from("user_notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);

  return (
    <AppShell
      displayName={context.displayName}
      role={context.role}
      canManage={context.canManageOrganization}
      logoutAction={logoutAction}
      unreadCount={unreadCount ?? 0}
      quickAction={
        canLogTime ? <QuickTimeEntry cases={cases} today={todayInWarsaw()} /> : null
      }
    >
      {children}
    </AppShell>
  );
}
