import { ensureUserHasAgency } from "@/lib/actions/agency";
import { getSupabase, type AgencyLinkedProfile } from "@/lib/auth/session";

type AgencyContextOk = {
  supabase: Awaited<ReturnType<typeof getSupabase>>;
  error: null;
  profile: AgencyLinkedProfile;
};

type AgencyContextErr = {
  supabase: Awaited<ReturnType<typeof getSupabase>>;
  error: string;
  profile: null;
};

/** Shared auth+agency gate for server actions/pages (request-cached). */
export async function requireAgencyContext(): Promise<
  AgencyContextOk | AgencyContextErr
> {
  const supabase = await getSupabase();
  const ensured = await ensureUserHasAgency();

  if (ensured.error !== null) {
    return {
      supabase,
      error: ensured.error || "Akun belum terhubung ke agency",
      profile: null,
    };
  }

  return {
    supabase,
    error: null,
    profile: ensured.profile,
  };
}
