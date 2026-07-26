"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { extractTextFromFile } from "@/lib/cv/extract-text";
import { extractContactHints } from "@/lib/cv/contact-hints";
import { screenCandidateWithAI } from "@/lib/ai/openrouter";
import {
  consumeAiQuota,
  quotaExceededMessage,
} from "@/lib/ai/usage";
import { requireAgencyContext } from "@/lib/auth/agency-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const PENDING_SUMMARY =
  "AI screening sedang diproses di background — refresh halaman sebentar lagi.";

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
  return requireAgencyContext();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function dbForBackground(fallback: any) {
  try {
    return createAdminClient();
  } catch {
    return fallback ?? (await createClient());
  }
}

async function runScreeningInBackground(params: {
  candidateId: string;
  agencyId: string;
  userId: string;
  cvText: string;
  jobTitle: string;
  jobDescription: string;
  requirements: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
}) {
  const db = await dbForBackground(params.supabase);
  const quota = await consumeAiQuota(db, {
    agencyId: params.agencyId,
    eventType: "cv_screen",
    userId: params.userId,
    resourceType: "candidate",
    resourceId: params.candidateId,
  });

  if (!quota.ok && !quota.soft) {
    await db
      .from("candidates")
      .update({ ai_summary: quotaExceededMessage(quota) })
      .eq("id", params.candidateId);
    revalidatePath("/candidates");
    revalidatePath(`/candidates/${params.candidateId}`);
    return;
  }

  try {
    const result = await screenCandidateWithAI({
      cvText: params.cvText,
      jobTitle: params.jobTitle,
      jobDescription: params.jobDescription,
      requirements: params.requirements,
    });

    await db
      .from("candidates")
      .update({
        ai_score: result.score,
        ai_summary: result.summary,
        ai_score_breakdown: result.breakdown,
        parsed_data: result.parsed,
        status: "screened",
        manual_score: null,
        manual_score_reason: null,
        manual_score_updated_at: null,
      })
      .eq("id", params.candidateId);

    // Enrich empty contact fields from AI parse if still blank
    const { data: row } = await db
      .from("candidates")
      .select("name, email, phone")
      .eq("id", params.candidateId)
      .maybeSingle();

    if (row) {
      const patch: Record<string, string> = {};
      if ((!row.name || row.name === "Kandidat") && result.parsed.name) {
        patch.name = result.parsed.name;
      }
      if (!row.email && result.parsed.email) patch.email = result.parsed.email;
      if (!row.phone && result.parsed.phone) patch.phone = result.parsed.phone;
      if (Object.keys(patch).length) {
        await db.from("candidates").update(patch).eq("id", params.candidateId);
      }
    }
  } catch (err) {
    await db
      .from("candidates")
      .update({
        ai_summary: "AI screening gagal: " + formatError(err),
      })
      .eq("id", params.candidateId);
  }

  revalidatePath("/candidates");
  revalidatePath(`/candidates/${params.candidateId}`);
}

