import { createClient } from "@/lib/supabase/server";
import { ensureUserHasAgency } from "@/lib/actions/agency";
import {
  CandidatesTable,
  type CandidateRow,
} from "@/components/candidates/candidates-table";
import type { JobOption } from "@/components/candidates/candidate-form-modal";

export default async function CandidatesPage() {
  const supabase = await createClient();
  const ensured = await ensureUserHasAgency();

  if (ensured.error && !ensured.profile?.agency_id) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        {ensured.error}
      </div>
    );
  }

  const [{ data: candidates, error }, { data: jobs }] = await Promise.all([
    supabase
      .from("candidates")
      .select(
        "*, job_requisitions(id, title, client_companies(name))"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("job_requisitions")
      .select("id, title, status, client_companies(name)")
      .order("created_at", { ascending: false }),
  ]);

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        Gagal memuat candidates: {error.message}
      </div>
    );
  }

  return (
    <CandidatesTable
      candidates={(candidates || []) as unknown as CandidateRow[]}
      jobs={(jobs || []) as unknown as JobOption[]}
      isAdmin={ensured.profile?.role === "admin_agency"}
    />
  );
}
