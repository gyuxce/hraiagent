"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { shortSummary } from "@/lib/cv/short-text";
import { scoreChipClass } from "@/lib/brand-palette";

type Job = {
  id: string;
  title: string;
  status: string;
  client_companies?: { name: string } | { name: string }[] | null;
};

type Candidate = {
  id: string;
  name: string;
  email: string;
  ai_score: number | null;
  ai_summary: string | null;
  status: string;
  parsed_data: Record<string, unknown> | null;
};

type Note = {
  id: string;
  candidate_id: string;
  title: string;
  ai_summary: string | null;
  conducted_at: string;
};

type AsyncInterview = {
  id: string;
  candidate_id: string;
  overall_score: number | null;
  overall_summary: string | null;
  status: string;
  completed_at: string | null;
};

type Props = {
  jobs: Job[];
  selectedJobId: string;
  selectedJob: {
    id: string;
    title: string;
    description: string;
    requirements: string[];
    client_companies?: { name: string } | { name: string }[] | null;
  } | null;
  candidates: Candidate[];
  interviewNotes: Note[];
  asyncInterviews: AsyncInterview[];
};

function clientLabel(
  cc?: { name: string } | { name: string }[] | null
): string {
  if (!cc) return "";
  if (Array.isArray(cc)) return cc[0]?.name || "";
  return cc.name || "";
}

function scoreClass(score: number | null) {
  return scoreChipClass(score);
}

export function CompareClient({
  jobs,
  selectedJobId,
  selectedJob,
  candidates,
  interviewNotes,
  asyncInterviews,
}: Props) {
  const router = useRouter();

  const notesByCandidate = interviewNotes.reduce<Record<string, Note[]>>(
    (acc, n) => {
      if (!acc[n.candidate_id]) acc[n.candidate_id] = [];
      acc[n.candidate_id].push(n);
      return acc;
    },
    {}
  );

  const asyncByCandidate = asyncInterviews.reduce<
    Record<string, AsyncInterview>
  >((acc, s) => {
    // First row per candidate = most recent completed (query ordered)
    if (!acc[s.candidate_id]) acc[s.candidate_id] = s;
    return acc;
  }, {});

  return (
    <div>
      <div className="page-header">
        <div className="min-w-0">
          <p className="page-kicker">Side-by-side</p>
          <h1 className="page-title">Bandingkan</h1>
          <p className="page-sub">
            Bandingkan kandidat dalam satu lowongan — skor CV dan interview async
          </p>
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-ink-soft">
          Pilih lowongan
        </label>
        <select
          value={selectedJobId}
          onChange={(e) => router.push(`/compare?job=${e.target.value}`)}
          className="field-input mt-1 max-w-md"
        >
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.title}
              {clientLabel(j.client_companies)
                ? ` — ${clientLabel(j.client_companies)}`
                : ""}
            </option>
          ))}
        </select>
      </div>

      {selectedJob && (
        <div className="mb-6 rounded-xl border border-line bg-surface p-4 shadow-sm">
          <h2 className="font-semibold text-ink">{selectedJob.title}</h2>
          {clientLabel(selectedJob.client_companies) && (
            <p className="text-sm text-muted">
              {clientLabel(selectedJob.client_companies)}
            </p>
          )}
          {Array.isArray(selectedJob.requirements) &&
            selectedJob.requirements.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedJob.requirements.map((r) => (
                  <span
                    key={r}
                    className="rounded-md bg-secondary-soft px-2 py-1 text-xs text-secondary-hover"
                  >
                    {r}
                  </span>
                ))}
              </div>
            )}
        </div>
      )}

      {candidates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-surface p-10 text-center text-sm text-muted">
          Belum ada kandidat untuk job ini.
        </div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex min-w-max gap-4">
            {candidates.map((c) => {
              const notes = notesByCandidate[c.id] || [];
              const latestNote = notes[0];
              const asyncSession = asyncByCandidate[c.id];
              const skills = Array.isArray(c.parsed_data?.skills)
                ? (c.parsed_data.skills as string[]).slice(0, 6)
                : [];

              const interviewSummary =
                shortSummary(asyncSession?.overall_summary, 160) ||
                shortSummary(latestNote?.ai_summary, 160);
              const interviewScore = asyncSession?.overall_score;

              return (
                <div
                  key={c.id}
                  className="w-80 shrink-0 rounded-xl border border-line bg-surface p-5 shadow-sm"
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/candidates/${c.id}`}
                        className="font-semibold text-ink hover:text-accent"
                      >
                        {c.name}
                      </Link>
                      <p className="truncate text-xs text-muted">{c.email}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${scoreClass(
                        c.ai_score
                      )}`}
                    >
                      CV {c.ai_score != null ? `${c.ai_score}` : "—"}
                    </span>
                  </div>

                  <p className="mb-2 text-xs font-semibold uppercase text-muted">
                    Status:{" "}
                    <span className="capitalize text-ink-soft">{c.status}</span>
                  </p>

                  <div className="mb-3">
                    <p className="text-xs font-semibold uppercase text-muted">
                      AI CV Summary
                    </p>
                    <p className="mt-1 text-sm text-ink-soft">
                      {shortSummary(c.ai_summary, 140) || "Belum di-screen"}
                    </p>
                  </div>

                  {skills.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1">
                      {skills.map((s) => (
                        <span
                          key={s}
                          className="rounded bg-accent-soft px-1.5 py-0.5 text-xs text-accent-hover"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="rounded-lg bg-mist/80 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase text-muted">
                        Interview AI
                      </p>
                      {interviewScore != null && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${scoreClass(
                            interviewScore
                          )}`}
                        >
                          {interviewScore}/100
                        </span>
                      )}
                    </div>
                    {interviewSummary ? (
                      <p className="mt-1 text-sm text-ink-soft">
                        {interviewSummary}
                      </p>
                    ) : asyncSession?.status === "completed" ? (
                      <p className="mt-1 inline-flex items-center gap-2 text-sm text-muted">
                        <span className="loading-spinner" aria-hidden />
                        Memproses…
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-muted">
                        Belum ada hasil interview
                      </p>
                    )}
                    {!asyncSession && notes.length > 1 && (
                      <p className="mt-2 text-xs text-muted">
                        +{notes.length - 1} catatan manual lain
                      </p>
                    )}
                  </div>

                  <Link
                    href={`/candidates/${c.id}`}
                    className="mt-4 block text-center text-sm font-semibold text-accent hover:text-accent-hover"
                  >
                    Buka detail →
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
