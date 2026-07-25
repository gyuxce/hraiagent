import { createClient } from "@/lib/supabase/server";
import { ensureUserHasAgency } from "@/lib/actions/agency";
import { JobsTable } from "@/components/jobs/jobs-table";
import type { ClientCompany } from "@/types/database";
import type { JobWithClient } from "@/components/jobs/job-form-modal";

export default async function JobsPage() {
  const supabase = await createClient();
  const ensured = await ensureUserHasAgency();

  if (ensured.error && !ensured.profile?.agency_id) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        {ensured.error}
      </div>
    );
  }

  const [{ data: jobs, error: jobsError }, { data: clients }] = await Promise.all([
    supabase
      .from("job_requisitions")
      .select("*, client_companies(id, name)")
      .order("created_at", { ascending: false }),
    supabase
      .from("client_companies")
      .select("*")
      .order("name", { ascending: true }),
  ]);

  if (jobsError) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        Gagal memuat jobs: {jobsError.message}
      </div>
    );
  }

  return (
    <JobsTable
      jobs={(jobs || []) as JobWithClient[]}
      clients={(clients || []) as ClientCompany[]}
      isAdmin={ensured.profile?.role === "admin_agency"}
    />
  );
}
