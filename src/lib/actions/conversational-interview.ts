"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { analyzePublicInterviewSession } from "@/lib/actions/async-interview";
import { transcribeAudio } from "@/lib/ai/transcribe";
import { consumeAiQuotaForAsyncToken } from "@/lib/ai/usage";
import { rateLimitError } from "@/lib/security/rate-limit";
import { synthesizeSpeech, ttsCacheKey } from "@/lib/voice/tts";
import { decideInterviewTurn } from "@/lib/voice/dialogue";

/**
 * Conversational interview engine (Slice 2).
 * Kandidat tetap rekam video per jawaban; AI bicara (TTS) dan bisa follow-up.
 * Semua akses publik via invite token; tulis data lewat service role.
 */

const BUCKET = "interview-videos";
const FOLLOWUP_MAX_PER_QUESTION = 2;
const FOLLOWUP_MAX_TOTAL = 4;
const SESSION_MAX_MINUTES = 15;

type SessionRow = {
  id: string;
  agency_id: string;
  candidate_id: string;
  job_id: string;
  status: string;
  conversational: boolean;
  challenge_code: string | null;
  challenge_question_id: string | null;
  started_at: string | null;
  expires_at: string | null;
};

type QuestionRow = {
  id: string;
  question_text: string;
  sort_order: number;
};

type TurnRow = {
  id: string;
  question_id: string | null;
  turn_index: number;
  role: "ai" | "candidate";
  kind: "greeting" | "question" | "follow_up" | "challenge" | "closing" | "answer";
  text: string | null;
  video_path: string | null;
  tts_path: string | null;
};

export type PublicTurn = {
  id: string;
  role: "ai" | "candidate";
  kind: TurnRow["kind"];
  text: string | null;
  ttsUrl: string | null;
  questionId: string | null;
};

type AdminDb = ReturnType<typeof createAdminClient>;

async function loadSession(token: string): Promise<{
  error: string | null;
  session: SessionRow | null;
  questions: QuestionRow[] | null;
  db: AdminDb | null;
}> {
  let db: AdminDb;
  try {
    db = createAdminClient();
  } catch {
    return { error: "Konfigurasi server belum lengkap", session: null, questions: null, db: null };
  }
  const { data: session } = await db
    .from("async_interview_sessions")
    .select(
      "id, agency_id, candidate_id, job_id, status, conversational, challenge_code, challenge_question_id, started_at, expires_at"
    )
    .eq("invite_token", token)
    .maybeSingle();

  if (!session) return { error: "Interview tidak ditemukan", session: null, questions: null, db: null };
  const s = session as SessionRow;
  if (s.status === "completed") return { error: "done", session: s, questions: null, db };
  if (s.status !== "sent" && s.status !== "in_progress") {
    return { error: "Interview tidak aktif", session: null, questions: null, db: null };
  }
  if (s.expires_at && new Date(s.expires_at).getTime() < Date.now()) {
    return { error: "Link interview sudah kadaluarsa", session: null, questions: null, db: null };
  }
  if (!s.conversational) {
    return { error: "Sesi ini bukan interview conversational", session: null, questions: null, db: null };
  }

  const { data: questions } = await db
    .from("async_interview_questions")
    .select("id, question_text, sort_order")
    .eq("session_id", s.id)
    .order("sort_order", { ascending: true });

  if (!questions?.length) {
    return { error: "Pertanyaan belum tersedia", session: null, questions: null, db: null };
  }
  return { error: null, session: s, questions: questions as QuestionRow[], db };
}

async function listTurns(db: NonNullable<Awaited<ReturnType<typeof loadSession>>["db"]>, sessionId: string) {
  const { data } = await db
    .from("async_interview_turns")
    .select("id, question_id, turn_index, role, kind, text, video_path, tts_path")
    .eq("session_id", sessionId)
    .order("turn_index", { ascending: true });
  return (data || []) as TurnRow[];
}

async function signTts(db: AdminDb, path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await db.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  return data?.signedUrl || null;
}

async function toPublicTurn(db: Parameters<typeof signTts>[0], t: TurnRow): Promise<PublicTurn> {
  return {
    id: t.id,
    role: t.role,
    kind: t.kind,
    text: t.text,
    ttsUrl: await signTts(db, t.tts_path),
    questionId: t.question_id,
  };
}

