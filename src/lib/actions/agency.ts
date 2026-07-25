"use server";

import {
  getAuthUser,
  getSessionProfile,
  getSupabase,
  type AgencyLinkedProfile,
  type SessionProfile,
} from "@/lib/auth/session";

type EnsureResult =
  | {
      error: null;
      agencyId: string;
      profile: AgencyLinkedProfile;
    }
  | {
      error: string;
      agencyId: null;
      profile: SessionProfile | null;
    };

export async function ensureUserHasAgency(
  fallbackName?: string
): Promise<EnsureResult> {
  const { supabase, user, profile } = await getSessionProfile();

  if (!user) {
    return { error: "Anda harus login", agencyId: null, profile: null };
  }

  if (!profile) {
    return { error: "Profile tidak ditemukan", agencyId: null, profile: null };
  }

  if (profile.agency_id) {
    return {
      error: null,
      agencyId: profile.agency_id,
      profile: profile as AgencyLinkedProfile,
    };
  }

  // Recover: create agency for users stuck without agency_id
  const meta = user.user_metadata || {};
  const agencyName =
    fallbackName ||
    (typeof meta.agency_name === "string" && meta.agency_name) ||
    `${profile.full_name || "My"} Agency`;

  const { data: agencyId, error: rpcError } = await supabase.rpc(
    "create_agency_with_admin",
    {
      agency_name: agencyName,
      admin_full_name: profile.full_name,
    }
  );

  if (rpcError) {
    return {
      error: "Gagal setup agency: " + rpcError.message,
      agencyId: null,
      profile,
    };
  }

  // Fresh client read after recovery (bypass request memo of old null agency)
  const fresh = await getSupabase();
  const authUser = await getAuthUser();
  const { data: updatedProfile } = await fresh
    .from("users")
    .select("id, agency_id, role, full_name, client_id")
    .eq("id", authUser?.id || user.id)
    .single();

  const linkedId =
    (agencyId as string | null) ||
    (updatedProfile?.agency_id as string | null) ||
    null;

  if (!linkedId) {
    return {
      error: "Gagal menghubungkan agency",
      agencyId: null,
      profile,
    };
  }

  const nextProfile: AgencyLinkedProfile = {
    id: updatedProfile?.id || profile.id,
    agency_id: linkedId,
    role: (updatedProfile?.role as SessionProfile["role"]) || "admin_agency",
    full_name: updatedProfile?.full_name || profile.full_name,
    client_id: (updatedProfile?.client_id as string | null) ?? null,
  };

  return {
    error: null,
    agencyId: linkedId,
    profile: nextProfile,
  };
}
