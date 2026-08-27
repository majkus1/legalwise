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
  Bell,
} from "lucide-react";
import { BrandLogoReversed, BrandMark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme";
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
    // `min-h-0` jest tu konieczne: element flex ma domyslnie `min-height: auto`,
    // wiec nie skurczy sie ponizej wysokosci swojej tresci i zamiast przewijac
    // sie sam, wypchnalby stopke pod krawedz ekranu.
    <nav className="min-h-0 flex-1 space-y-6 overflow-y-auto px-3 py-4">
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
    <div className="shrink-0 border-t border-sidebar-border px-3 py-3">
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
  role: OrgRole;
  canManage: boolean;
  logoutAction: () => Promise<void>;
  children: React.ReactNode;
  quickAction?: React.ReactNode;
  /** Liczba nieprzeczytanych powiadomień — 0 ukrywa znacznik. */
  unreadCount?: number;
}

export function AppShell({
  displayName,
  role,
  canManage,
  logoutAction,
  children,
  quickAction,
  unreadCount = 0,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarContent = (onNavigate?: () => void) => (
    <>
      {/* Znak kancelarii z ich pliku, obok nazwa organizacji zwykłym tekstem.
          Napisu „LEGALWISE” nie składamy tu czcionką interfejsu — krój liter
          w logo jest inny i podrobiony napis rzucał się w oczy. */}
      {/* Pełne logo kancelarii, nie znak z dopisaną nazwą. Nazwa organizacji
          jest już w samym logo, więc powtarzanie jej obok byłoby dublowaniem. */}
      <div className="flex shrink-0 items-center border-b border-sidebar-border px-5 py-5">
        <BrandLogoReversed />
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
      <aside
        // sticky + pełna wysokość ekranu: menu i dane użytkownika zostają
        // widoczne, gdy treść jest dłuższa niż okno. Bez tego stopka panelu
        // znikała poza ekranem na listach spraw czy faktur.
        className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col overflow-hidden bg-sidebar lg:flex"
      >
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
            <SheetContent
              side="left"
              // Panel jest granatowy, a przycisk zamykania to `ghost` bez
              // własnego koloru tekstu — dziedziczyłby ciemny z motywu jasnego
              // i znikał na granacie. Narzucamy tu barwy panelu, razem ze
              // stanem najechania, bo `ghost` rozjaśnia się w drugą stronę.
              className="w-72 border-0 bg-sidebar p-0 text-sidebar-foreground [&_[data-slot=sheet-close]]:text-sidebar-foreground [&_[data-slot=sheet-close]]:hover:bg-sidebar-accent [&_[data-slot=sheet-close]]:hover:text-sidebar-accent-foreground"
            >
              <SheetTitle className="sr-only">Menu nawigacyjne</SheetTitle>
              <div className="flex h-full flex-col">{sidebarContent(() => setMobileOpen(false))}</div>
            </SheetContent>
          </Sheet>

          {/* Sam znak kancelarii. Pelne logo zeszloby tu do ok. 25 px wysokosci,
              a nazwy nie dopisujemy czcionka interfejsu — pelne logo czeka
              w menu, ktore otwiera przycisk obok. */}
          <div className="flex shrink-0 items-center lg:hidden">
            <BrandMark className="h-7" />
          </div>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <Link
              href="/powiadomienia"
              aria-label={
                unreadCount > 0
                  ? `Powiadomienia: ${unreadCount} nieprzeczytanych`
                  : "Powiadomienia"
              }
              className="relative inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Bell className="size-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-[var(--brand-gold)] px-1 text-[10px] font-bold text-[var(--brand-navy)]">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>

            {/* Rejestracja czasu jest czynnością wykonywaną kilkanaście razy
                dziennie — musi być osiągalna z każdego ekranu. */}
            {quickAction}
          </div>
        </header>

        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
