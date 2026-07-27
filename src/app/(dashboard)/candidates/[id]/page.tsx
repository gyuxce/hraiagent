import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";
import { canWriteAgencyData, isAdminAgency } from "@/lib/auth/roles";
import { InterviewNotesSection } from "@/components/candidates/interview-notes-section";
import { AsyncInterviewSection } from "@/components/candidates/async-interview-section";
import { CandidateDecision } from "@/components/candidates/candidate-decision";
import { ScreeningWhy } from "@/components/candidates/screening-why";
import { ParsedCvEvidence } from "@/components/candidates/parsed-cv-evidence";
import type { ScoreBreakdown } from "@/lib/ai/openrouter";
import { effectiveScore } from "@/lib/candidates/score";
import { decisionLineFromSummary } from "@/lib/candidates/decision-line";
import type { InterviewNote } from "@/types/database";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

function jobTitle(job: unknown): string {
  if (!job) return "—";
  if (Array.isArray(job)) return job[0]?.title || "—";
  return (job as { title?: string }).title || "—";
}

function clientName(job: unknown): string {
  if (!job) return "";
  const j = Array.isArray(job) ? job[0] : job;
  const cc = (j as { client_companies?: { name?: string } | { name?: string }[] })
    ?.client_companies;
  if (!cc) return "";
  if (Array.isArray(cc)) return cc[0]?.name || "";
  return cc.name || "";
}

export default async function CandidateDetailPage({ params }: Props) {
  const { id } = await params;
  // Cached with layout — avoids extra ensureUserHasAgency round-trip
  const { supabase, profile } = await getSessionProfile();

  if (!profile?.agency_id) {
    return (
      <div className="rounded-lg bg-accent-soft p-4 text-sm text-bad">
        Akun belum terhubung ke agency
      </div>
    );
  }

  // One parallel fan-out: candidate + notes + sessions (with nested questions)
  const [{ data: candidate, error }, { data: notes }, sessionsCore] =
    await Promise.all([
      supabase
        .from("candidates")
        .select("*, job_requisitions(id, title, client_companies(name))")
        .eq("id", id)
        .single(),
      supabase
        .from("interview_notes")
        .select("*")
        .eq("candidate_id", id)
        .order("conducted_at", { ascending: false }),
      supabase
        .from("async_interview_sessions")
        .select(
          `id, invite_token, status, conversational, overall_score, overall_summary, created_at, completed_at, expires_at,
           agency_id, candidate_id, challenge_code, challenge_passed, face_match_status, face_match_note,
           needs_manual_review, identity_summary, selfie_path, media_purged_at,
           async_interview_questions(id, question_text, focus_area, sort_order)`
        )
        .eq("candidate_id", id)
        .order("created_at", { ascending: false }),
    ]);

  if (error || !candidate) notFound();

  let asyncSessionsError: string | null = sessionsCore.error?.message || null;
  let sessionRows: Record<string, unknown>[] = (sessionsCore.data || []).map(
    (s) => ({ ...(s as Record<string, unknown>) })
  );

  // Fallback if nested select fails (older schema / RLS) — one extra round-trip max
  if (sessionsCore.error) {
    asyncSessionsError = null;
    const fallback = await supabase
      .from("async_interview_sessions")
      .select(
        `id, invite_token, status, conversational, overall_score, overall_summary, created_at, completed_at, expires_at,
         agency_id, candidate_id, challenge_code, challenge_passed, face_match_status, face_match_note,
         needs_manual_review, identity_summary, selfie_path, media_purged_at`
      )
      .eq("candidate_id", id)
      .order("created_at", { ascending: false });
    sessionRows = (fallback.data || []).map((s) => ({
      ...(s as Record<string, unknown>),
    }));
    if (fallback.error) {
      asyncSessionsError = fallback.error.message;
      sessionRows = [];
    }
  }

  const sessionsForUi = sessionRows.map((row) => {
    const qs = row.async_interview_questions as unknown;
    const questions = Array.isArray(qs) ? qs : qs ? [qs] : [];
    // sort_order may arrive unsorted from nested embed
    questions.sort(
      (a, b) =>
        Number((a as { sort_order?: number }).sort_order || 0) -
        Number((b as { sort_order?: number }).sort_order || 0)
    );
    return {
      id: String(row.id),
      invite_token: String(row.invite_token || ""),
      status: String(row.status || ""),
      conversational: (row.conversational as boolean) ?? false,
      overall_score: (row.overall_score as number | null) ?? null,
      overall_summary: (row.overall_summary as string | null) ?? null,
      created_at: String(row.created_at || ""),
      completed_at: (row.completed_at as string | null) ?? null,
      expires_at: (row.expires_at as string | null) ?? null,
      challenge_code: (row.challenge_code as string | null) ?? null,
      challenge_passed: (row.challenge_passed as boolean | null) ?? null,
      face_match_status: (row.face_match_status as string | null) ?? null,
      face_match_note: (row.face_match_note as string | null) ?? null,
      needs_manual_review: (row.needs_manual_review as boolean | null) ?? null,
      identity_summary: (row.identity_summary as string | null) ?? null,
      selfie_path: (row.selfie_path as string | null) ?? null,
      media_purged_at: (row.media_purged_at as string | null) ?? null,
      questions: questions as {
        id: string;
        question_text: string;
        focus_area: string | null;
        sort_order: number;
      }[],
    };
  });

  const score = effectiveScore(candidate);
  const canWrite = canWriteAgencyData(profile);
  const breakdown = (candidate.ai_score_breakdown ||
    null) as ScoreBreakdown | null;
  const jobLabel = [
    jobTitle(candidate.job_requisitions),
    clientName(candidate.job_requisitions),
  ]
    .filter(Boolean)
    .join(" — ");

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/candidates"
          className="text-sm font-semibold text-accent hover:text-accent-hover"
        >
          ← Kandidat
        </Link>
      </div>

      <CandidateDecision
        candidateId={candidate.id}
        name={candidate.name}
        email={candidate.email}
        phone={candidate.phone}
        jobLabel={jobLabel}
        status={candidate.status}
        score={score}
        isManualScore={candidate.manual_score != null}
        decisionLine={decisionLineFromSummary(candidate.ai_summary)}
        jobId={candidate.job_id}
        canWrite={canWrite}
      />

      <ScreeningWhy
        candidateId={candidate.id}
        aiScore={candidate.ai_score}
        manualScore={candidate.manual_score}
        manualReason={candidate.manual_score_reason}
        summary={candidate.ai_summary}
        breakdown={breakdown}
        canWrite={canWrite}
      />

      <ParsedCvEvidence
        data={
          (candidate.parsed_data as Record<string, unknown> | null) || null
        }
      />

      <AsyncInterviewSection
        candidateId={candidate.id}
        sessions={sessionsForUi}
        canWrite={canWrite}
        loadError={asyncSessionsError}
      />

      <InterviewNotesSection
        candidateId={candidate.id}
        notes={(notes || []) as InterviewNote[]}
        isAdmin={isAdminAgency(profile)}
        canWrite={canWrite}
      />
    </div>
  );
}
