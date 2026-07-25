"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  analyzeInterviewAnswer,
  generateInterviewQuestions,
  rankInterviewSession,
} from "@/lib/ai/openrouter";
import {
  consumeAiQuota,
  consumeAiQuotaForAsyncToken,
  quotaExceededMessage,
} from "@/lib/ai/usage";
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

async function getProfile() {
  return requireAgencyContext();
}

export async function createAsyncInterview(candidateId: string) {
  const { supabase, error: authError, profile } = await getProfile();
  if (authError || !profile) return { error: authError || "Unauthorized" };

  const { data: candidate, error: cErr } = await supabase
    .from("candidates")
    .select(
      "id, name, job_id, agency_id, job_requisitions(title, description, requirements)"
    )
    .eq("id", candidateId)
    .single();

  if (cErr || !candidate) return { error: "Kandidat tidak ditemukan" };

  const jobRaw = candidate.job_requisitions as unknown;
  const job = Array.isArray(jobRaw)
    ? (jobRaw[0] as {
        title?: string;
        description?: string;
        requirements?: string[];
      })
    : (jobRaw as {
        title?: string;
        description?: string;
        requirements?: string[];
      } | null);

  if (!candidate.job_id || !job) return { error: "Job kandidat tidak ditemukan" };

  const quota = await consumeAiQuota(supabase, {
    agencyId: profile.agency_id,
    eventType: "async_question_gen",
    userId: profile.id,
    resourceType: "candidate",
    resourceId: candidateId,
  });
  if (!quota.ok && !quota.soft) {
    return { error: quotaExceededMessage(quota) };
  }

  let questions: { question_text: string; focus_area: string }[] = [];
  try {
    questions = await generateInterviewQuestions({
      jobTitle: job.title || "Posisi",
      jobDescription: job.description || "",
      requirements: Array.isArray(job.requirements) ? job.requirements : [],
      candidateName: candidate.name,
      count: 5,
    });
  } catch (err) {
    return { error: "Gagal generate pertanyaan AI: " + formatError(err) };
  }

  if (questions.length === 0) {
    return { error: "AI tidak menghasilkan pertanyaan. Coba lagi." };
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const { data: session, error: sErr } = await supabase
    .from("async_interview_sessions")
    .insert({
      agency_id: profile.agency_id,
      candidate_id: candidateId,
      job_id: candidate.job_id,
      status: "sent",
      expires_at: expiresAt.toISOString(),
    })
    .select("id, invite_token")
    .single();

  if (sErr || !session) {
    return {
      error:
        formatError(sErr) +
        " — Pastikan sudah run 00006_async_interview.sql di Supabase.",
    };
  }

  const rows = questions.map((q, i) => ({
    session_id: session.id,
    agency_id: profile.agency_id,
    question_text: q.question_text,
    focus_area: q.focus_area,
    sort_order: i + 1,
  }));

  const { error: qErr } = await supabase
    .from("async_interview_questions")
    .insert(rows);

  if (qErr) {
    await supabase.from("async_interview_sessions").delete().eq("id", session.id);
    return { error: formatError(qErr) };
  }

  await supabase
    .from("candidates")
    .update({ status: "interview" })
    .eq("id", candidateId)
    .in("status", ["submitted", "screened"]);

  const base =
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const inviteUrl = `${base.replace(/\/$/, "")}/interview/${session.invite_token}`;

  revalidatePath(`/candidates/${candidateId}`);
  revalidatePath("/candidates");
  revalidatePath("/ranking");

  return {
    success: true,
    sessionId: session.id,
    inviteToken: session.invite_token as string,
    inviteUrl,
  };
}

export async function analyzeCompletedInterview(sessionId: string) {
  const { supabase, error: authError, profile } = await getProfile();
  if (authError || !profile?.agency_id) {
    return { error: authError || "Akun belum terhubung ke agency" };
  }

  const { data: session, error: sErr } = await supabase
    .from("async_interview_sessions")
    .select("id, status, job_id, agency_id, job_requisitions(title)")
    .eq("id", sessionId)
    .single();

  if (sErr || !session) return { error: "Sesi tidak ditemukan" };

  const quota = await consumeAiQuota(supabase, {
    agencyId: session.agency_id || profile.agency_id,
    eventType: "async_analyze",
    userId: profile.id,
    resourceType: "async_interview_session",
    resourceId: sessionId,
  });
  if (!quota.ok && !quota.soft) {
    return { error: quotaExceededMessage(quota) };
  }

  const { data: questions } = await supabase
    .from("async_interview_questions")
    .select("id, question_text, focus_area, async_interview_answers(*)")
    .eq("session_id", sessionId)
    .order("sort_order", { ascending: true });

  if (!questions?.length) return { error: "Tidak ada pertanyaan" };

  const jobTitleRaw = session.job_requisitions as unknown;
  const jobTitle = Array.isArray(jobTitleRaw)
    ? jobTitleRaw[0]?.title
    : (jobTitleRaw as { title?: string } | null)?.title;

  const graded: {
    question: string;
    answer: string;
    score: number | null;
    feedback: string | null;
  }[] = [];

  for (const q of questions) {
    const answers = q.async_interview_answers as unknown;
    const ans = Array.isArray(answers)
      ? answers[0]
      : (answers as {
          id?: string;
          text_answer?: string | null;
          transcript?: string | null;
        } | null);

    const text =
      (ans?.text_answer || ans?.transcript || "").trim() ||
      "(tidak ada transkrip — jawaban video tanpa teks otomatis)";

    try {
      const result = await analyzeInterviewAnswer({
        jobTitle: jobTitle || "Posisi",
        question: q.question_text,
        focusArea: q.focus_area,
        answerText: text,
      });

      if (ans?.id) {
        await supabase
          .from("async_interview_answers")
          .update({
            ai_score: result.score,
            ai_feedback: result.feedback,
          })
          .eq("id", ans.id);
      }

      graded.push({
        question: q.question_text,
        answer: text,
        score: result.score,
        feedback: result.feedback,
      });
    } catch (err) {
      graded.push({
        question: q.question_text,
        answer: text,
        score: null,
        feedback: "Analisis gagal: " + formatError(err),
      });
    }
  }

  try {
    const overall = await rankInterviewSession({
      jobTitle: jobTitle || "Posisi",
      answers: graded,
    });

    await supabase
      .from("async_interview_sessions")
      .update({
        overall_score: overall.overall_score,
        overall_summary: overall.overall_summary,
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", sessionId);
  } catch (err) {
    const avg =
      graded.filter((g) => g.score != null).length > 0
        ? Math.round(
            graded
              .filter((g) => g.score != null)
              .reduce((s, g) => s + (g.score || 0), 0) /
              graded.filter((g) => g.score != null).length
          )
        : 0;

    await supabase
      .from("async_interview_sessions")
      .update({
        overall_score: avg,
        overall_summary: "Ringkasan AI gagal: " + formatError(err),
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", sessionId);
  }

  revalidatePath("/candidates");
  revalidatePath("/ranking");
  return { success: true };
}

// --- Public (token) actions ---

export async function getPublicInterview(token: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_async_interview_by_token", {
    p_token: token,
  });

  if (error) return { error: formatError(error), data: null };
  if (!data) return { error: "Interview tidak ditemukan / kadaluarsa", data: null };
  return { error: null, data };
}

export async function submitPublicAnswer(formData: FormData) {
  const supabase = await createClient();
  const token = String(formData.get("token") || "").trim();
  const questionId = String(formData.get("question_id") || "").trim();
  const textAnswer = String(formData.get("text_answer") || "").trim();
  const transcript = String(formData.get("transcript") || "").trim();
  const videoPath = String(formData.get("video_path") || "").trim() || null;

  if (!token || !questionId) return { error: "Data tidak lengkap" };
  if (!videoPath) {
    return { error: "Rekaman video wajib. Jawaban teks tidak diterima." };
  }

  const { error } = await supabase.rpc("submit_async_interview_answer", {
    p_token: token,
    p_question_id: questionId,
    p_text_answer: textAnswer || null,
    p_transcript: transcript || textAnswer || null,
    p_video_path: videoPath,
  });

  if (error) return { error: formatError(error) };
  return { success: true };
}

export async function uploadInterviewVideo(formData: FormData) {
  const supabase = await createClient();
  const token = String(formData.get("token") || "").trim();
  const questionId = String(formData.get("question_id") || "").trim();
  const file = formData.get("video") as File | null;

  if (!token || !questionId || !file || file.size === 0) {
    return { error: "Video tidak valid" };
  }

  if (file.size > 50 * 1024 * 1024) {
    return { error: "Ukuran video maksimal 50MB" };
  }

  const { data: sessionData, error: loadErr } = await supabase.rpc(
    "get_async_interview_by_token",
    { p_token: token }
  );

  if (loadErr || !sessionData) {
    return { error: "Interview tidak valid" };
  }

  const session = (sessionData as { session?: { agency_id?: string; id?: string } })
    .session;
  if (!session?.agency_id || !session?.id) {
    return { error: "Sesi tidak valid" };
  }

  const ext = file.type.includes("mp4") ? "mp4" : "webm";
  const path = `${session.agency_id}/${session.id}/${questionId}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from("interview-videos")
    .upload(path, buffer, {
      contentType: file.type || "video/webm",
      upsert: true,
    });

  if (upErr) {
    return {
      error:
        "Gagal upload video: " +
        upErr.message +
        ". Pastikan bucket interview-videos sudah dibuat.",
    };
  }

  return { success: true, videoPath: path };
}

export async function completePublicInterview(token: string) {
  const supabase = await createClient();
  const { data: sessionId, error } = await supabase.rpc(
    "complete_async_interview",
    { p_token: token }
  );

  if (error) return { error: formatError(error) };

  // Auto-analyze after candidate submits (no recruiter login needed).
  let analyzed = false;
  let analyzeError: string | null = null;

  try {
    const quota = await consumeAiQuotaForAsyncToken(supabase, {
      token,
      eventType: "async_analyze",
    });
    if (!quota.ok && !quota.soft) {
      return {
        success: true,
        analyzed: false,
        analyzeError: quotaExceededMessage(quota),
      };
    }

    const { data: payload, error: loadErr } = await supabase.rpc(
      "get_async_interview_by_token",
      { p_token: token }
    );

    if (loadErr || !payload) {
      throw new Error(loadErr?.message || "Gagal memuat sesi untuk analisis");
    }

    const data = payload as {
      job?: { title?: string };
      questions?: Array<{
        question_text: string;
        focus_area?: string | null;
        answer?: {
          id?: string;
          text_answer?: string | null;
          transcript?: string | null;
        } | null;
      }>;
    };

    const jobTitle = data.job?.title || "Posisi";
    const questions = data.questions || [];
    const answerScores: Array<{
      answer_id: string;
      score: number;
      feedback: string;
    }> = [];
    const graded: {
      question: string;
      answer: string;
      score: number | null;
      feedback: string | null;
    }[] = [];

    for (const q of questions) {
      const ans = q.answer;
      const text =
        (ans?.text_answer || ans?.transcript || "").trim() ||
        "(tidak ada jawaban teks)";

      try {
        const result = await analyzeInterviewAnswer({
          jobTitle,
          question: q.question_text,
          focusArea: q.focus_area || null,
          answerText: text,
        });

        if (ans?.id) {
          answerScores.push({
            answer_id: ans.id,
            score: result.score,
            feedback: result.feedback,
          });
        }

        graded.push({
          question: q.question_text,
          answer: text,
          score: result.score,
          feedback: result.feedback,
        });
      } catch (err) {
        graded.push({
          question: q.question_text,
          answer: text,
          score: null,
          feedback: "Analisis gagal: " + formatError(err),
        });
      }
    }

    let overallScore = 0;
    let overallSummary = "";
    try {
      const overall = await rankInterviewSession({
        jobTitle,
        answers: graded,
      });
      overallScore = overall.overall_score;
      overallSummary = overall.overall_summary;
    } catch (err) {
      const scored = graded.filter((g) => g.score != null);
      overallScore =
        scored.length > 0
          ? Math.round(
              scored.reduce((s, g) => s + (g.score || 0), 0) / scored.length
            )
          : 0;
      overallSummary = "Ringkasan AI gagal: " + formatError(err);
    }

    const { error: saveErr } = await supabase.rpc(
      "save_async_interview_analysis",
      {
        p_token: token,
        p_answer_scores: answerScores,
        p_overall_score: overallScore,
        p_overall_summary: overallSummary,
      }
    );

    if (saveErr) {
      throw new Error(saveErr.message);
    }

    analyzed = true;
  } catch (err) {
    analyzeError = formatError(err);
  }

  return { success: true, sessionId, analyzed, analyzeError };
}
