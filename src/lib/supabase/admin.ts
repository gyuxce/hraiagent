import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client for cron / privileged jobs.
 * Bypasses RLS — never expose to the browser.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY (dan NEXT_PUBLIC_SUPABASE_URL) wajib di-set untuk purge video."
    );
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
