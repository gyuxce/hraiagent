import { createClient } from "@/lib/supabase/server";
import { ensureUserHasAgency } from "@/lib/actions/agency";
import { canWriteAgencyData, isAdminAgency } from "@/lib/auth/roles";
import {
  ScheduleClient,
  type CandidateOption,
  type ScheduleRow,
} from "@/components/schedule/schedule-client";

export default async function SchedulePage() {
  const supabase = await createClient();
  const ensured = await ensureUserHasAgency();

  if (ensured.error && !ensured.profile?.agency_id) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        {ensured.error}
      </div>
    );
  }

  const [{ data: schedules, error }, { data: candidates }] = await Promise.all([
    supabase
      .from("interview_schedules")
      .select(
        "*, candidates(id, name), job_requisitions(title), client_companies(name)"
      )
      .order("scheduled_at", { ascending: true }),
    supabase
      .from("candidates")
      .select("id, name, job_requisitions(title, client_companies(name))")
      .order("created_at", { ascending: false }),
  ]);

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        Gagal memuat jadwal: {error.message}. Pastikan migration{" "}
        <code className="rounded bg-red-100 px-1">00008_interview_schedules.sql</code>{" "}
        sudah dijalankan.
      </div>
    );
  }

  return (
    <ScheduleClient
      schedules={(schedules || []) as unknown as ScheduleRow[]}
      candidates={(candidates || []) as unknown as CandidateOption[]}
      canWrite={canWriteAgencyData(ensured.profile)}
      isAdmin={isAdminAgency(ensured.profile)}
    />
  );
}
