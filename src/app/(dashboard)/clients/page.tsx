import { createClient } from "@/lib/supabase/server";
import { ensureUserHasAgency } from "@/lib/actions/agency";
import { ClientsTable } from "@/components/clients/clients-table";
import type { ClientCompany } from "@/types/database";

export default async function ClientsPage() {
  const supabase = await createClient();

  // Auto-link agency if missing (from earlier partial signup)
  const ensured = await ensureUserHasAgency();

  if (ensured.error && !ensured.profile?.agency_id) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        {ensured.error}
        <p className="mt-2 text-xs">
          Pastikan kamu sudah run SQL file{" "}
          <code className="bg-red-100 px-1 rounded">00002_fix_agencies_rls.sql</code>{" "}
          di Supabase SQL Editor.
        </p>
      </div>
    );
  }

  const { data: clients, error } = await supabase
    .from("client_companies")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        Gagal memuat clients: {error.message}
      </div>
    );
  }

  return (
    <ClientsTable
      clients={(clients || []) as ClientCompany[]}
      isAdmin={ensured.profile?.role === "admin_agency"}
    />
  );
}
