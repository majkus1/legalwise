import type { Metadata } from "next";
import { requireOwnerContext } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import type { OrgRole } from "@/lib/domain";
import { PageHeader } from "@/components/page-parts";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrganizationForm } from "./organization-form";
import { TeamPanel, type TeamMember } from "./team-panel";

export const metadata: Metadata = { title: "Ustawienia" };

export default async function SettingsPage() {
  const context = await requireOwnerContext();
  const supabase = await createServerSupabase();

  const [{ data: organization }, { data: directory }, { data: rates }] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", context.organizationId).single(),
    supabase.rpc("organization_member_directory", { p_org: context.organizationId }),
    supabase.from("member_rates").select("user_id, default_hourly_rate_grosz"),
  ]);

  const rateByUser = new Map(
    (rates ?? []).map((row) => [row.user_id, row.default_hourly_rate_grosz]),
  );

  const members: TeamMember[] = (directory ?? []).map((row) => ({
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name ?? row.email,
    role: row.role as OrgRole,
    active: row.active,
    rateGrosz: rateByUser.get(row.user_id) ?? null,
  }));

  return (
    <>
      <PageHeader
        title="Ustawienia"
        description="Dane kancelarii, zespół i uprawnienia."
      />

      <Tabs defaultValue="zespol">
        <TabsList>
          <TabsTrigger value="zespol">Zespół ({members.length})</TabsTrigger>
          <TabsTrigger value="kancelaria">Kancelaria</TabsTrigger>
        </TabsList>

        <TabsContent value="zespol" className="mt-6">
          <TeamPanel members={members} />
        </TabsContent>

        <TabsContent value="kancelaria" className="mt-6">
          <Card className="max-w-3xl">
            <CardContent className="pt-6">
              <OrganizationForm
                initial={{
                  name: organization?.name ?? "",
                  legalName: organization?.legal_name ?? "",
                  taxId: organization?.tax_id ?? "",
                  addressLine1: organization?.address_line1 ?? "",
                  postalCode: organization?.postal_code ?? "",
                  city: organization?.city ?? "",
                  bankAccount: organization?.bank_account ?? "",
                  email: organization?.email ?? "",
                  phone: organization?.phone ?? "",
                  invoiceNumberPattern: organization?.invoice_number_pattern ?? "FV/{nr}/{rok}",
                  defaultVatRate: String(organization?.default_vat_rate ?? 23),
                  defaultPaymentDays: String(organization?.default_payment_days ?? 14),
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
