import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Home,
  Users,
  Briefcase,
  UserCheck,
  Columns2,
  Trophy,
  LogOut,
  UserCog,
  CalendarDays,
  FileSpreadsheet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/lib/actions/auth";
import { isAdminAgency, isClientViewer, roleLabel } from "@/lib/auth/roles";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  const viewer = isClientViewer(profile);
  const admin = isAdminAgency(profile);

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: Home, show: true },
    { name: "Clients", href: "/clients", icon: Users, show: !viewer },
    { name: "Jobs", href: "/jobs", icon: Briefcase, show: true },
    { name: "Candidates", href: "/candidates", icon: UserCheck, show: true },
    { name: "Compare", href: "/compare", icon: Columns2, show: !viewer },
    { name: "Ranking", href: "/ranking", icon: Trophy, show: true },
    { name: "Schedule", href: "/schedule", icon: CalendarDays, show: true },
    { name: "Reports", href: "/reports", icon: FileSpreadsheet, show: true },
    { name: "Team", href: "/team", icon: UserCog, show: admin },
  ].filter((item) => item.show);

  const initials = profile?.full_name
    ? profile.full_name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <div className="flex h-screen bg-mist">
      <aside className="flex w-64 flex-col border-r border-line bg-ink text-white">
        <div className="flex h-16 items-center px-6">
          <Link
            href="/dashboard"
            className="font-display text-xl font-extrabold tracking-tight"
          >
            Recruit<span className="text-accent">AI</span>
          </Link>
        </div>

        {viewer && (
          <div className="mx-4 mb-2 rounded-lg bg-white/8 px-3 py-2 text-xs text-white/70">
            Portal klien · read-only
          </div>
        )}

        <nav className="flex-1 space-y-1 px-3 py-2">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="group flex items-center gap-x-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/75 transition-colors hover:bg-white/8 hover:text-white"
            >
              <item.icon className="h-4 w-4 text-white/45 transition-colors group-hover:text-accent" />
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/20 text-sm font-semibold text-accent">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {profile?.full_name || "User"}
              </p>
              <p className="truncate text-xs text-white/50">
                {roleLabel(profile?.role)}
              </p>
            </div>
            <form action={logout}>
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
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-6 py-8 sm:px-8">{children}</div>
      </main>
    </div>
  );
}