/** TTS + simpan ke storage dengan cache konten. Return path atau null (fail soft). */
async function ensureTtsAudio(db: AdminDb, text: string): Promise<string | null> {
  const path = `tts-cache/${ttsCacheKey(text)}.mp3`;
  const { data: existing } = await db.storage.from(BUCKET).createSignedUrl(path, 60);
  if (existing?.signedUrl) {
    const head = await fetch(existing.signedUrl, { method: "HEAD" }).catch(() => null);
    if (head?.ok) return path;
  }

  const result = await synthesizeSpeech(text);
  if (!result.audio) return null;

  const { error } = await db.storage.from(BUCKET).upload(path, result.audio, {
    contentType: result.contentType,
    upsert: true,
  });
  if (error) return null;
  return path;
}

async function insertTurn(
  db: AdminDb,
  params: {
    sessionId: string;
    agencyId: string;
    questionId: string | null;
    role: "ai" | "candidate";
    kind: TurnRow["kind"];
    text: string | null;
    videoPath?: string | null;
    ttsPath?: string | null;
    decision?: string | null;
    turnIndex: number;
  }
): Promise<TurnRow | null> {
  const { data, error } = await db
    .from("async_interview_turns")
    .insert({
      session_id: params.sessionId,
      question_id: params.questionId,
      agency_id: params.agencyId,
      turn_index: params.turnIndex,
      role: params.role,
      kind: params.kind,
      text: params.text,
      video_path: params.videoPath || null,
      tts_path: params.ttsPath || null,
      decision: params.decision || null,
    })
    .select("id, question_id, turn_index, role, kind, text, video_path, tts_path")
    .single();
  if (error) return null;
  return data as TurnRow;
}

function greetingText(candidateName: string, jobTitle: string, total: number): string {
  return `Halo ${candidateName}, terima kasih sudah meluangkan waktu. Saya asisten rekrutmen untuk posisi ${jobTitle}. Ada ${total} pertanyaan, jawab saja dengan santai seperti ngobrol. Kalau sudah siap, kita mulai dengan pertanyaan pertama.`;
}

const CLOSING_TEXT =
  "Terima kasih, semua jawaban Anda sudah terekam dengan baik. Tim rekrutmen akan meninjau hasilnya. Sampai jumpa!";

/** Deteksi mode sesi untuk routing UI (tanpa side effect). */
export async function getInterviewMode(token: string) {
  const t = String(token || "").trim();
  if (!t) return { conversational: false };
  let db: AdminDb;
  try {
    db = createAdminClient();
  } catch {
    return { conversational: false };
  }
  const { data } = await db
    .from("async_interview_sessions")
    .select("conversational")
    .eq("invite_token", t)
    .maybeSingle();
  return { conversational: data?.conversational === true };
}

/** Prepare path upload klip jawaban (tanpa syarat selfie — flow smooth). */
export async function prepareConversationalVideoUpload(
  token: string,
  questionId: string
) {
  const t = String(token || "").trim();
  const qid = String(questionId || "").trim();
  if (!t || !qid) return { error: "Data tidak lengkap" };

  const blocked = await rateLimitError({
    scope: "interview:conv-prepare",
    identity: t,
    limit: 40,
    windowMs: 10 * 60_000,
  });
  if (blocked) return { error: blocked };

  let db: AdminDb;
  try {
    db = createAdminClient();
  } catch {
    return { error: "Konfigurasi server belum lengkap" };
  }
  const { data: session } = await db
    .from("async_interview_sessions")
    .select("id, agency_id, status, conversational, expires_at")
    .eq("invite_token", t)
    .maybeSingle();

  if (!session?.conversational) return { error: "Sesi tidak valid" };
  if (session.status !== "sent" && session.status !== "in_progress") {
    return { error: "Interview tidak aktif" };
  }
  if (session.expires_at && new Date(session.expires_at).getTime() < Date.now()) {
    return { error: "Link interview sudah kadaluarsa" };
  }

  const path = `${session.agency_id}/${session.id}/${qid}-${Date.now()}.webm`;
  return { success: true, path, maxBytes: 15 * 1024 * 1024 };
}

