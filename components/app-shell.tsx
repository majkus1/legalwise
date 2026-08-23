"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  Briefcase,
  Calendar,
  CheckSquare,
  Clock,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  Settings,
  Users,
} from "lucide-react";
import { BrandMark, BrandWordmark } from "@/components/brand";
import { SubmitButton } from "@/components/form-parts";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ORG_ROLE_LABELS, type OrgRole } from "@/lib/domain";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Puste = widoczne dla wszystkich ról. */
  roles?: OrgRole[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Praca bieżąca",
    items: [
      { href: "/", label: "Pulpit", icon: LayoutDashboard },
      { href: "/czas", label: "Ewidencja czasu", icon: Clock, roles: ["owner", "partner", "lawyer"] },
      { href: "/zadania", label: "Zadania", icon: CheckSquare },
      { href: "/kalendarz", label: "Kalendarz", icon: Calendar },
    ],
  },
  {
    label: "Kartoteka",
    items: [
      { href: "/klienci", label: "Klienci", icon: Users },
      { href: "/sprawy", label: "Sprawy", icon: Briefcase },
    ],
  },
  {
    label: "Rozliczenia",
    items: [
      { href: "/rozliczenia", label: "Zamknięcie okresu", icon: Receipt, roles: ["owner", "partner"] },
      { href: "/faktury", label: "Faktury", icon: FileText, roles: ["owner", "partner"] },
      { href: "/raporty", label: "Raporty", icon: BarChart3, roles: ["owner", "partner"] },
    ],
  },
];

function isItemVisible(item: NavItem, role: OrgRole): boolean {
  return !item.roles || item.roles.includes(role);
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ role, onNavigate }: { role: OrgRole; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-6 px-3 py-4">
      {NAV_GROUPS.map((group) => {
        const items = group.items.filter((item) => isItemVisible(item, role));
        if (items.length === 0) return null;

        return (
          <div key={group.label}>
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring",
                        active
                          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                      )}
                    >
                      {/* Złoty wskaźnik aktywnej pozycji — złoto jako wypełnienie,
                          nie jako kolor tekstu. */}
                      {active && (
                        <span
                          aria-hidden="true"
                          className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-sidebar-primary"
                        />
                      )}
                      <Icon className="size-4 shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function SidebarFooter({
  displayName,
  role,
  canManage,
  logoutAction,
  onNavigate,
}: {
  displayName: string;
  role: OrgRole;
  canManage: boolean;
  logoutAction: () => Promise<void>;
  onNavigate?: () => void;
}) {
  return (
    <div className="border-t border-sidebar-border px-3 py-3">
      {canManage && (
        <Link
          href="/ustawienia"
          onClick={onNavigate}
          className="mb-2 flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
        >
          <Settings className="size-4 shrink-0" />
          Ustawienia
        </Link>
      )}

      <div className="rounded-md bg-sidebar-accent/40 px-3 py-2.5">
        <p className="truncate text-sm font-medium text-sidebar-accent-foreground">{displayName}</p>
        <p className="text-xs text-sidebar-foreground/60">{ORG_ROLE_LABELS[role]}</p>
      </div>

      <form action={logoutAction} className="mt-2">
        <SubmitButton
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 px-3 text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
          pendingLabel="Wylogowywanie…"
        >
          <LogOut className="size-4 shrink-0" />
          Wyloguj się
        </SubmitButton>
      </form>
    </div>
  );
}

export interface AppShellProps {
  displayName: string;
  organizationName: string;
  role: OrgRole;
  canManage: boolean;
  logoutAction: () => Promise<void>;
  children: React.ReactNode;
  quickAction?: React.ReactNode;
}

export function AppShell({
  displayName,
  organizationName,
  role,
  canManage,
  logoutAction,
  children,
  quickAction,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarContent = (onNavigate?: () => void) => (
    <>
      <div className="flex items-center gap-2.5 border-b border-sidebar-border px-5 py-4 text-sidebar-foreground">
        <BrandMark />
        <div className="min-w-0">
          <BrandWordmark />
          <p className="truncate text-[11px] text-sidebar-foreground/55">{organizationName}</p>
        </div>
      </div>
      <NavLinks role={role} onNavigate={onNavigate} />
      <SidebarFooter
        displayName={displayName}
        role={role}
        canManage={canManage}
        logoutAction={logoutAction}
        onNavigate={onNavigate}
      />
    </>
  );

  return (
    <div className="flex min-h-svh">
      {/* Panel boczny na dużych ekranach */}
      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar lg:flex">
        {sidebarContent()}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur lg:px-8">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Otwórz menu" />
              }
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-0 bg-sidebar p-0">
              <SheetTitle className="sr-only">Menu nawigacyjne</SheetTitle>
              <div className="flex h-full flex-col">{sidebarContent(() => setMobileOpen(false))}</div>
            </SheetContent>
          </Sheet>

          <div className="lg:hidden">
            <BrandWordmark className="text-foreground" />
          </div>

          {/* Rejestracja czasu jest czynnością wykonywaną kilkanaście razy
              dziennie — musi być osiągalna z każdego ekranu. */}
          <div className="ml-auto">{quickAction}</div>
        </header>

        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
