"use server";

import { createClient } from "@/lib/supabase/server";

export async function ensureUserHasAgency(fallbackName?: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Anda harus login", agencyId: null, profile: null };
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("id, agency_id, role, full_name")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { error: "Profile tidak ditemukan", agencyId: null, profile: null };
  }

  if (profile.agency_id) {
    return { error: null, agencyId: profile.agency_id, profile };
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

  const { data: updatedProfile } = await supabase
    .from("users")
    .select("id, agency_id, role, full_name")
    .eq("id", user.id)
    .single();

  return {
    error: null,
    agencyId: (agencyId as string) || updatedProfile?.agency_id || null,
    profile: updatedProfile || { ...profile, agency_id: agencyId as string, role: "admin_agency" },
  };
}
