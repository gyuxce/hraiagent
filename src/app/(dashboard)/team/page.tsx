import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureUserHasAgency } from "@/lib/actions/agency";
import {
  TeamClient,
  type InviteRow,
  type TeamMember,
} from "@/components/team/team-client";
import type { ClientCompany } from "@/types/database";

export default async function TeamPage() {
  const supabase = await createClient();
  const ensured = await ensureUserHasAgency();

  if (ensured.error && !ensured.profile?.agency_id) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        {ensured.error}
      </div>
    );
  }

  if (ensured.profile?.role !== "admin_agency") {
    redirect("/dashboard");
  }

  const [{ data: members }, { data: invites }, { data: clients }] =
    await Promise.all([
      supabase
        .from("users")
        .select("id, full_name, role, client_id, created_at, client_companies(name)")
        .order("created_at", { ascending: true }),
      supabase
        .from("team_invites")
        .select(
          "id, email, role, client_id, token, expires_at, accepted_at, created_at, client_companies(name)"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("client_companies")
        .select("*")
        .order("name", { ascending: true }),
    ]);

  return (
    <TeamClient
      members={(members || []) as unknown as TeamMember[]}
      invites={(invites || []) as unknown as InviteRow[]}
      clients={(clients || []) as ClientCompany[]}
      currentUserId={ensured.profile.id}
    />
  );
}
