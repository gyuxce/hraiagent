import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureUserHasAgency } from "@/lib/actions/agency";
import { canWriteAgencyData, isAdminAgency } from "@/lib/auth/roles";
import { InterviewNotesSection } from "@/components/candidates/interview-notes-section";
import { AsyncInterviewSection } from "@/components/candidates/async-interview-section";
import { ScorePanel } from "@/components/candidates/score-panel";
import type { ScoreBreakdown } from "@/lib/ai/openrouter";
import { effectiveScore } from "@/lib/candidates/score";
import type { InterviewNote } from "@/types/database";

type Props = {
  params: Promise<{ id: string }>;
};

function ParsedCvView({ data }: { data: Record<string, unknown> }) {
  const skills = Array.isArray(data.skills)
    ? data.skills.filter((s): s is string => typeof s === "string")
    : [];
  const experience = Array.isArray(data.experience)
    ? data.experience.filter((s): s is string => typeof s === "string")
    : [];
  const education = Array.isArray(data.education)
    ? data.education.filter((s): s is string => typeof s === "string")
    : [];

  return (
    <div className="space-y-4 text-sm">
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase text-gray-400">Nama</p>
          <p className="text-gray-900">{String(data.name || "—")}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-gray-400">Email</p>
          <p className="text-gray-900">{String(data.email || "—")}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-gray-400">Telepon</p>
          <p className="text-gray-900">{String(data.phone || "—")}</p>
        </div>
      </div>
      {typeof data.summary === "string" && data.summary && (
        <div>
          <p className="text-xs font-semibold uppercase text-gray-400">Ringkasan</p>
          <p className="mt-1 text-gray-700">{data.summary}</p>
        </div>
      )}
      {skills.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-gray-400">Skills</p>
          <div className="flex flex-wrap gap-1.5">
            {skills.map((s) => (
              <span
                key={s}
                className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
      {experience.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-gray-400">
            Pengalaman
          </p>
          <ul className="list-disc space-y-1 pl-5 text-gray-700">
            {experience.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {education.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-gray-400">
            Pendidikan
          </p>
          <ul className="list-disc space-y-1 pl-5 text-gray-700">
            {education.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

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
  const supabase = await createClient();
  const ensured = await ensureUserHasAgency();

  if (ensured.error && !ensured.profile?.agency_id) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        {ensured.error}
      </div>
    );
  }

  const { data: candidate, error } = await supabase
    .from("candidates")
    .select(
      "*, job_requisitions(id, title, client_companies(name))"
    )
    .eq("id", id)
    .single();

  if (error || !candidate) notFound();

  const { data: notes } = await supabase
    .from("interview_notes")
    .select("*")
    .eq("candidate_id", id)
    .order("conducted_at", { ascending: false });

  const { data: asyncSessions } = await supabase
    .from("async_interview_sessions")
    .select(
      "id, invite_token, status, overall_score, overall_summary, created_at, completed_at, expires_at, async_interview_questions(id, question_text, focus_area, sort_order)"
    )
    .eq("candidate_id", id)
    .order("created_at", { ascending: false });

  const sessionsForUi = (asyncSessions || []).map((s) => {
    const qs = s.async_interview_questions as unknown;
    const questions = Array.isArray(qs)
      ? qs
      : qs
        ? [qs]
        : [];
    return {
      id: s.id,
      invite_token: s.invite_token,
      status: s.status,
      overall_score: s.overall_score,
      overall_summary: s.overall_summary,
      created_at: s.created_at,
      completed_at: s.completed_at,
      expires_at: s.expires_at,
      questions: questions as {
        id: string;
        question_text: string;
        focus_area: string | null;
        sort_order: number;
      }[],
    };
  });

  const score = effectiveScore(candidate);
  const scoreColor =
    score == null
      ? "bg-mist text-muted"
      : score >= 80
        ? "bg-teal-soft text-teal"
        : score >= 60
          ? "bg-mist-deep text-ink-soft"
          : "bg-accent-soft text-accent-hover";
  const canWrite = canWriteAgencyData(ensured.profile);
  const breakdown = (candidate.ai_score_breakdown ||
    null) as ScoreBreakdown | null;

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/candidates"
          className="text-sm font-semibold text-accent hover:text-accent-hover"
        >
          ← Kembali ke Candidates
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 sm:mb-8">
        <div className="min-w-0">
          <p className="page-kicker">Candidate profile</p>
          <h1 className="page-title break-words">{candidate.name}</h1>
          <p className="page-sub break-words">
            {candidate.email}
            {candidate.phone ? ` · ${candidate.phone}` : ""}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {jobTitle(candidate.job_requisitions)}
            {clientName(candidate.job_requisitions)
              ? ` — ${clientName(candidate.job_requisitions)}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span
            className={`inline-flex rounded-md px-3 py-1 text-sm font-medium ${scoreColor}`}
          >
            Score: {score != null ? `${score}/100` : "—"}
            {candidate.manual_score != null ? " · manual" : ""}
          </span>
          <span className="inline-flex rounded-md bg-mist px-3 py-1 text-sm font-medium capitalize text-ink-soft">
            {candidate.status}
          </span>
          {candidate.job_id && canWrite && (
            <Link href={`/compare?job=${candidate.job_id}`} className="btn-secondary">
              Bandingkan Job
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <ScorePanel
          candidateId={candidate.id}
          aiScore={candidate.ai_score}
          manualScore={candidate.manual_score}
          manualReason={candidate.manual_score_reason}
          summary={candidate.ai_summary}
          breakdown={breakdown}
          canWrite={canWrite}
        />
        <div className="surface-panel p-5 sm:p-6">
          <h2 className="mb-3 font-display text-lg font-bold text-ink">
            Data Parsed CV
          </h2>
          {candidate.parsed_data ? (
            <ParsedCvView data={candidate.parsed_data as Record<string, unknown>} />
          ) : (
            <p className="text-sm text-muted">Tidak ada data parsed.</p>
          )}
        </div>
      </div>

      <AsyncInterviewSection
        candidateId={candidate.id}
        sessions={sessionsForUi}
        canWrite={canWrite}
      />

      <InterviewNotesSection
        candidateId={candidate.id}
        notes={(notes || []) as InterviewNote[]}
        isAdmin={isAdminAgency(ensured.profile)}
        canWrite={canWrite}
      />
    </div>
  );
}