export async function createCandidate(formData: FormData) {
  const { supabase, error: authError, profile } = await getCurrentProfile();
  if (authError || !profile) return { error: authError || "Unauthorized" };

  const jobId = String(formData.get("job_id") || "").trim();
  let name = String(formData.get("name") || "").trim();
  let email = String(formData.get("email") || "").trim();
  let phone = String(formData.get("phone") || "").trim() || null;
  const runAi = formData.get("run_ai") === "true";
  const file = formData.get("cv") as File | null;

  if (!jobId) return { error: "Job wajib dipilih" };

  const { data: job, error: jobError } = await supabase
    .from("job_requisitions")
    .select("id, title, description, requirements, agency_id")
    .eq("id", jobId)
    .single();

  if (jobError || !job) {
    return { error: "Job tidak ditemukan" };
  }

  let cvFilePath: string | null = null;
  let cvText = "";

  if (file && file.size > 0) {
    if (file.size > MAX_FILE_SIZE) {
      return { error: "Ukuran file maksimal 10MB" };
    }

    const mime = file.type || "application/octet-stream";
    if (
      !ALLOWED_TYPES.includes(mime) &&
      !file.name.match(/\.(pdf|txt|docx?)$/i)
    ) {
      return { error: "Format file harus PDF, DOCX, atau TXT" };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${profile.agency_id}/${jobId}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("cvs")
      .upload(path, buffer, {
        contentType: mime,
        upsert: false,
      });

    if (uploadError) {
      return {
        error:
          "Gagal upload CV: " +
          uploadError.message +
          ". Pastikan bucket 'cvs' sudah dibuat (run 00004_storage_cvs.sql).",
      };
    }

    cvFilePath = path;

    try {
      cvText = await extractTextFromFile(buffer, mime, file.name);
    } catch (err) {
      return {
        error:
          "CV terupload, tapi gagal baca teks: " +
          formatError(err) +
          ". Coba file PDF berbasis teks.",
      };
    }

    // Fast local fill — don't wait for AI to extract contacts
    const hints = extractContactHints(cvText);
    if (!name && hints.name) name = hints.name;
    if (!email && hints.email) email = hints.email;
    if (!phone && hints.phone) phone = hints.phone;
  }

  if (!name) {
    return {
      error:
        "Nama kandidat wajib diisi (isi manual, atau upload CV teks yang jelas).",
    };
  }
  if (!email) {
    return {
      error:
        "Email kandidat wajib diisi (isi manual, atau pastikan email ada di CV).",
    };
  }

  const pendingAi = Boolean(runAi && cvText);
  const { data: inserted, error } = await supabase
    .from("candidates")
    .insert({
      job_id: jobId,
      agency_id: profile.agency_id,
      name,
      email,
      phone,
      cv_file_path: cvFilePath,
      parsed_data: null,
      ai_score: null,
      ai_summary: pendingAi ? PENDING_SUMMARY : null,
      ai_score_breakdown: null,
      status: "submitted",
    })
    .select("id")
    .single();

  if (error || !inserted) return { error: formatError(error) };

  const candidateId = inserted.id as string;
  const requirements = Array.isArray(job.requirements)
    ? (job.requirements as string[])
    : [];

  if (pendingAi) {
    after(async () => {
      await runScreeningInBackground({
        candidateId,
        agencyId: profile.agency_id,
        userId: profile.id,
        cvText,
        jobTitle: job.title,
        jobDescription: job.description || "",
        requirements,
        supabase,
      });
    });
  }

  revalidatePath("/candidates");
  return {
    success: true,
    candidateId,
    pendingScreening: pendingAi,
  };
}

export async function updateCandidateStatus(id: string, status: string) {
  const { supabase, error: authError } = await getCurrentProfile();
  if (authError) return { error: authError };

  const valid = [
    "submitted",
    "screened",
    "interview",
    "offer",
    "hired",
    "rejected",
  ];
  if (!valid.includes(status)) return { error: "Status tidak valid" };

  const { error } = await supabase
    .from("candidates")
    .update({ status })
    .eq("id", id);

  if (error) return { error: formatError(error) };

  revalidatePath("/candidates");
  revalidatePath(`/candidates/${id}`);
  return { success: true };
}

export async function deleteCandidate(id: string) {
  const { supabase, error: authError, profile } = await getCurrentProfile();
  if (authError || !profile) return { error: authError || "Unauthorized" };

  if (profile.role !== "admin_agency") {
    return { error: "Hanya admin yang bisa menghapus kandidat" };
  }

  const { data: candidate } = await supabase
    .from("candidates")
    .select("cv_file_path")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("candidates").delete().eq("id", id);
  if (error) return { error: formatError(error) };

  if (candidate?.cv_file_path) {
    await supabase.storage.from("cvs").remove([candidate.cv_file_path]);
  }

  revalidatePath("/candidates");
  return { success: true };
}

export async function rescreenCandidate(id: string) {
  const { supabase, error: authError, profile } = await getCurrentProfile();
  if (authError || !profile?.agency_id) {
    return { error: authError || "Akun belum terhubung ke agency" };
  }

  const { data: candidate, error: cErr } = await supabase
    .from("candidates")
    .select("*, job_requisitions(title, description, requirements)")
    .eq("id", id)
    .single();

  if (cErr || !candidate) return { error: "Kandidat tidak ditemukan" };
  if (!candidate.cv_file_path) return { error: "Kandidat tidak punya file CV" };

  const job = candidate.job_requisitions as {
    title: string;
    description: string;
    requirements: string[];
  } | null;

  if (!job) return { error: "Job terkait tidak ditemukan" };

  // Mark pending immediately so UI can close; AI runs in after()
  await supabase
    .from("candidates")
    .update({
      ai_summary: PENDING_SUMMARY,
      ai_score: null,
      ai_score_breakdown: null,
      status: "submitted",
    })
    .eq("id", id);

  const cvPath = candidate.cv_file_path as string;
  const agencyId = profile.agency_id;
  const userId = profile.id;
  const jobTitle = job.title;
  const jobDescription = job.description || "";
  const requirements = Array.isArray(job.requirements) ? job.requirements : [];

  after(async () => {
    const db = await dbForBackground(supabase);
    const { data: fileData, error: dlErr } = await db.storage
      .from("cvs")
      .download(cvPath);

    if (dlErr || !fileData) {
      await db
        .from("candidates")
        .update({
          ai_summary:
            "AI screening gagal: tidak bisa download CV — " +
            (dlErr?.message || "unknown"),
        })
        .eq("id", id);
      revalidatePath("/candidates");
      revalidatePath(`/candidates/${id}`);
      return;
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const fileName = cvPath.split("/").pop() || "cv.pdf";
    let cvText: string;
    try {
      cvText = await extractTextFromFile(buffer, "application/pdf", fileName);
    } catch (err) {
      await db
        .from("candidates")
        .update({ ai_summary: "AI screening gagal: " + formatError(err) })
        .eq("id", id);
      revalidatePath("/candidates");
      revalidatePath(`/candidates/${id}`);
      return;
    }

    await runScreeningInBackground({
      candidateId: id,
      agencyId,
      userId,
      cvText,
      jobTitle,
      jobDescription,
      requirements,
      supabase: db,
    });
  });

  revalidatePath("/candidates");
  revalidatePath(`/candidates/${id}`);
  return { success: true, pendingScreening: true };
}

export async function overrideCandidateScore(formData: FormData) {
  const { supabase, error: authError, profile } = await getCurrentProfile();
  if (authError || !profile) return { error: authError || "Unauthorized" };

  if (profile.role === "client_viewer") {
    return { error: "Client viewer tidak bisa override skor" };
  }

  const id = String(formData.get("candidate_id") || "").trim();
  const scoreRaw = String(formData.get("manual_score") || "").trim();
  const reason = String(formData.get("manual_score_reason") || "").trim();
  const clear = formData.get("clear") === "true";

  if (!id) return { error: "Kandidat wajib" };

  if (clear) {
    const { error } = await supabase
      .from("candidates")
      .update({
        manual_score: null,
        manual_score_reason: null,
        manual_score_updated_at: null,
      })
      .eq("id", id);
    if (error) {
      return {
        error:
          formatError(error) +
          ". Pastikan migration 00009_score_breakdown_override.sql sudah dijalankan.",
      };
    }
    revalidatePath("/candidates");
    revalidatePath(`/candidates/${id}`);
    return { success: true };
  }

  const score = Number(scoreRaw);
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    return { error: "Skor manual harus 0-100" };
  }
  if (reason.length < 5) {
    return { error: "Alasan override minimal 5 karakter" };
  }

  const { error } = await supabase
    .from("candidates")
    .update({
      manual_score: Math.round(score),
      manual_score_reason: reason,
      manual_score_updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return {
      error:
        formatError(error) +
        ". Pastikan migration 00009_score_breakdown_override.sql sudah dijalankan.",
    };
  }

  revalidatePath("/candidates");
  revalidatePath(`/candidates/${id}`);
  revalidatePath("/compare");
  revalidatePath("/dashboard");
  return { success: true };
}
