import { cache } from "react";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { canManageOrganization, canSeeFinances, type OrgRole } from "@/lib/domain";

/**
 * Kontekst uprawnień bieżącego użytkownika.
 *
 * Każda strona i akcja serwerowa zaczyna od jego pobrania. Zapytania i tak
 * przechodzą przez RLS, ale kontekst pozwala od razu ukryć to, czego użytkownik
 * i tak nie zobaczy, zamiast pokazywać mu puste tabele.
 */
export interface OrgContext {
  userId: string;
  email: string;
  displayName: string;
  organizationId: string;
  organizationName: string;
  role: OrgRole;
  canSeeFinances: boolean;
  canManageOrganization: boolean;
}

/**
 * Zalogowany użytkownik, zweryfikowany u dostawcy tożsamości.
 *
 * Świadomie getUser(), a nie getSession(): getSession() czyta wyłącznie
 * ciasteczko, które może być spreparowane, i nie nadaje się do decyzji
 * o dostępie.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getOrgContext = cache(async (): Promise<OrgContext | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createServerSupabase();

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, role, organizations(id, name)")
    .eq("user_id", user.id)
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership?.organizations) return null;

  const { data: profile } = await supabase
    .from("user_directory_profiles")
    .select("display_name, email")
    .eq("user_id", user.id)
    .maybeSingle();

  const role = membership.role as OrgRole;

  return {
    userId: user.id,
    email: profile?.email ?? user.email ?? "",
    displayName: profile?.display_name ?? profile?.email ?? user.email ?? "Użytkownik",
    organizationId: membership.organization_id,
    organizationName: membership.organizations.name,
    role,
    canSeeFinances: canSeeFinances(role),
    canManageOrganization: canManageOrganization(role),
  };
});

/**
 * Kontekst wymagany do wyświetlenia strony aplikacji.
 *
 * Brak zalogowania kieruje do logowania; zalogowanie bez przyznanego dostępu
 * kieruje na ekran oczekiwania — użytkownik, którego właściciel jeszcze nie
 * dodał do kancelarii, nie widzi żadnych danych.
 */
export async function requireOrgContext(): Promise<OrgContext> {
  const user = await getCurrentUser();
  if (!user) redirect("/logowanie");

  const context = await getOrgContext();
  if (!context) redirect("/oczekiwanie");

  return context;
}

/** Kontekst wymagany do stron finansowych: faktur, rozliczeń i rentowności. */
export async function requireFinanceContext(): Promise<OrgContext> {
  const context = await requireOrgContext();
  if (!context.canSeeFinances) redirect("/brak-uprawnien");
  return context;
}

/** Kontekst wymagany do zarządzania kancelarią i zespołem. */
export async function requireOwnerContext(): Promise<OrgContext> {
  const context = await requireOrgContext();
  if (!context.canManageOrganization) redirect("/brak-uprawnien");
  return context;
}