export async function startConversationalInterview(token: string) {
  const t = String(token || "").trim();
  if (!t) return { error: "Token tidak valid" };

  const blocked = await rateLimitError({
    scope: "interview:conv-start",
    identity: t,
    limit: 12,
    windowMs: 10 * 60_000,
  });
  if (blocked) return { error: blocked };

  const loaded = await loadSession(t);
  if (loaded.error || !loaded.session || !loaded.questions || !loaded.db) {
    if (loaded.error === "done") return { error: null, done: true, turns: [] };
    return { error: loaded.error || "Sesi tidak valid" };
  }
  const { session, questions, db } = loaded;

  let turns = await listTurns(db, session.id);
  let nextIndex = (turns[turns.length - 1]?.turn_index ?? 0) + 1;

  // First visit → greeting + pertanyaan pertama (dengan TTS)
  if (turns.length === 0) {
    const { data: candidate } = await db
      .from("candidates")
      .select("name, job_requisitions(title)")
      .eq("id", session.candidate_id)
      .maybeSingle();
    const jobRaw = (candidate as { job_requisitions?: unknown } | null)?.job_requisitions;
    const jobTitle = Array.isArray(jobRaw)
      ? (jobRaw[0] as { title?: string })?.title
      : (jobRaw as { title?: string } | null)?.title;

    const greeting = greetingText(
      (candidate?.name as string) || "Kandidat",
      jobTitle || "ini",
      questions.length
    );
    const greetingTurn = await insertTurn(db, {
      sessionId: session.id,
      agencyId: session.agency_id,
      questionId: null,
      role: "ai",
      kind: "greeting",
      text: greeting,
      ttsPath: await ensureTtsAudio(db, greeting),
      turnIndex: nextIndex++,
    });

    const first = questions[0];
    const isChallenge = session.challenge_question_id === first.id;
    const firstText = isChallenge
      ? "Sebelum kita mulai, tolong sebutkan kode yang tertera di layar Anda."
      : first.question_text;
    const questionTurn = await insertTurn(db, {
      sessionId: session.id,
      agencyId: session.agency_id,
      questionId: first.id,
      role: "ai",
      kind: isChallenge ? "challenge" : "question",
      text: firstText,
      ttsPath: await ensureTtsAudio(db, firstText),
      turnIndex: nextIndex++,
    });

    await db
      .from("async_interview_sessions")
      .update({ status: "in_progress", started_at: new Date().toISOString() })
      .eq("id", session.id)
      .eq("status", "sent");

    turns = [greetingTurn, questionTurn].filter(Boolean) as TurnRow[];
  }

  const aiTurns = turns.filter((x) => x.role === "ai" && (x.kind === "question" || x.kind === "challenge"));
  const current = aiTurns[aiTurns.length - 1];

  return {
    error: null,
    done: turns.some((x) => x.kind === "closing"),
    turns: await Promise.all(turns.map((x) => toPublicTurn(db, x))),
    currentQuestionId: current?.question_id || null,
    progress: { current: aiTurns.length, total: questions.length },
    challengeQuestionId: session.challenge_question_id,
  };
}

