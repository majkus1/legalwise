import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { dispatchNotification } from "@/lib/notifications/dispatch";
import {
  buildDigest,
  digestEventKey,
  renderDigestText,
  type DigestInput,
} from "@/lib/notifications/digest";
import { siteUrl } from "@/lib/env";
import { todayInWarsaw } from "@/lib/time";
import type { OrgRole } from "@/lib/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Poranny przegląd — jedna wiadomość na początek dnia.
 *
 * Uruchamiany przez cron (vercel.json), w dni robocze.
 *
 * AUTORYZACJA JEST FAIL-CLOSED: brak CRON_SECRET w środowisku oznacza odmowę,
 * a nie otwarty endpoint. Zapomniana zmienna środowiskowa nie może zamienić
 * tego wywołania w publicznie dostępne.
 */
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

/**
 * Sprawy dostępne dla użytkownika.
 *
 * Cron działa z kluczem serwisowym, który omija RLS, więc zakres dostępu
 * trzeba tu odtworzyć ręcznie — dokładnie tak, jak robi to funkcja
 * can_access_case w bazie. Pominięcie tego wysłałoby prawnikowi terminy
 * ze spraw, których nie prowadzi.
 */
async function accessibleCaseIds(
  admin: ReturnType<typeof createAdminSupabase>,
  organizationId: string,
  userId: string,
  role: OrgRole,
): Promise<string[] | "wszystkie"> {
  if (role === "owner" || role === "partner" || role === "staff") return "wszystkie";

  const [{ data: led }, { data: assigned }] = await Promise.all([
    admin.from("cases").select("id").eq("organization_id", organizationId).eq("lead_lawyer_id", userId),
    admin.from("case_assignees").select("case_id").eq("organization_id", organizationId).eq("user_id", userId),
  ]);

  return [
    ...new Set([
      ...(led ?? []).map((row) => row.id),
      ...(assigned ?? []).map((row) => row.case_id),
    ]),
  ];
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
  }

  const admin = createAdminSupabase();
  const today = todayInWarsaw();
  const dayStart = `${today}T00:00:00Z`;
  const dayEnd = `${today}T23:59:59Z`;

  const summary = { organizations: 0, recipients: 0, sent: 0, empty: 0 };

  const { data: organizations } = await admin.from("organizations").select("id, name");

  for (const organization of organizations ?? []) {
    summary.organizations += 1;

    const { data: members } = await admin
      .from("organization_members")
      .select("user_id, role")
      .eq("organization_id", organization.id)
      .eq("active", true);

    for (const member of members ?? []) {
      const role = member.role as OrgRole;

      const [{ data: profile }, { data: preferences }] = await Promise.all([
        admin
          .from("user_directory_profiles")
          .select("email, display_name")
          .eq("user_id", member.user_id)
          .maybeSingle(),
        admin
          .from("notification_preferences")
          .select("*")
          .eq("organization_id", organization.id)
          .eq("user_id", member.user_id)
          .maybeSingle(),
      ]);

      if (preferences && !preferences.digest_enabled) continue;
      summary.recipients += 1;

      const scope = await accessibleCaseIds(admin, organization.id, member.user_id, role);
      // Prawnik bez żadnej przypisanej sprawy nie ma o czym dostać przeglądu.
      if (scope !== "wszystkie" && scope.length === 0) {
        summary.empty += 1;
        continue;
      }

      let deficiencyQuery = admin
        .from("tasks")
        .select("id, title, due_date, cases(case_number)")
        .eq("organization_id", organization.id)
        .eq("task_kind", "brak_formalny")
        .not("status", "in", "(zrobione,anulowane)")
        .not("due_date", "is", null);

      let eventQuery = admin
        .from("calendar_events")
        .select("id, title, starts_at, location, cases(signature)")
        .eq("organization_id", organization.id)
        .gte("starts_at", dayStart)
        .lte("starts_at", dayEnd);

      // Prawnik dostaje wyłącznie sprawy, które prowadzi lub do których jest
      // przypisany — ta sama reguła co can_access_case w bazie.
      if (scope !== "wszystkie") {
        deficiencyQuery = deficiencyQuery.in("case_id", scope);
        eventQuery = eventQuery.in("case_id", scope);
      }

      const [deficiencies, events, tasksDue, tasksOverdue, billing] = await Promise.all([
        deficiencyQuery,
        eventQuery,
        admin
          .from("tasks")
          .select("id, title, due_date, cases(case_number)")
          .eq("organization_id", organization.id)
          .eq("assignee_id", member.user_id)
          .eq("due_date", today)
          .not("status", "in", "(zrobione,anulowane)"),
        admin
          .from("tasks")
          .select("id, title, due_date, cases(case_number)")
          .eq("organization_id", organization.id)
          .eq("assignee_id", member.user_id)
          .lt("due_date", today)
          .not("status", "in", "(zrobione,anulowane)"),
        role === "owner" || role === "partner"
          ? Promise.all([
              admin
                .from("time_entries")
                .select("minutes")
                .eq("organization_id", organization.id)
                .is("invoice_id", null)
                .eq("billable", true),
              admin
                .from("invoices")
                .select("total_gross_grosz")
                .eq("organization_id", organization.id)
                .in("status", ["approved", "sent"])
                .lt("due_date", today),
            ])
          : Promise.resolve(null),
      ]);

      const digestInput: DigestInput = {
        displayName: profile?.display_name ?? profile?.email ?? "",
        role,
        today,
        preferences: {
          digestEnabled: preferences?.digest_enabled ?? true,
          includeDeadlines: preferences?.include_deadlines ?? true,
          includeDeficiencies: preferences?.include_deficiencies ?? true,
          includeTasks: preferences?.include_tasks ?? true,
          includeBilling: preferences?.include_billing ?? true,
        },
        deficiencies: (deficiencies.data ?? []).map((task) => ({
          id: task.id,
          title: task.title,
          caseNumber: task.cases?.case_number ?? null,
          // Zapytanie odfiltrowuje puste terminy, więc wartość jest tu pewna.
          dueDate: task.due_date!,
        })),
        eventsToday: (events.data ?? []).map((event) => ({
          id: event.id,
          title: event.title,
          startsAt: event.starts_at,
          location: event.location,
          caseSignature: event.cases?.signature ?? null,
        })),
        tasksDue: (tasksDue.data ?? []).map((task) => ({
          id: task.id,
          title: task.title,
          caseNumber: task.cases?.case_number ?? null,
          dueDate: task.due_date,
        })),
        tasksOverdue: (tasksOverdue.data ?? []).map((task) => ({
          id: task.id,
          title: task.title,
          caseNumber: task.cases?.case_number ?? null,
          dueDate: task.due_date,
        })),
        billing: billing
          ? {
              unbilledMinutes: (billing[0].data ?? []).reduce((sum, row) => sum + row.minutes, 0),
              overdueInvoices: (billing[1].data ?? []).length,
              overdueGrossGrosz: (billing[1].data ?? []).reduce(
                (sum, row) => sum + row.total_gross_grosz,
                0,
              ),
            }
          : null,
      };

      const digest = buildDigest(digestInput);

      // Pustego przeglądu nie wysyłamy. Codzienna wiadomość „nic się nie
      // wydarzyło" uczy odbiorcę, że tych maili można nie czytać.
      if (digest.isEmpty) {
        summary.empty += 1;
        continue;
      }

      const eventKey = digestEventKey(today);
      const body = digest.sections
        .map((section) => `${section.heading}: ${section.lines.length}`)
        .join(" · ");

      // Wszystkie kanały idą przez dispatchNotification, żeby objęła je ta
      // sama księga wysyłek. Wysyłka poczty z pominięciem księgi sprawiłaby,
      // że ponowne uruchomienie crona dublowałoby maile — mimo poprawnej
      // deduplikacji powiadomień w skrzynce.
      const outcome = await dispatchNotification(admin, {
        organizationId: organization.id,
        userId: member.user_id,
        kind: "poranny_przeglad",
        title: digest.subject,
        body,
        url: "/",
        eventKey,
        important: digest.sections.some((section) => section.urgent),
        email: profile?.email ?? null,
        // W skrzynce i w powiadomieniu push zostaje podsumowanie;
        // pełne zestawienie trafia do wiadomości e-mail.
        emailText: renderDigestText(digest, siteUrl()),
      });

      if (outcome.email) summary.sent += 1;
    }
  }

  return NextResponse.json({ ok: true, date: today, ...summary });
}
