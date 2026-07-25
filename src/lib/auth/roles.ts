import type { UserRole } from "@/types/database";

export type ProfileRole = {
  role?: string | null;
  client_id?: string | null;
};

export function isAdminAgency(profile?: ProfileRole | null): boolean {
  return profile?.role === "admin_agency";
}

export function isAgencyStaff(profile?: ProfileRole | null): boolean {
  return profile?.role === "admin_agency" || profile?.role === "recruiter";
}

export function isClientViewer(profile?: ProfileRole | null): boolean {
  return profile?.role === "client_viewer";
}

export function canWriteAgencyData(profile?: ProfileRole | null): boolean {
  return isAgencyStaff(profile);
}

export function roleLabel(role: UserRole | string | null | undefined): string {
  switch (role) {
    case "admin_agency":
      return "Admin Agency";
    case "recruiter":
      return "Recruiter";
    case "client_viewer":
      return "Client Viewer";
    default:
      return role || "—";
  }
}
