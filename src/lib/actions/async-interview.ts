"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  analyzeInterviewAnswer,
  averageInterviewScore,
  compareInterviewFaces,
  generateInterviewQuestions,
  rankInterviewSession,
} from "@/lib/ai/openrouter";
import {
  consumeAiQuota,
  consumeAiQuotaForAsyncToken,
  quotaExceededMessage,
} from "@/lib/ai/usage";
import { requireAgencyContext } from "@/lib/auth/agency-context";
import {
  buildIdentitySummary,
  generateChallengeCode,
  isUsableTranscript,
  pickChallengeQuestionIndex,
  transcriptMentionsChallengeCode,
  type FaceMatchStatus,
} from "@/lib/interview/identity";

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

  const challengeCode = generateChallengeCode();

  const { data: session, error: sErr } = await supabase
    .from("async_interview_sessions")
    .insert({
      agency_id: profile.agency_id,
      candidate_id: candidateId,
      job_id: candidate.job_id,
      status: "sent",
      expires_at: expiresAt.toISOString(),
      challenge_code: challengeCode,
      face_match_status: "pending",
      needs_manual_review: false,
    })
    .select("id, invite_token")
    .single();

  if (sErr || !session) {
    return {
      error:
        formatError(sErr) +
        " — Pastikan sudah run 00006 + 00011_interview_identity_guards.sql di Supabase.",
    };
  }

  const rows = questions.map((q, i) => ({
    session_id: session.id,
    agency_id: profile.agency_id,
    question_text: q.question_text,
    focus_area: q.focus_area,
    sort_order: i + 1,
  }));

  const { data: insertedQuestions, error: qErr } = await supabase
    .from("async_interview_questions")
    .insert(rows)
    .select("id, sort_order");

  if (qErr || !insertedQuestions?.length) {
    await supabase.from("async_interview_sessions").delete().eq("id", session.id);
    return { error: formatError(qErr) || "Gagal simpan pertanyaan" };
  }

  const sorted = [...insertedQuestions].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );
  const challengeIdx = pickChallengeQuestionIndex(sorted.length);
  const challengeQuestionId = sorted[challengeIdx]?.id;
  if (challengeQuestionId) {
    await supabase
      .from("async_interview_sessions")
      .update({ challenge_question_id: challengeQuestionId })
      .eq("id", session.id);
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

type GradeItem = {
  question: string;
  answer: string;
  score: number | null;
  feedback: string | null;
};

async function gradeAnswersFromText(params: {
  jobTitle: string;
  questions: Array<{
    id?: string;
    question_text: string;
    focus_area?: string | null;
    answer?: {
      id?: string;
      text_answer?: string | null;
      transcript?: string | null;
    } | null;
  }>;
  onScored?: (answerId: string, score: number, feedback: string) => Promise<void>;
}): Promise<{
  graded: GradeItem[];
  answerScores: Array<Record<string, unknown>>;
  weakTranscriptCount: number;
}> {
  const graded: GradeItem[] = [];
  const answerScores: Array<Record<string, unknown>> = [];
  let weakTranscriptCount = 0;

  for (const q of params.questions) {
    const ans = q.answer;
    const text = (ans?.text_answer || ans?.transcript || "").trim();

    if (!isUsableTranscript(text)) {
      weakTranscriptCount += 1;
      const feedback =
        "Transkrip tidak memadai untuk skor AI — review rekaman video secara manual.";
      if (ans?.id) {
        answerScores.push({
          answer_id: ans.id,
          clear_score: true,
          score: null,
          feedback,
        });
      }
      graded.push({
        question: q.question_text,
        answer: text || "(transkrip kosong)",
        score: null,
        feedback,
      });
      continue;
    }

    try {
      const result = await analyzeInterviewAnswer({
        jobTitle: params.jobTitle,
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
        if (params.onScored) {
          await params.onScored(ans.id, result.score, result.feedback);
        }
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

  return { graded, answerScores, weakTranscriptCount };
}

async function storagePathToDataUrl(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  path: string
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("interview-videos")
    .download(path);
  if (error || !data) return null;
  const buffer = Buffer.from(await data.arrayBuffer());
  const lower = path.toLowerCase();
  const mime = lower.endsWith(".png")
    ? "image/png"
    : lower.endsWith(".webp")
      ? "image/webp"
      : "image/jpeg";
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

async function runIdentityChecks(params: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  token?: string;
  sessionId?: string;
  selfiePath: string | null;
  faceFramePath: string | null;
  challengeCode: string | null;
  challengeQuestionId: string | null;
  questions: Array<{
    id?: string;
    answer?: { transcript?: string | null; text_answer?: string | null } | null;
  }>;
  weakTranscriptCount: number;
  totalAnswers: number;
}): Promise<{
  challengePassed: boolean | null;
  faceMatchStatus: FaceMatchStatus;
  faceMatchNote: string;
  needsManualReview: boolean;
  identitySummary: string;
}> {
  let challengePassed: boolean | null = null;
  if (params.challengeCode && params.challengeQuestionId) {
    const challengeQ = params.questions.find(
      (q) => q.id === params.challengeQuestionId
    );
    const t =
      challengeQ?.answer?.transcript ||
      challengeQ?.answer?.text_answer ||
      "";
    challengePassed = transcriptMentionsChallengeCode(t, params.challengeCode);
  }

  let faceMatchStatus: FaceMatchStatus = "manual";
  let faceMatchNote =
    "Bandingkan selfie awal dengan wajah di video secara manual.";

  if (params.selfiePath && params.faceFramePath) {
    const selfieDataUrl = await storagePathToDataUrl(
      params.supabase,
      params.selfiePath
    );
    const frameDataUrl = await storagePathToDataUrl(
      params.supabase,
      params.faceFramePath
    );
    if (selfieDataUrl && frameDataUrl) {
      const cmp = await compareInterviewFaces({
        selfieDataUrl,
        faceFrameDataUrl: frameDataUrl,
      });
      faceMatchStatus = cmp.status;
      faceMatchNote = cmp.note;
    } else {
      faceMatchStatus = "manual";
      faceMatchNote =
        "Tidak bisa membaca selfie/frame dari storage — cek manual.";
    }
  } else if (!params.selfiePath) {
    faceMatchStatus = "skipped";
    faceMatchNote = "Selfie tidak ada.";
  } else {
    faceMatchStatus = "manual";
    faceMatchNote =
      "Frame wajah dari video belum ada — cek selfie vs video manual.";
  }

  const { needsManualReview, summary } = buildIdentitySummary({
    hasSelfie: Boolean(params.selfiePath),
    challengePassed,
    faceMatchStatus,
    weakTranscriptCount: params.weakTranscriptCount,
    totalAnswers: params.totalAnswers,
  });

  if (params.token) {
    await params.supabase.rpc("save_async_interview_identity", {
      p_token: params.token,
      p_challenge_passed: challengePassed,
      p_face_match_status: faceMatchStatus,
      p_face_match_note: faceMatchNote,
      p_needs_manual_review: needsManualReview,
      p_identity_summary: summary,
    });
  } else if (params.sessionId) {
    await params.supabase
      .from("async_interview_sessions")
      .update({
        challenge_passed: challengePassed,
        face_match_status: faceMatchStatus,
        face_match_note: faceMatchNote,
        needs_manual_review: needsManualReview,
        identity_summary: summary,
      })
      .eq("id", params.sessionId);
  }

  return {
    challengePassed,
    faceMatchStatus,
    faceMatchNote,
    needsManualReview,
    identitySummary: summary,
  };
}

export async function analyzeCompletedInterview(sessionId: string) {
  const { supabase, error: authError, profile } = await getProfile();
  if (authError || !profile?.agency_id) {
    return { error: authError || "Akun belum terhubung ke agency" };
  }

  const { data: session, error: sErr } = await supabase
    .from("async_interview_sessions")
    .select(
      "id, status, job_id, agency_id, invite_token, selfie_path, face_frame_path, challenge_code, challenge_question_id, job_requisitions(title)"
    )
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

  const normalized = questions.map((q) => {
    const answers = q.async_interview_answers as unknown;
    const ans = Array.isArray(answers)
      ? answers[0]
      : (answers as {
          id?: string;
          text_answer?: string | null;
          transcript?: string | null;
        } | null);
    return {
      id: q.id as string,
      question_text: q.question_text as string,
      focus_area: q.focus_area as string | null,
      answer: ans || null,
    };
  });

  const { graded, weakTranscriptCount } = await gradeAnswersFromText({
    jobTitle: jobTitle || "Posisi",
    questions: normalized,
    onScored: async (answerId, score, feedback) => {
      await supabase
        .from("async_interview_answers")
        .update({ ai_score: score, ai_feedback: feedback })
        .eq("id", answerId);
    },
  });

  // Persist null scores + feedback for weak transcripts
  for (const q of normalized) {
    const g = graded.find((x) => x.question === q.question_text);
    if (g && g.score == null && q.answer?.id) {
      await supabase
        .from("async_interview_answers")
        .update({ ai_score: null, ai_feedback: g.feedback })
        .eq("id", q.answer.id);
    }
  }

  const identity = await runIdentityChecks({
    supabase,
    sessionId,
    token: session.invite_token as string,
    selfiePath: session.selfie_path as string | null,
    faceFramePath: session.face_frame_path as string | null,
    challengeCode: session.challenge_code as string | null,
    challengeQuestionId: session.challenge_question_id as string | null,
    questions: normalized,
    weakTranscriptCount,
    totalAnswers: normalized.length,
  });

  const scored = graded.filter((g) => g.score != null);
  let overallScore: number | null = null;
  let overallSummary = "";

  if (scored.length === 0) {
    overallScore = null;
    overallSummary =
      "Skor AI ditunda: tidak ada transkrip yang cukup jelas. Putar video + cek identitas. " +
      identity.identitySummary;
  } else {
    // Overall = rata-rata skor per jawaban (bukan angka dari LLM — hindari contoh prompt seperti 78)
    overallScore = averageInterviewScore(scored.map((g) => g.score));
    try {
      const overall = await rankInterviewSession({
        jobTitle: jobTitle || "Posisi",
        answers: graded,
        overallScore: overallScore!,
      });
      overallSummary =
        overall.overall_summary +
        `\n\n[Identitas] ${identity.identitySummary}`;
    } catch (err) {
      overallSummary =
        "Ringkasan AI gagal: " +
        formatError(err) +
        `\n\n[Identitas] ${identity.identitySummary}`;
    }
  }

  await supabase
    .from("async_interview_sessions")
    .update({
      overall_score: overallScore,
      overall_summary: overallSummary,
      status: "completed",
      completed_at: new Date().toISOString(),
      needs_manual_review: identity.needsManualReview,
      identity_summary: identity.identitySummary,
    })
    .eq("id", sessionId);

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

async function loadSessionForUpload(token: string) {
  const supabase = await createClient();
  const { data: sessionData, error: loadErr } = await supabase.rpc(
    "get_async_interview_by_token",
    { p_token: token }
  );

  if (loadErr || !sessionData) {
    return { error: "Interview tidak valid", supabase, session: null };
  }

  const session = (
    sessionData as {
      session?: {
        agency_id?: string;
        id?: string;
        selfie_path?: string | null;
      };
    }
  ).session;

  if (!session?.agency_id || !session?.id) {
    return { error: "Sesi tidak valid", supabase, session: null };
  }

  return { error: null, supabase, session };
}

/**
 * Prepare a storage path for direct browser→Supabase upload.
 * Avoids shipping large video bytes through the Next.js server action (timeouts).
 */
export async function prepareInterviewVideoUpload(
  token: string,
  questionId: string
) {
  const t = String(token || "").trim();
  const qid = String(questionId || "").trim();
  if (!t || !qid) return { error: "Data tidak lengkap" };

  const loaded = await loadSessionForUpload(t);
  if (loaded.error || !loaded.session) return { error: loaded.error || "Invalid" };
  if (!loaded.session.selfie_path) {
    return { error: "Ambil selfie dulu sebelum merekam jawaban." };
  }

  const path = `${loaded.session.agency_id}/${loaded.session.id}/${qid}-${Date.now()}.webm`;
  return {
    success: true,
    path,
    // Soft limit for UX; client also constrains bitrate/duration
    maxBytes: 12 * 1024 * 1024,
  };
}

/** Fallback server upload for small clips / environments where direct upload fails. */
export async function uploadInterviewVideo(formData: FormData) {
  const token = String(formData.get("token") || "").trim();
  const questionId = String(formData.get("question_id") || "").trim();
  const file = formData.get("video") as File | null;

  if (!token || !questionId || !file || file.size === 0) {
    return { error: "Video tidak valid" };
  }

  if (file.size > 12 * 1024 * 1024) {
    return {
      error:
        "Video terlalu besar (maks ~12MB). Rekam lebih pendek (≤90 detik).",
    };
  }

  const loaded = await loadSessionForUpload(token);
  if (loaded.error || !loaded.session) return { error: loaded.error || "Invalid" };
  if (!loaded.session.selfie_path) {
    return { error: "Ambil selfie dulu sebelum merekam jawaban." };
  }

  const { supabase, session } = loaded;
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

export async function uploadInterviewSelfie(formData: FormData) {
  const token = String(formData.get("token") || "").trim();
  const file = formData.get("selfie") as File | null;

  if (!token || !file || file.size === 0) {
    return { error: "Selfie tidak valid" };
  }
  if (file.size > 8 * 1024 * 1024) {
    return { error: "Ukuran selfie maksimal 8MB" };
  }

  const loaded = await loadSessionForUpload(token);
  if (loaded.error || !loaded.session) return { error: loaded.error || "Invalid" };

  const { supabase, session } = loaded;
  const mime = file.type || "image/jpeg";
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  const path = `${session.agency_id}/${session.id}/selfie-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from("interview-videos")
    .upload(path, buffer, { contentType: mime, upsert: true });

  if (upErr) {
    return {
      error:
        "Gagal upload selfie: " +
        upErr.message +
        " — pastikan migration 00011 sudah dijalankan (izin image di bucket).",
    };
  }

  const { error: saveErr } = await supabase.rpc("save_async_interview_selfie", {
    p_token: token,
    p_selfie_path: path,
  });

  if (saveErr) {
    return {
      error:
        formatError(saveErr) +
        " — pastikan migration 00011_interview_identity_guards.sql sudah dijalankan.",
    };
  }

  return { success: true, selfiePath: path };
}

export async function uploadInterviewFaceFrame(formData: FormData) {
  const token = String(formData.get("token") || "").trim();
  const file = formData.get("face_frame") as File | null;

  if (!token || !file || file.size === 0) {
    return { error: "Frame wajah tidak valid" };
  }

  const loaded = await loadSessionForUpload(token);
  if (loaded.error || !loaded.session) return { error: loaded.error || "Invalid" };

  const { supabase, session } = loaded;
  const path = `${session.agency_id}/${session.id}/face-frame-${Date.now()}.jpg`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from("interview-videos")
    .upload(path, buffer, { contentType: "image/jpeg", upsert: true });

  if (upErr) return { error: "Gagal upload frame: " + upErr.message };

  const { error: saveErr } = await supabase.rpc(
    "save_async_interview_face_frame",
    {
      p_token: token,
      p_face_frame_path: path,
    }
  );

  if (saveErr) return { error: formatError(saveErr) };
  return { success: true, faceFramePath: path };
}

/** Signed URLs for recruiter to view selfie / face frame. */
export async function getInterviewIdentityMedia(sessionId: string) {
  const { supabase, error: authError, profile } = await getProfile();
  if (authError || !profile) return { error: authError || "Unauthorized" };

  const { data: session, error } = await supabase
    .from("async_interview_sessions")
    .select(
      "id, agency_id, selfie_path, face_frame_path, challenge_code, challenge_passed, face_match_status, face_match_note, needs_manual_review, identity_summary"
    )
    .eq("id", sessionId)
    .single();

  if (error || !session) return { error: "Sesi tidak ditemukan" };
  if (session.agency_id !== profile.agency_id) {
    return { error: "Tidak punya akses" };
  }

  async function sign(path: string | null) {
    if (!path) return null;
    const { data } = await supabase.storage
      .from("interview-videos")
      .createSignedUrl(path, 60 * 60);
    return data?.signedUrl || null;
  }

  return {
    error: null,
    data: {
      selfieUrl: await sign(session.selfie_path),
      faceFrameUrl: await sign(session.face_frame_path),
      challengeCode: session.challenge_code as string | null,
      challengePassed: session.challenge_passed as boolean | null,
      faceMatchStatus: session.face_match_status as string | null,
      faceMatchNote: session.face_match_note as string | null,
      needsManualReview: Boolean(session.needs_manual_review),
      identitySummary: session.identity_summary as string | null,
    },
  };
}

async function analyzePublicInterviewSession(token: string) {
  const supabase = await createClient();

  const quota = await consumeAiQuotaForAsyncToken(supabase, {
    token,
    eventType: "async_analyze",
  });
  if (!quota.ok && !quota.soft) {
    await supabase.rpc("save_async_interview_analysis", {
      p_token: token,
      p_answer_scores: [],
      p_overall_score: null,
      p_overall_summary:
        "Interview selesai. Analisis AI tertunda (kuota). Recruiter: klik Jalankan Analisis AI.",
      p_allow_null_overall: true,
    });
    return { analyzed: false, analyzeError: quotaExceededMessage(quota) };
  }

  const { data: payload, error: loadErr } = await supabase.rpc(
    "get_async_interview_by_token",
    { p_token: token }
  );

  if (loadErr || !payload) {
    throw new Error(loadErr?.message || "Gagal memuat sesi untuk analisis");
  }

  const data = payload as {
    session?: {
      selfie_path?: string | null;
      face_frame_path?: string | null;
      challenge_code?: string | null;
      challenge_question_id?: string | null;
      candidate_id?: string | null;
    };
    candidate?: { id?: string };
    job?: { title?: string };
    questions?: Array<{
      id?: string;
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
  const questions = (data.questions || []).map((q) => ({
    id: q.id,
    question_text: q.question_text,
    focus_area: q.focus_area,
    answer: q.answer || null,
  }));

  const { graded, answerScores, weakTranscriptCount } =
    await gradeAnswersFromText({
      jobTitle,
      questions,
    });

  const identity = await runIdentityChecks({
    supabase,
    token,
    selfiePath: data.session?.selfie_path || null,
    faceFramePath: data.session?.face_frame_path || null,
    challengeCode: data.session?.challenge_code || null,
    challengeQuestionId: data.session?.challenge_question_id || null,
    questions,
    weakTranscriptCount,
    totalAnswers: questions.length,
  });

  const scored = graded.filter((g) => g.score != null);
  let overallScore: number | null = null;
  let overallSummary = "";

  if (scored.length === 0) {
    overallScore = null;
    overallSummary =
      "Skor AI ditunda: tidak ada transkrip yang cukup jelas. Putar video + cek identitas. " +
      identity.identitySummary;
  } else {
    overallScore = averageInterviewScore(scored.map((g) => g.score));
    try {
      const overall = await rankInterviewSession({
        jobTitle,
        answers: graded,
        overallScore: overallScore!,
      });
      overallSummary = `${overall.overall_summary}\n\n[Identitas] ${identity.identitySummary}`;
    } catch (err) {
      overallSummary =
        "Ringkasan AI gagal: " +
        formatError(err) +
        `\n\n[Identitas] ${identity.identitySummary}`;
    }
  }

  const { error: saveErr } = await supabase.rpc(
    "save_async_interview_analysis",
    {
      p_token: token,
      p_answer_scores: answerScores,
      p_overall_score: overallScore,
      p_overall_summary: overallSummary,
      p_allow_null_overall: overallScore == null,
    }
  );
  if (saveErr) throw new Error(saveErr.message);

  const candidateId =
    data.candidate?.id || data.session?.candidate_id || null;
  if (candidateId) {
    revalidatePath(`/candidates/${candidateId}`);
  }
  revalidatePath("/candidates");
  revalidatePath("/ranking");

  return { analyzed: true, analyzeError: null as string | null };
}

export async function completePublicInterview(token: string) {
  const supabase = await createClient();
  const { data: sessionId, error } = await supabase.rpc(
    "complete_async_interview",
    { p_token: token }
  );

  if (error) return { error: formatError(error) };

  // Immediate placeholder so recruiter refresh already shows a result row.
  await supabase.rpc("save_async_interview_analysis", {
    p_token: token,
    p_answer_scores: [],
    p_overall_score: null,
    p_overall_summary:
      "Interview selesai. Analisis AI sedang diproses di background — refresh halaman atau klik Jalankan Analisis AI jika belum muncul skor.",
    p_allow_null_overall: true,
  });

  // Heavy AI work after response — avoids Vercel timeout killing the finish step.
  after(async () => {
    try {
      await analyzePublicInterviewSession(token);
    } catch (err) {
      const supabaseBg = await createClient();
      await supabaseBg.rpc("save_async_interview_analysis", {
        p_token: token,
        p_answer_scores: [],
        p_overall_score: null,
        p_overall_summary:
          "Interview selesai, tapi analisis AI gagal otomatis: " +
          formatError(err) +
          ". Recruiter: klik Jalankan Analisis AI.",
        p_allow_null_overall: true,
      });
    }
  });

  return {
    success: true,
    sessionId,
    analyzed: false,
    analyzeError: null as string | null,
    pendingAnalysis: true,
  };
}
