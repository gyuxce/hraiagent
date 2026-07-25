"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Briefcase,
  CalendarDays,
  Columns2,
  FileSpreadsheet,
  Home,
  LogOut,
  Menu,
  Trophy,
  UserCheck,
  UserCog,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { BRAND } from "@/lib/brand";

export type NavIconName =
  | "home"
  | "users"
  | "briefcase"
  | "userCheck"
  | "columns2"
  | "trophy"
  | "calendarDays"
  | "fileSpreadsheet"
  | "userCog";

export type NavItem = {
  name: string;
  href: string;
  icon: NavIconName;
};

const ICONS: Record<NavIconName, LucideIcon> = {
  home: Home,
  users: Users,
  briefcase: Briefcase,
  userCheck: UserCheck,
  columns2: Columns2,
  trophy: Trophy,
  calendarDays: CalendarDays,
  fileSpreadsheet: FileSpreadsheet,
  userCog: UserCog,
};

type Props = {
  navigation: NavItem[];
  fullName: string;
  roleLabel: string;
  initials: string;
  isClientViewer: boolean;
  logoutAction: () => Promise<void>;
  children: ReactNode;
};

export function DashboardShell({
  navigation,
  fullName,
  roleLabel,
  initials,
  isClientViewer,
  logoutAction,
  children,
}: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const sidebar = (
    <div className="flex h-full w-72 max-w-[85vw] flex-col bg-ink text-white md:w-64">
      <div className="flex h-14 items-center justify-between px-5 md:h-16 md:px-6">
        <Link
          href="/dashboard"
          className="font-display text-xl font-extrabold tracking-tight"
          onClick={() => setOpen(false)}
        >
          {BRAND.name}
        </Link>
        <button
          type="button"
          className="rounded-md p-2 text-white/70 hover:bg-white/10 md:hidden"
          onClick={() => setOpen(false)}
          aria-label="Tutup menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {isClientViewer && (
        <div className="mx-4 mb-2 rounded-lg border border-white/10 bg-white/8 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-accent">
            Client portal
          </p>
          <p className="mt-0.5 text-xs text-white/65">Read-only progress view</p>
        </div>
      )}

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {navigation.map((item) => {
          const active = isActive(item.href);
          const Icon = ICONS[item.icon] || Home;
          return (
            <Link
              key={item.name}
              href={item.href}
              prefetch
              onClick={() => setOpen(false)}
              className={`group flex items-center gap-x-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-white/12 text-white"
                  : "text-white/75 hover:bg-white/8 hover:text-white"
              }`}
            >
              <Icon
                className={`h-4 w-4 transition-colors ${
                  active ? "text-accent" : "text-white/45 group-hover:text-accent"
                }`}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-x-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/20 text-sm font-semibold text-accent">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{fullName}</p>
            <p className="truncate text-xs text-white/50">{roleLabel}</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-md p-1.5 text-white/45 transition hover:bg-white/10 hover:text-white"
              title="Keluar"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-mist">
      <aside className="hidden border-r border-line md:flex">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink/50"
            aria-label="Tutup overlay"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 shadow-soft animate-rise">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-line bg-mist/90 px-4 backdrop-blur md:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg border border-line bg-surface p-2 text-ink"
            aria-label="Buka menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <p className="font-display text-base font-extrabold text-ink">
              {BRAND.name}
            </p>
            <p className="truncate text-[11px] text-muted">{BRAND.slogan}</p>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
