import { redirect } from "next/navigation";
import { logout } from "@/lib/actions/auth";
import { getSessionProfile } from "@/lib/auth/session";
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
  const { user, profile } = await getSessionProfile();

  if (!user) {
    redirect("/login");
  }

  const viewer = isClientViewer(profile);
  const admin = isAdminAgency(profile);

  const navigation: NavItem[] = viewer
    ? [
        { key: "overview", href: "/dashboard", icon: "home" },
        { key: "jobs", href: "/jobs", icon: "briefcase" },
        { key: "candidates", href: "/candidates", icon: "userCheck" },
        { key: "reports", href: "/reports", icon: "fileSpreadsheet" },
      ]
    : (
        [
          { key: "dashboard", href: "/dashboard", icon: "home", show: true },
          { key: "clients", href: "/clients", icon: "users", show: true },
          { key: "jobs", href: "/jobs", icon: "briefcase", show: true },
          {
            key: "candidates",
            href: "/candidates",
            icon: "userCheck",
            show: true,
          },
          { key: "compare", href: "/compare", icon: "columns2", show: true },
          { key: "ranking", href: "/ranking", icon: "trophy", show: true },
          {
            key: "schedule",
            href: "/schedule",
            icon: "calendarDays",
            show: true,
          },
          {
            key: "reports",
            href: "/reports",
            icon: "fileSpreadsheet",
            show: true,
          },
          { key: "team", href: "/team", icon: "userCog", show: admin },
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
