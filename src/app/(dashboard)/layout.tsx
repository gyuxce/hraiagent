import { redirect } from "next/navigation";
import {
  Home,
  Users,
  Briefcase,
  UserCheck,
  Columns2,
  Trophy,
  UserCog,
  CalendarDays,
  FileSpreadsheet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/lib/actions/auth";
import { isAdminAgency, isClientViewer, roleLabel } from "@/lib/auth/roles";
import {
  DashboardShell,
  type NavItem,
} from "@/components/layout/dashboard-shell";

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

  const navigation: NavItem[] = viewer
    ? [
        { name: "Overview", href: "/dashboard", icon: Home },
        { name: "Jobs", href: "/jobs", icon: Briefcase },
        { name: "Candidates", href: "/candidates", icon: UserCheck },
        { name: "Reports", href: "/reports", icon: FileSpreadsheet },
      ]
    : (
        [
          { name: "Dashboard", href: "/dashboard", icon: Home, show: true },
          { name: "Clients", href: "/clients", icon: Users, show: true },
          { name: "Jobs", href: "/jobs", icon: Briefcase, show: true },
          { name: "Candidates", href: "/candidates", icon: UserCheck, show: true },
          { name: "Compare", href: "/compare", icon: Columns2, show: true },
          { name: "Ranking", href: "/ranking", icon: Trophy, show: true },
          { name: "Schedule", href: "/schedule", icon: CalendarDays, show: true },
          { name: "Reports", href: "/reports", icon: FileSpreadsheet, show: true },
          { name: "Team", href: "/team", icon: UserCog, show: admin },
        ] as Array<NavItem & { show?: boolean }>
      ).filter((item) => item.show !== false);

  const initials = profile?.full_name
    ? profile.full_name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <DashboardShell
      navigation={navigation}
      fullName={profile?.full_name || "User"}
      roleLabel={roleLabel(profile?.role)}
      initials={initials}
      isClientViewer={viewer}
      logoutAction={logout}
    >
      {children}
    </DashboardShell>
  );
}
