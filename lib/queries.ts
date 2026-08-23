import { createServerSupabase } from "@/lib/supabase/server";
import { resolveBillingModel } from "@/lib/billing";
import type { BillingModel, OrgRole } from "@/lib/domain";

/** Osoba z zespołu — do list wyboru prowadzącego, wykonawcy zadania itp. */
export interface MemberOption {
  userId: string;
  displayName: string;
  email: string;
  role: OrgRole;
}

/**
 * Aktywni członkowie kancelarii.
 *
 * Korzysta z funkcji organization_member_directory, która łączy członkostwo
 * z bezpiecznym katalogiem e-maili — nigdy nie sięgamy do auth.users.
 */
export async function listMembers(organizationId: string): Promise<MemberOption[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.rpc("organization_member_directory", {
    p_org: organizationId,
  });

  return (data ?? [])
    .filter((row) => row.active)
    .map((row) => ({
      userId: row.user_id,
      displayName: row.display_name ?? row.email,
      email: row.email,
      role: row.role as OrgRole,
    }));
}

/** Prawnicy — osoby, którym można powierzyć prowadzenie sprawy. */
export async function listLawyers(organizationId: string): Promise<MemberOption[]> {
  const members = await listMembers(organizationId);
  return members.filter((member) => member.role !== "staff");
}

/** Klienci do listy wyboru przy zakładaniu sprawy. */
export async function listClientOptions(): Promise<
  { id: string; name: string; billingModel: BillingModel }[]
> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("clients")
    .select("id, name, default_billing_model")
    .is("archived_at", null)
    .order("name");

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    billingModel: row.default_billing_model as BillingModel,
  }));
}

/** Sprawa w postaci nadającej się do listy wyboru przy rejestracji czasu. */
export interface CaseOption {
  id: string;
  caseNumber: string;
  title: string;
  clientName: string;
  /** Model rozliczenia po rozstrzygnięciu łańcucha sprawa → klient. */
  billingModel: BillingModel;
  signature: string | null;
}

/**
 * Sprawy dostępne dla bieżącego użytkownika, gotowe do podpowiedzi w formularzu.
 *
 * RLS ogranicza wynik do spraw, które użytkownik prowadzi lub do których jest
 * przypisany (rola prawnika) albo do wszystkich spraw kancelarii (pozostałe role).
 */
export async function listCaseOptions(): Promise<CaseOption[]> {
  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from("cases")
    .select("id, case_number, title, billing_model, signature, clients(name, default_billing_model)")
    .is("archived_at", null)
    .neq("status", "zakonczona")
    .order("case_number", { ascending: false });

  if (error || !data) return [];

  return data
    .filter((row) => row.clients !== null)
    .map((row) => ({
      id: row.id,
      caseNumber: row.case_number,
      title: row.title,
      clientName: row.clients!.name,
      signature: row.signature,
      billingModel: resolveBillingModel(
        row.billing_model,
        row.clients!.default_billing_model as BillingModel,
      ),
    }));
}
