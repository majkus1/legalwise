import { createServerSupabase } from "@/lib/supabase/server";
import { resolveBillingModel } from "@/lib/billing";
import type { BillingModel } from "@/lib/domain";

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
