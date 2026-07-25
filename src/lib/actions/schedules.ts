"use server";

import { revalidatePath } from "next/cache";
import { canWriteAgencyData } from "@/lib/auth/roles";
import { requireAgencyContext } from "@/lib/auth/agency-context";

function formatError(error: unknown): string {
  if (!error) return "Terjadi kesalahan";
  if (typeof error === "string") return error;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null) {
    const e = error as Record<string, unknown>;
    if (typeof e.message === "string" && e.message) return e.message;
  }
  return "Terjadi kesalahan";
}

async function getStaffProfile() {
  const ctx = await requireAgencyContext();
  if (ctx.error !== null) {
    return {
      supabase: ctx.supabase,
      error: ctx.error,
      profile: null as null,
    };
  }
  if (!canWriteAgencyData(ctx.profile)) {
    return {
      supabase: ctx.supabase,
      error: "Client viewer hanya bisa melihat jadwal",
      profile: null as null,
    };
  }
  return { supabase: ctx.supabase, error: null as null, profile: ctx.profile };
}

export async function createInterviewSchedule(formData: FormData) {
  const { supabase, error: authError, profile } = await getStaffProfile();
  if (authError || !profile) return { error: authError || "Unauthorized" };

  const candidateId = String(formData.get("candidate_id") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const scheduledAt = String(formData.get("scheduled_at") || "").trim();
  const durationMinutes = Number(formData.get("duration_minutes") || 60);
  const location = String(formData.get("location") || "").trim() || null;
  const meetingUrl = String(formData.get("meeting_url") || "").trim() || null;
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!candidateId || !title || !scheduledAt) {
    return { error: "Kandidat, judul, dan waktu wajib diisi" };
  }

  if (!Number.isFinite(durationMinutes) || durationMinutes < 15) {
    return { error: "Durasi minimal 15 menit" };
  }

  const { data: candidate, error: cErr } = await supabase
    .from("candidates")
    .select("id, job_id, agency_id, job_requisitions(client_id, title)")
    .eq("id", candidateId)
    .single();

  if (cErr || !candidate) return { error: "Kandidat tidak ditemukan" };

  const jobRaw = candidate.job_requisitions as unknown;
  const job = Array.isArray(jobRaw) ? jobRaw[0] : jobRaw;
  const clientId =
    (job as { client_id?: string } | null)?.client_id || null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("interview_schedules").insert({
    agency_id: profile.agency_id,
    candidate_id: candidateId,
    job_id: candidate.job_id,
    client_id: clientId,
    title,
    scheduled_at: new Date(scheduledAt).toISOString(),
    duration_minutes: durationMinutes,
    location,
    meeting_url: meetingUrl,
    notes,
    created_by: user?.id || null,
  });

  if (error) {
    return {
      error:
        formatError(error) +
        ". Pastikan migration 00008_interview_schedules.sql sudah dijalankan.",
    };
  }

  revalidatePath("/schedule");
  revalidatePath(`/candidates/${candidateId}`);
  return { success: true };
}

export async function updateInterviewScheduleStatus(
  id: string,
  status: string
) {
  const { supabase, error: authError } = await getStaffProfile();
  if (authError) return { error: authError };

  const valid = ["scheduled", "completed", "cancelled", "no_show"];
  if (!valid.includes(status)) return { error: "Status tidak valid" };

  const { error } = await supabase
    .from("interview_schedules")
    .update({ status })
    .eq("id", id);

  if (error) return { error: formatError(error) };
  revalidatePath("/schedule");
  return { success: true };
}

export async function deleteInterviewSchedule(id: string) {
  const ctx = await requireAgencyContext();
  if (ctx.error !== null) {
    return { error: ctx.error || "Unauthorized" };
  }
  if (ctx.profile.role !== "admin_agency") {
    return { error: "Hanya admin yang bisa hapus jadwal" };
  }

  const { error } = await ctx.supabase
    .from("interview_schedules")
    .delete()
    .eq("id", id);

  if (error) return { error: formatError(error) };
  revalidatePath("/schedule");
  return { success: true };
}
