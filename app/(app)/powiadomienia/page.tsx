import Link from "next/link";
import type { Metadata } from "next";
import { Bell, BellRing } from "lucide-react";
import { requireOrgContext } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { markAllNotificationsReadAction } from "@/lib/actions/notifications";
import { formatDateTime } from "@/lib/time";
import { EmptyState, PageHeader } from "@/components/page-parts";
import { SubmitButton } from "@/components/form-parts";
import { PushToggle } from "@/components/push-toggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PreferencesForm } from "./preferences-form";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Powiadomienia" };

export default async function NotificationsPage() {
  const context = await requireOrgContext();
  const supabase = await createServerSupabase();

  const [{ data: notifications }, { data: preferences }] = await Promise.all([
    supabase
      .from("user_notifications")
      .select("id, kind, title, body, url, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("notification_preferences")
      .select("*")
      .eq("organization_id", context.organizationId)
      .eq("user_id", context.userId)
      .maybeSingle(),
  ]);

  const rows = notifications ?? [];
  const unread = rows.filter((row) => row.read_at === null);

  return (
    <>
      <PageHeader
        title="Powiadomienia"
        description={
          unread.length > 0
            ? `${unread.length} ${unread.length === 1 ? "nieprzeczytane" : "nieprzeczytanych"}`
            : "Wszystko przeczytane"
        }
        actions={
          unread.length > 0 ? (
            <form action={markAllNotificationsReadAction}>
              <SubmitButton variant="outline" size="sm">
                Oznacz wszystkie jako przeczytane
              </SubmitButton>
            </form>
          ) : null
        }
      />

      <Tabs defaultValue="skrzynka">
        <TabsList>
          <TabsTrigger value="skrzynka">Skrzynka ({rows.length})</TabsTrigger>
          <TabsTrigger value="ustawienia">Ustawienia</TabsTrigger>
        </TabsList>

        <TabsContent value="skrzynka" className="mt-6">
          {rows.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="Brak powiadomień"
              description="Pojawią się tu przypomnienia o terminach, brakach formalnych i przypisanych zadaniach."
            />
          ) : (
            <Card>
              <CardContent className="px-5 py-2">
                <ul className="divide-y">
                  {rows.map((notification) => (
                    <li key={notification.id} className="py-3">
                      <Link
                        href={notification.url ?? "/"}
                        className="flex items-start gap-3 rounded-md transition-colors hover:bg-accent/40"
                      >
                        <BellRing
                          className={cn(
                            "mt-0.5 size-4 shrink-0",
                            notification.read_at === null
                              ? "text-[var(--brand-gold-text)]"
                              : "text-muted-foreground",
                          )}
                          aria-hidden="true"
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              "text-sm",
                              notification.read_at === null ? "font-medium" : "",
                            )}
                          >
                            {notification.title}
                          </p>
                          {notification.body && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {notification.body}
                            </p>
                          )}
                        </div>
                        <span className="tabular shrink-0 text-xs text-muted-foreground">
                          {formatDateTime(notification.created_at)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="ustawienia" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <Card>
              <CardContent className="pt-6">
                <PreferencesForm
                  canSeeFinances={context.canSeeFinances}
                  initial={{
                    digestEnabled: preferences?.digest_enabled ?? true,
                    includeDeadlines: preferences?.include_deadlines ?? true,
                    includeDeficiencies: preferences?.include_deficiencies ?? true,
                    includeTasks: preferences?.include_tasks ?? true,
                    includeBilling: preferences?.include_billing ?? true,
                    notifyTaskAssigned: preferences?.notify_task_assigned ?? true,
                    notifyCaseAssigned: preferences?.notify_case_assigned ?? true,
                    notifyDeadlines: preferences?.notify_deadlines ?? true,
                    emailEnabled: preferences?.email_enabled ?? true,
                  }}
                />
              </CardContent>
            </Card>

            <Card className="h-fit">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Powiadomienia na urządzeniu</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Zgoda dotyczy tego urządzenia i tej przeglądarki. Na telefonie trzeba ją
                  wyrazić osobno — najlepiej po zainstalowaniu aplikacji.
                </p>
                <PushToggle vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
