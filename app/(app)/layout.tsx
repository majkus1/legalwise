import { requireOrgContext } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/auth";
import { listCaseOptions } from "@/lib/queries";
import { todayInWarsaw } from "@/lib/time";
import { AppShell } from "@/components/app-shell";
import { QuickTimeEntry } from "@/components/time/quick-time-entry";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const context = await requireOrgContext();

  // Sekretariat nie prowadzi ewidencji czasu (polityka RLS na time_entries),
  // więc nie pokazujemy mu przycisku, który i tak zakończyłby się odmową.
  const canLogTime = context.role !== "staff";
  const cases = canLogTime ? await listCaseOptions() : [];

  return (
    <AppShell
      displayName={context.displayName}
      organizationName={context.organizationName}
      role={context.role}
      canManage={context.canManageOrganization}
      logoutAction={logoutAction}
      quickAction={
        canLogTime ? <QuickTimeEntry cases={cases} today={todayInWarsaw()} /> : null
      }
    >
      {children}
    </AppShell>
  );
}
