import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { ensureUserHasAgency } from "@/lib/actions/agency";
import { getSupabase } from "@/lib/auth/session";
import { canWriteAgencyData, isAdminAgency } from "@/lib/auth/roles";
import { InterviewNotesSection } from "@/components/candidates/interview-notes-section";
import { AsyncInterviewSection } from "@/components/candidates/async-interview-section";
import { ScorePanel } from "@/components/candidates/score-panel";
import type { ScoreBreakdown } from "@/lib/ai/openrouter";
import { effectiveScore } from "@/lib/candidates/score";
import type { InterviewNote } from "@/types/database";

/** Always fresh — async interview results must not stick to an empty cache. */
export const dynamic = "force-dynamic";

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
          <p className="prose-read mt-1 text-gray-700">{data.summary}</p>
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
          <ul className="prose-read list-disc space-y-1.5 pl-5 text-gray-700">
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
          <ul className="prose-read list-disc space-y-1.5 pl-5 text-gray-700">
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
  noStore();
  const { id } = await params;
  const supabase = await getSupabase();
  const ensured = await ensureUserHasAgency();

  if (ensured.error && !ensured.profile?.agency_id) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        {ensured.error}
      </div>
    );
  }

  // Core session columns only (no nested embed) — embed/identity columns were
  // silently failing the whole query → empty UI while rows exist in Supabase.
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
          "id, invite_token, status, overall_score, overall_summary, created_at, completed_at, expires_at, agency_id, candidate_id"
        )
        .eq("candidate_id", id)
        .order("created_at", { ascending: false }),
    ]);

  if (error || !candidate) notFound();

  let asyncSessionsError: string | null = sessionsCore.error?.message || null;
  let sessionRows: Record<string, unknown>[] = (
    sessionsCore.data || []
  ).map((s) => ({ ...(s as Record<string, unknown>) }));

  if (sessionsCore.error) {
    asyncSessionsError =
      sessionsCore.error.message +
      " — Gagal memuat async_interview_sessions (RLS / migration 00006?).";
    sessionRows = [];
  } else if (sessionRows.length === 0) {
    // Distinguish "benar-benar kosong" vs "ada di Table Editor tapi RLS nutup"
    asyncSessionsError = null;
  } else {
    // Optional identity fields (migration 00011) — never fail the list for these
    const ids = sessionRows.map((s) => String(s.id));
    const identity = await supabase
      .from("async_interview_sessions")
      .select(
        "id, challenge_code, challenge_passed, face_match_status, face_match_note, needs_manual_review, identity_summary, selfie_path"
      )
      .in("id", ids);

    if (!identity.error && identity.data) {
      const byId = new Map(
        identity.data.map((r) => [String(r.id), r as Record<string, unknown>])
      );
      sessionRows = sessionRows.map((s) => ({
        ...s,
        ...(byId.get(String(s.id)) || {}),
      }));
    } else if (identity.error) {
      asyncSessionsError =
        "Sesi tampil, tapi kolom identitas belum lengkap. Jalankan 00011_interview_identity_guards.sql di Supabase.";
    }

    const questionsRes = await supabase
      .from("async_interview_questions")
      .select("id, session_id, question_text, focus_area, sort_order")
      .in("session_id", ids)
      .order("sort_order", { ascending: true });

    if (!questionsRes.error && questionsRes.data) {
      const qBySession = new Map<string, unknown[]>();
      for (const q of questionsRes.data) {
        const sid = String(q.session_id);
        const list = qBySession.get(sid) || [];
        list.push(q);
        qBySession.set(sid, list);
      }
      sessionRows = sessionRows.map((s) => ({
        ...s,
        async_interview_questions: qBySession.get(String(s.id)) || [],
      }));
    }
  }

  const sessionsForUi = sessionRows.map((row) => {
    const qs = row.async_interview_questions as unknown;
    const questions = Array.isArray(qs) ? qs : qs ? [qs] : [];
    return {
      id: String(row.id),
      invite_token: String(row.invite_token || ""),
      status: String(row.status || ""),
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
          {canWrite && (
            <a href="#async-interview" className="btn-primary">
              AI Interview Async
            </a>
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
        loadError={asyncSessionsError}
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
