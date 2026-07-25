import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

export type SessionProfile = {
  id: string;
  agency_id: string | null;
  role: UserRole;
  full_name: string;
  client_id: string | null;
};

/** Profile that is already linked to an agency. */
export type AgencyLinkedProfile = SessionProfile & { agency_id: string };

/** One Supabase server client per RSC request. */
export const getSupabase = cache(async () => createClient());

/** Deduped auth.getUser() for layout + pages in the same request. */
export const getAuthUser = cache(async () => {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * Deduped profile fetch. Layout + ensureUserHasAgency share this
 * so navigating menus does not triple-hit Supabase Auth/DB.
 */
export const getSessionProfile = cache(async () => {
  const supabase = await getSupabase();
  const user = await getAuthUser();

  if (!user) {
    return { supabase, user: null, profile: null as SessionProfile | null };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("id, agency_id, role, full_name, client_id")
    .eq("id", user.id)
    .single();

  return {
    supabase,
    user,
    profile: (profile as SessionProfile | null) || null,
  };
});
