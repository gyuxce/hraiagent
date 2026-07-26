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

function hasServiceRole(): boolean {
  return Boolean(
    (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim() &&
      (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim()
  );
}

function backgroundAuthToken(): string | null {
  const token = (
    process.env.CRON_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ""
  ).trim();
  return token || null;
}

function appBaseUrl(): string {
  const explicit = (process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/$/, "");
  if (explicit) return explicit;
  const vercel = (process.env.VERCEL_URL || "").trim().replace(/\/$/, "");
  if (vercel) return vercel.startsWith("http") ? vercel : `https://${vercel}`;
  return "http://localhost:3000";
}

/** Prefer service-role client — cookie session often dies inside after(). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function dbForBackground(fallback?: any) {
  if (hasServiceRole()) {
    return createAdminClient();
  }
  return fallback ?? (await createClient());
}

async function markScreeningFailure(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  candidateId: string,
  message: string
) {
  const { error } = await db
    .from("candidates")
    .update({ ai_summary: message })
    .eq("id", candidateId);
  if (error) {
    console.error("[screen] failed to write error summary", candidateId, error);
  }
  revalidatePath("/candidates");
  revalidatePath(`/candidates/${candidateId}`);
}

/**
 * Hit internal route (fresh maxDuration + admin client).
 * Falls back to inline screening if fetch fails.
 */
async function triggerBackgroundScreen(params: {
  candidateId: string;
  userId: string;
  inline: () => Promise<void>;
}) {
  const token = backgroundAuthToken();
  if (token && hasServiceRole()) {
    try {
      const res = await fetch(`${appBaseUrl()}/api/internal/screen-candidate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          candidateId: params.candidateId,
          userId: params.userId,
        }),
        cache: "no-store",
      });
      if (res.ok) return;
      const body = await res.text().catch(() => "");
      console.error(
        "[screen] internal route failed",
        res.status,
        body.slice(0, 500)
      );
      // Route already tried to persist errors; only fall back if it never ran AI.
      if (res.status === 401 || res.status >= 500) {
        await params.inline();
      }
      return;
    } catch (err) {
      console.error("[screen] internal fetch error", formatError(err));
    }
  }
  await params.inline();
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
  supabase?: any;
}) {
  const db = await dbForBackground(params.supabase);

  if (!hasServiceRole() && !params.supabase) {
    await markScreeningFailure(
      db,
      params.candidateId,
      "AI screening gagal: SUPABASE_SERVICE_ROLE_KEY belum di-set di Vercel — skor tidak bisa disimpan di background."
    );
    return;
  }

  const quota = await consumeAiQuota(db, {
    agencyId: params.agencyId,
    eventType: "cv_screen",
    userId: params.userId,
    resourceType: "candidate",
    resourceId: params.candidateId,
  });

  if (!quota.ok && !quota.soft) {
    await markScreeningFailure(
      db,
      params.candidateId,
      quotaExceededMessage(quota)
    );
    return;
  }

  try {
    const result = await screenCandidateWithAI({
      cvText: params.cvText,
      jobTitle: params.jobTitle,
      jobDescription: params.jobDescription,
      requirements: params.requirements,
    });

    const { error: upErr } = await db
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

    if (upErr) {
      await markScreeningFailure(
        db,
        params.candidateId,
        "AI screening gagal simpan skor: " +
          upErr.message +
          (hasServiceRole()
            ? ""
            : " (set SUPABASE_SERVICE_ROLE_KEY di Vercel lalu Redeploy)")
      );
      return;
    }

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
    await markScreeningFailure(
      db,
      params.candidateId,
      "AI screening gagal: " + formatError(err)
    );
    return;
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
  // Background path needs service role — otherwise cookie session dies in after().
  const useBackground = pendingAi && hasServiceRole();

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
      ai_summary: useBackground
        ? PENDING_SUMMARY
        : pendingAi
          ? "AI screening sedang diproses…"
          : null,
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
    const screenParams = {
      candidateId,
      agencyId: profile.agency_id,
      userId: profile.id,
      cvText,
      jobTitle: job.title as string,
      jobDescription: (job.description || "") as string,
      requirements,
      supabase,
    };

    if (useBackground) {
      after(async () => {
        await triggerBackgroundScreen({
          candidateId,
          userId: profile.id,
          inline: () => runScreeningInBackground(screenParams),
        });
      });
    } else {
      // No service role → run inline while request still has auth (slower, but skor muncul).
      await runScreeningInBackground(screenParams);
    }
  }

  revalidatePath("/candidates");
  return {
    success: true,
    candidateId,
    pendingScreening: useBackground,
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

  const useBackground = hasServiceRole();
  const cvPath = candidate.cv_file_path as string;
  const agencyId = profile.agency_id;
  const userId = profile.id;
  const jobTitle = job.title;
  const jobDescription = job.description || "";
  const requirements = Array.isArray(job.requirements) ? job.requirements : [];

  await supabase
    .from("candidates")
    .update({
      ai_summary: useBackground
        ? PENDING_SUMMARY
        : "AI screening sedang diproses…",
      ai_score: null,
      ai_score_breakdown: null,
      status: "submitted",
    })
    .eq("id", id);

  const runInlineFromCv = async () => {
    const db = await dbForBackground(supabase);
    const { data: fileData, error: dlErr } = await db.storage
      .from("cvs")
      .download(cvPath);

    if (dlErr || !fileData) {
      await markScreeningFailure(
        db,
        id,
        "AI screening gagal: tidak bisa download CV — " +
          (dlErr?.message || "unknown")
      );
      return;
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const fileName = cvPath.split("/").pop() || "cv.pdf";
    let cvText: string;
    try {
      cvText = await extractTextFromFile(buffer, "application/pdf", fileName);
    } catch (err) {
      await markScreeningFailure(
        db,
        id,
        "AI screening gagal: " + formatError(err)
      );
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
  };

  if (useBackground) {
    after(async () => {
      await triggerBackgroundScreen({
        candidateId: id,
        userId,
        inline: runInlineFromCv,
      });
    });
  } else {
    await runInlineFromCv();
  }

  revalidatePath("/candidates");
  revalidatePath(`/candidates/${id}`);
  return { success: true, pendingScreening: useBackground };
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
