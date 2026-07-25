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
    { name: "Compare", href: "/compare", icon: Columns2, show: true },
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
    <div className="flex h-screen">
      <aside className="flex w-64 flex-col border-r border-gray-200 bg-white">
        <div className="flex h-16 items-center px-6 border-b border-gray-200">
          <Link href="/dashboard" className="text-xl font-bold text-gray-900">
            Recruit<span className="text-blue-600">AI</span>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="flex items-center gap-x-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              <item.icon className="h-5 w-5 text-gray-400" />
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center gap-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-semibold text-sm">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {profile?.full_name || "User"}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {roleLabel(profile?.role)} · {user.email}
              </p>
            </div>
            <form action={logout}>
              <button
                type="submit"
                className="text-gray-400 hover:text-gray-600"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-gray-50 p-8">{children}</main>
    </div>
  );
}
