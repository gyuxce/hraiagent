"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensureUserHasAgency } from "@/lib/actions/agency";
import { extractTextFromFile } from "@/lib/cv/extract-text";
import { screenCandidateWithAI } from "@/lib/ai/openrouter";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

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

  // Load job for AI scoring
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
  let aiScore: number | null = null;
  let aiSummary: string | null = null;
  let parsedData: Record<string, unknown> | null = null;
  let status: string = "submitted";

  // Upload + extract CV if provided
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
  }

  // AI screening
  if (runAi && cvText) {
    try {
      const requirements = Array.isArray(job.requirements)
        ? (job.requirements as string[])
        : [];

      const result = await screenCandidateWithAI({
        cvText,
        jobTitle: job.title,
        jobDescription: job.description,
        requirements,
      });

      aiScore = result.score;
      aiSummary = result.summary;
      parsedData = result.parsed as unknown as Record<string, unknown>;
      status = "screened";

      // Fill missing fields from AI parse
      if (!name && result.parsed.name) name = result.parsed.name;
      if (!email && result.parsed.email) email = result.parsed.email;
      if (!phone && result.parsed.phone) phone = result.parsed.phone;
    } catch (err) {
      // Don't fail whole create — save without AI
      aiSummary = "AI screening gagal: " + formatError(err);
    }
  }

  if (!name) return { error: "Nama kandidat wajib diisi (atau upload CV agar AI ekstrak nama)" };
  if (!email) return { error: "Email kandidat wajib diisi (atau upload CV agar AI ekstrak email)" };

  const { error } = await supabase.from("candidates").insert({
    job_id: jobId,
    agency_id: profile.agency_id,
    name,
    email,
    phone,
    cv_file_path: cvFilePath,
    parsed_data: parsedData,
    ai_score: aiScore,
    ai_summary: aiSummary,
    status,
  });

  if (error) return { error: formatError(error) };

  revalidatePath("/candidates");
  return { success: true };
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
  return { success: true };
}

export async function deleteCandidate(id: string) {
  const { supabase, error: authError, profile } = await getCurrentProfile();
  if (authError || !profile) return { error: authError || "Unauthorized" };

  if (profile.role !== "admin_agency") {
    return { error: "Hanya admin yang bisa menghapus kandidat" };
  }

  // Get CV path for cleanup
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
  const { supabase, error: authError } = await getCurrentProfile();
  if (authError) return { error: authError };

  const { data: candidate, error: cErr } = await supabase
    .from("candidates")
    .select("*, job_requisitions(title, description, requirements)")
    .eq("id", id)
    .single();

  if (cErr || !candidate) return { error: "Kandidat tidak ditemukan" };
  if (!candidate.cv_file_path) return { error: "Kandidat tidak punya file CV" };

  const { data: fileData, error: dlErr } = await supabase.storage
    .from("cvs")
    .download(candidate.cv_file_path);

  if (dlErr || !fileData) {
    return { error: "Gagal download CV: " + (dlErr?.message || "unknown") };
  }

  const buffer = Buffer.from(await fileData.arrayBuffer());
  const fileName = candidate.cv_file_path.split("/").pop() || "cv.pdf";

  let cvText: string;
  try {
    cvText = await extractTextFromFile(buffer, "application/pdf", fileName);
  } catch (err) {
    return { error: formatError(err) };
  }

  const job = candidate.job_requisitions as {
    title: string;
    description: string;
    requirements: string[];
  } | null;

  if (!job) return { error: "Job terkait tidak ditemukan" };

  try {
    const result = await screenCandidateWithAI({
      cvText,
      jobTitle: job.title,
      jobDescription: job.description,
      requirements: Array.isArray(job.requirements) ? job.requirements : [],
    });

    const { error } = await supabase
      .from("candidates")
      .update({
        ai_score: result.score,
        ai_summary: result.summary,
        parsed_data: result.parsed,
        status: "screened",
      })
      .eq("id", id);

    if (error) return { error: formatError(error) };
  } catch (err) {
    return { error: formatError(err) };
  }

  revalidatePath("/candidates");
  return { success: true };
}
