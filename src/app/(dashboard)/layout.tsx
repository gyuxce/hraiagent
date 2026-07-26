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
        { name: "Ringkasan", href: "/dashboard", icon: "home" },
        { name: "Lowongan", href: "/jobs", icon: "briefcase" },
        { name: "Kandidat", href: "/candidates", icon: "userCheck" },
        { name: "Laporan", href: "/reports", icon: "fileSpreadsheet" },
      ]
    : (
        [
          { name: "Dashboard", href: "/dashboard", icon: "home", show: true },
          { name: "Klien", href: "/clients", icon: "users", show: true },
          { name: "Lowongan", href: "/jobs", icon: "briefcase", show: true },
          {
            name: "Kandidat",
            href: "/candidates",
            icon: "userCheck",
            show: true,
          },
          { name: "Bandingkan", href: "/compare", icon: "columns2", show: true },
          { name: "Peringkat", href: "/ranking", icon: "trophy", show: true },
          {
            name: "Jadwal",
            href: "/schedule",
            icon: "calendarDays",
            show: true,
          },
          {
            name: "Laporan",
            href: "/reports",
            icon: "fileSpreadsheet",
            show: true,
          },
          { name: "Tim", href: "/team", icon: "userCog", show: admin },
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
