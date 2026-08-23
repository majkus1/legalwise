"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";
import { UserMinus, UserPlus } from "lucide-react";
import {
  deactivateMemberAction,
  setMemberRateAction,
  setMemberRoleAction,
  type ActionState,
} from "@/lib/actions/settings";
import { FormError, SubmitButton } from "@/components/form-parts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ORG_ROLES,
  ORG_ROLE_DESCRIPTIONS,
  ORG_ROLE_LABELS,
  type OrgRole,
} from "@/lib/domain";

export interface TeamMember {
  userId: string;
  email: string;
  displayName: string;
  role: OrgRole;
  active: boolean;
  rateGrosz: number | null;
}

export function TeamPanel({ members }: { members: TeamMember[] }) {
  const [inviteRole, setInviteRole] = useState<OrgRole>("lawyer");
  const [inviteState, invite] = useActionState<ActionState, FormData>(setMemberRoleAction, {});
  const [rateState, saveRate] = useActionState<ActionState, FormData>(setMemberRateAction, {});

  if (inviteState.message) toast.success(inviteState.message);
  if (rateState.message) toast.success(rateState.message);
  if (rateState.error) toast.error(rateState.error);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="size-4 text-muted-foreground" aria-hidden="true" />
            Nadaj dostęp
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Osoba musi najpierw samodzielnie założyć konto. Następnie wpisujesz tutaj jej adres
            e-mail i nadajesz rolę — dostęp działa od razu, bez ponownego logowania.
          </p>

          <form action={invite} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="role" value={inviteRole} />
            <div className="min-w-56 flex-1 space-y-2">
              <Label htmlFor="email">Adres e-mail</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                placeholder="imie.nazwisko@legal-wise.pl"
              />
            </div>

            <div className="w-48 space-y-2">
              <Label htmlFor="roleSelect">Rola</Label>
              <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as OrgRole)}>
                <SelectTrigger id="roleSelect" aria-label="Rola" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORG_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {ORG_ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <SubmitButton>Nadaj dostęp</SubmitButton>
          </form>

          <FormError className="mt-3">{inviteState.error}</FormError>

          <p className="mt-3 text-xs text-muted-foreground">
            {ORG_ROLE_LABELS[inviteRole]}: {ORG_ROLE_DESCRIPTIONS[inviteRole]}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Zespół kancelarii</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Osoba</TableHead>
                  <TableHead>Rola</TableHead>
                  <TableHead className="w-48">Stawka godzinowa</TableHead>
                  <TableHead className="text-right">Dostęp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.userId}>
                    <TableCell>
                      <p className="font-medium">{member.displayName}</p>
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                    </TableCell>
                    <TableCell>
                      <form action={invite} className="flex items-center gap-2">
                        <input type="hidden" name="email" value={member.email} />
                        <select
                          name="role"
                          defaultValue={member.role}
                          aria-label={`Rola: ${member.displayName}`}
                          className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
                        >
                          {ORG_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {ORG_ROLE_LABELS[role]}
                            </option>
                          ))}
                        </select>
                        <SubmitButton variant="ghost" size="xs">
                          Zapisz
                        </SubmitButton>
                      </form>
                    </TableCell>
                    <TableCell>
                      {member.role === "staff" ? (
                        <span className="text-xs text-muted-foreground">nie dotyczy</span>
                      ) : (
                        <form action={saveRate} className="flex items-center gap-2">
                          <input type="hidden" name="userId" value={member.userId} />
                          <Input
                            name="rate"
                            defaultValue={
                              member.rateGrosz
                                ? (member.rateGrosz / 100).toFixed(2).replace(".", ",")
                                : ""
                            }
                            placeholder="450"
                            aria-label={`Stawka: ${member.displayName}`}
                            className="h-8 w-24"
                            inputMode="decimal"
                          />
                          <SubmitButton variant="ghost" size="xs">
                            Zapisz
                          </SubmitButton>
                        </form>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {member.active ? (
                        <form action={deactivateMemberAction}>
                          <input type="hidden" name="email" value={member.email} />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="xs"
                            className="gap-1.5 text-destructive"
                          >
                            <UserMinus className="size-3.5" aria-hidden="true" />
                            Odbierz
                          </Button>
                        </form>
                      ) : (
                        <span className="text-xs text-muted-foreground">odebrany</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Odebranie dostępu działa natychmiast i dotyczy również danych — nie tylko ukrycia
            pozycji w menu. Konta nie usuwamy, żeby historia wpisów czasu i autorstwo notatek
            pozostały spójne.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