export async function submitConversationalTurn(formData: FormData) {
  const token = String(formData.get("token") || "").trim();
  const questionId = String(formData.get("question_id") || "").trim();
  const videoPath = String(formData.get("video_path") || "").trim();

  if (!token || !questionId || !videoPath) {
    return { error: "Data tidak lengkap" };
  }

  const blocked = await rateLimitError({
    scope: "interview:conv-turn",
    identity: token,
    limit: 40,
    windowMs: 10 * 60_000,
  });
  if (blocked) return { error: blocked };

  const loaded = await loadSession(token);
  if (loaded.error || !loaded.session || !loaded.questions || !loaded.db) {
    return { error: loaded.error === "done" ? "Interview sudah selesai" : loaded.error || "Sesi tidak valid" };
  }
  const { session, questions, db } = loaded;

  const question = questions.find((q) => q.id === questionId);
  if (!question) return { error: "Pertanyaan tidak valid" };

  // Guard durasi sesi
  if (session.started_at) {
    const elapsedMin = (Date.now() - new Date(session.started_at).getTime()) / 60000;
    if (elapsedMin > SESSION_MAX_MINUTES) {
      return { error: `Sesi melebihi batas ${SESSION_MAX_MINUTES} menit. Hubungi tim rekrutmen.` };
    }
  }

  // Quota AI untuk turn ini
  const supabase = await createClient();
  const quota = await consumeAiQuotaForAsyncToken(supabase, {
    token,
    eventType: "interview_turn",
  });
  if (!quota.ok && !quota.soft) {
    return { error: "Kuota AI agency habis. Hubungi tim rekrutmen." };
  }

  const turns = await listTurns(db, session.id);
  let nextIndex = (turns[turns.length - 1]?.turn_index ?? 0) + 1;

  // 1. STT jawaban kandidat (server-side, wajib untuk decision making)
  let transcript = "";
  const { data: file } = await db.storage.from(BUCKET).download(videoPath);
  if (file) {
    const stt = await transcribeAudio(file, `turn-${questionId}.webm`);
    transcript = (stt.text || "").trim();
  }

  const candidateTurn = await insertTurn(db, {
    sessionId: session.id,
    agencyId: session.agency_id,
    questionId,
    role: "candidate",
    kind: "answer",
    text: transcript || null,
    videoPath,
    turnIndex: nextIndex++,
  });

  // 2. LLM putuskan follow-up atau lanjut
  const followUpsForQuestion = turns.filter(
    (x) => x.role === "ai" && x.kind === "follow_up" && x.question_id === questionId
  ).length;
  const followUpsTotal = turns.filter((x) => x.role === "ai" && x.kind === "follow_up").length;

  const { data: jobRow } = await db
    .from("job_requisitions")
    .select("title, requirements")
    .eq("id", session.job_id)
    .maybeSingle();

  const isChallenge = session.challenge_question_id === questionId;
  const decision = isChallenge
    ? { action: "next" as const, followUpQuestion: null, rationale: "challenge" }
    : await decideInterviewTurn({
        jobTitle: (jobRow?.title as string) || "Posisi",
        requirements: Array.isArray(jobRow?.requirements) ? (jobRow.requirements as string[]) : [],
        questionText: question.question_text,
        answerTranscript: transcript,
        followUpsUsedForQuestion: followUpsForQuestion,
        followUpsMaxPerQuestion: FOLLOWUP_MAX_PER_QUESTION,
        followUpsUsedTotal: followUpsTotal,
        followUpsMaxTotal: FOLLOWUP_MAX_TOTAL,
      });

  // 3a. Follow-up
  if (decision.action === "follow_up" && decision.followUpQuestion) {
    const turn = await insertTurn(db, {
      sessionId: session.id,
      agencyId: session.agency_id,
      questionId,
      role: "ai",
      kind: "follow_up",
      text: decision.followUpQuestion,
      ttsPath: await ensureTtsAudio(db, decision.followUpQuestion),
      decision: "follow_up",
      turnIndex: nextIndex++,
    });
    return {
      success: true,
      done: false,
      candidateTurnId: candidateTurn?.id || null,
      turn: turn ? await toPublicTurn(db, turn) : null,
      progress: null,
    };
  }

  // 3b. Pertanyaan berikutnya
  const currentIdx = questions.findIndex((q) => q.id === questionId);
  const nextQuestion = questions[currentIdx + 1] as QuestionRow | undefined;

  if (nextQuestion) {
    const nextIsChallenge = session.challenge_question_id === nextQuestion.id;
    const text = nextIsChallenge
      ? "Terima kasih. Sebelum lanjut, tolong sebutkan kode yang tertera di layar Anda."
      : nextQuestion.question_text;
    const turn = await insertTurn(db, {
      sessionId: session.id,
      agencyId: session.agency_id,
      questionId: nextQuestion.id,
      role: "ai",
      kind: nextIsChallenge ? "challenge" : "question",
      text,
      ttsPath: await ensureTtsAudio(db, text),
      decision: "next",
      turnIndex: nextIndex++,
    });
    const askedCount = turns.filter(
      (x) => x.role === "ai" && (x.kind === "question" || x.kind === "challenge")
    ).length + 1;
    return {
      success: true,
      done: false,
      candidateTurnId: candidateTurn?.id || null,
      turn: turn ? await toPublicTurn(db, turn) : null,
      progress: { current: askedCount, total: questions.length },
    };
  }

  // 3c. Selesai → closing + finalize skor
  const closing = await insertTurn(db, {
    sessionId: session.id,
    agencyId: session.agency_id,
    questionId: null,
    role: "ai",
    kind: "closing",
    text: CLOSING_TEXT,
    ttsPath: await ensureTtsAudio(db, CLOSING_TEXT),
    decision: "end",
    turnIndex: nextIndex++,
  });

  // Susun answers per pertanyaan dari turns (concat transkrip + klip pertama)
  const allTurns = [...turns, candidateTurn].filter(Boolean) as TurnRow[];
  for (const q of questions) {
    const answers = allTurns.filter(
      (x) => x.role === "candidate" && x.kind === "answer" && x.question_id === q.id
    );
    if (answers.length === 0) continue;
    const combined = answers
      .map((a) => (a.text || "").trim())
      .filter(Boolean)
      .join("\n\n");
    await db.from("async_interview_answers").upsert(
      {
        session_id: session.id,
        question_id: q.id,
        agency_id: session.agency_id,
        transcript: combined || "(jawaban video)",
        video_path: answers[0].video_path,
      },
      { onConflict: "question_id" }
    );
  }

  await analyzePublicInterviewSession(token);

  return {
    success: true,
    done: true,
    candidateTurnId: candidateTurn?.id || null,
    turn: closing ? await toPublicTurn(db, closing) : null,
    progress: { current: questions.length, total: questions.length },
  };
}
