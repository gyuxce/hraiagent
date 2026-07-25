"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensureUserHasAgency } from "@/lib/actions/agency";
import { summarizeInterviewTranscript } from "@/lib/ai/openrouter";
import {
  consumeAiQuota,
  quotaExceededMessage,
} from "@/lib/ai/usage";

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

async function getCurrentProfile() {
  const supabase = await createClient();
  const ensured = await ensureUserHasAgency();
  if (ensured.error || !ensured.profile?.agency_id) {
    return {
      supabase,
      error: (ensured.error || "Akun belum terhubung ke agency") as string,
      profile: null,
    };
  }
  return { supabase, error: null, profile: ensured.profile };
}

function formatAiSummary(result: {
  summary: string;
  strengths: string[];
  concerns: string[];
  recommendation: string;
}): string {
  const strengths =
    result.strengths.length > 0
      ? result.strengths.map((s) => `• ${s}`).join("\n")
      : "• —";
  const concerns =
    result.concerns.length > 0
      ? result.concerns.map((s) => `• ${s}`).join("\n")
      : "• —";

  return [
    result.summary,
    "",
    "Kekuatan:",
    strengths,
    "",
    "Perhatian:",
    concerns,
    "",
    `Rekomendasi: ${result.recommendation}`,
  ].join("\n");
}

export async function createInterviewNote(formData: FormData) {
  const { supabase, error: authError, profile } = await getCurrentProfile();
  if (authError || !profile) return { error: authError || "Unauthorized" };

  const candidateId = String(formData.get("candidate_id") || "").trim();
  const title =
    String(formData.get("title") || "").trim() || "Interview Notes";
  const transcript = String(formData.get("transcript") || "").trim();
  const interviewerNotes =
    String(formData.get("interviewer_notes") || "").trim() || null;
  const runAi = formData.get("run_ai") === "true";
  const conductedAtRaw = String(formData.get("conducted_at") || "").trim();
  const conductedAt = conductedAtRaw
    ? new Date(conductedAtRaw).toISOString()
    : new Date().toISOString();

  if (!candidateId) return { error: "Kandidat wajib dipilih" };
  if (!transcript) return { error: "Transkrip / catatan interview wajib diisi" };

  const { data: candidate, error: cErr } = await supabase
    .from("candidates")
    .select(
      "id, name, agency_id, job_id, job_requisitions(title, description, requirements)"
    )
    .eq("id", candidateId)
    .single();

  if (cErr || !candidate) return { error: "Kandidat tidak ditemukan" };

  let aiSummary: string | null = null;

  if (runAi) {
    const quota = await consumeAiQuota(supabase, {
      agencyId: profile.agency_id,
      eventType: "interview_summary",
      userId: profile.id,
      resourceType: "candidate",
      resourceId: candidateId,
    });

    if (!quota.ok && !quota.soft) {
      aiSummary = quotaExceededMessage(quota);
    } else {
      try {
        const job = candidate.job_requisitions as unknown as
          | {
              title?: string;
              description?: string;
              requirements?: string[];
            }
          | {
              title?: string;
              description?: string;
              requirements?: string[];
            }[]
          | null;

        const jobObj = Array.isArray(job) ? job[0] : job;

        const result = await summarizeInterviewTranscript({
          candidateName: candidate.name,
          jobTitle: jobObj?.title || "Posisi",
          jobDescription: jobObj?.description || "",
          requirements: Array.isArray(jobObj?.requirements)
            ? jobObj.requirements
            : [],
          transcript,
          interviewerNotes,
        });
        aiSummary = formatAiSummary(result);
      } catch (err) {
        aiSummary = "AI summary gagal: " + formatError(err);
      }
    }
  }

  const { error } = await supabase.from("interview_notes").insert({
    agency_id: profile.agency_id,
    candidate_id: candidateId,
    created_by: profile.id,
    title,
    transcript,
    interviewer_notes: interviewerNotes,
    ai_summary: aiSummary,
    conducted_at: conductedAt,
  });

  if (error) return { error: formatError(error) };

  // Auto-move pipeline ke interview jika masih submitted/screened
  await supabase
    .from("candidates")
    .update({ status: "interview" })
    .eq("id", candidateId)
    .in("status", ["submitted", "screened"]);

  revalidatePath("/candidates");
  revalidatePath(`/candidates/${candidateId}`);
  revalidatePath("/compare");
  return { success: true };
}

export async function deleteInterviewNote(id: string, candidateId: string) {
  const { supabase, error: authError, profile } = await getCurrentProfile();
  if (authError || !profile) return { error: authError || "Unauthorized" };

  if (profile.role !== "admin_agency") {
    return { error: "Hanya admin yang bisa menghapus catatan interview" };
  }

  const { error } = await supabase
    .from("interview_notes")
    .delete()
    .eq("id", id);

  if (error) return { error: formatError(error) };

  revalidatePath(`/candidates/${candidateId}`);
  revalidatePath("/candidates");
  return { success: true };
}

export async function regenerateInterviewSummary(noteId: string) {
  const { supabase, error: authError, profile } = await getCurrentProfile();
  if (authError || !profile?.agency_id) {
    return { error: authError || "Akun belum terhubung ke agency" };
  }

  const { data: note, error: nErr } = await supabase
    .from("interview_notes")
    .select(
      "id, transcript, interviewer_notes, candidate_id, candidates(name, job_requisitions(title, description, requirements))"
    )
    .eq("id", noteId)
    .single();

  if (nErr || !note) return { error: "Catatan tidak ditemukan" };

  const cand = note.candidates as unknown as {
    name?: string;
    job_requisitions?:
      | { title?: string; description?: string; requirements?: string[] }
      | { title?: string; description?: string; requirements?: string[] }[]
      | null;
  } | null;

  const jobRaw = cand?.job_requisitions;
  const job = Array.isArray(jobRaw) ? jobRaw[0] : jobRaw;

  const quota = await consumeAiQuota(supabase, {
    agencyId: profile.agency_id,
    eventType: "interview_summary",
    userId: profile.id,
    resourceType: "interview_note",
    resourceId: noteId,
  });
  if (!quota.ok && !quota.soft) {
    return { error: quotaExceededMessage(quota) };
  }

  try {
    const result = await summarizeInterviewTranscript({
      candidateName: cand?.name || "Kandidat",
      jobTitle: job?.title || "Posisi",
      jobDescription: job?.description || "",
      requirements: Array.isArray(job?.requirements) ? job.requirements : [],
      transcript: note.transcript,
      interviewerNotes: note.interviewer_notes,
    });

    const { error } = await supabase
      .from("interview_notes")
      .update({ ai_summary: formatAiSummary(result) })
      .eq("id", noteId);

    if (error) return { error: formatError(error) };
  } catch (err) {
    return { error: formatError(err) };
  }

  revalidatePath(`/candidates/${note.candidate_id}`);
  return { success: true };
}
