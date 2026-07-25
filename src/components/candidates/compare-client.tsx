"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

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
};

function clientLabel(
  cc?: { name: string } | { name: string }[] | null
): string {
  if (!cc) return "";
  if (Array.isArray(cc)) return cc[0]?.name || "";
  return cc.name || "";
}

function scoreClass(score: number | null) {
  if (score == null) return "bg-gray-100 text-gray-600";
  if (score >= 80) return "bg-green-50 text-green-700";
  if (score >= 60) return "bg-blue-50 text-blue-700";
  if (score >= 40) return "bg-yellow-50 text-yellow-700";
  return "bg-red-50 text-red-700";
}

export function CompareClient({
  jobs,
  selectedJobId,
  selectedJob,
  candidates,
  interviewNotes,
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

  return (
    <div>
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700">
          Pilih Job
        </label>
        <select
          value={selectedJobId}
          onChange={(e) => router.push(`/compare?job=${e.target.value}`)}
          className="mt-1 block w-full max-w-md rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
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
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold text-gray-900">{selectedJob.title}</h2>
          {clientLabel(selectedJob.client_companies) && (
            <p className="text-sm text-gray-500">
              {clientLabel(selectedJob.client_companies)}
            </p>
          )}
          {Array.isArray(selectedJob.requirements) &&
            selectedJob.requirements.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedJob.requirements.map((r) => (
                  <span
                    key={r}
                    className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700"
                  >
                    {r}
                  </span>
                ))}
              </div>
            )}
        </div>
      )}

      {candidates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
          Belum ada kandidat untuk job ini.
        </div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex min-w-max gap-4">
            {candidates.map((c) => {
              const notes = notesByCandidate[c.id] || [];
              const latestNote = notes[0];
              const skills = Array.isArray(c.parsed_data?.skills)
                ? (c.parsed_data.skills as string[]).slice(0, 6)
                : [];

              return (
                <div
                  key={c.id}
                  className="w-80 shrink-0 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div>
                      <Link
                        href={`/candidates/${c.id}`}
                        className="font-semibold text-gray-900 hover:text-blue-600"
                      >
                        {c.name}
                      </Link>
                      <p className="text-xs text-gray-500">{c.email}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${scoreClass(
                        c.ai_score
                      )}`}
                    >
                      {c.ai_score != null ? `${c.ai_score}` : "—"}
                    </span>
                  </div>

                  <p className="mb-2 text-xs font-semibold uppercase text-gray-400">
                    Status:{" "}
                    <span className="capitalize text-gray-700">{c.status}</span>
                  </p>

                  <div className="mb-3">
                    <p className="text-xs font-semibold uppercase text-gray-400">
                      AI CV Summary
                    </p>
                    <p className="mt-1 line-clamp-5 text-sm text-gray-700">
                      {c.ai_summary || "Belum di-screen"}
                    </p>
                  </div>

                  {skills.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1">
                      {skills.map((s) => (
                        <span
                          key={s}
                          className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-xs font-semibold uppercase text-gray-400">
                      Interview AI Summary
                    </p>
                    {latestNote?.ai_summary ? (
                      <p className="mt-1 line-clamp-6 whitespace-pre-wrap text-sm text-gray-700">
                        {latestNote.ai_summary}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-gray-400">
                        Belum ada catatan interview
                      </p>
                    )}
                    {notes.length > 1 && (
                      <p className="mt-2 text-xs text-gray-400">
                        +{notes.length - 1} catatan lain
                      </p>
                    )}
                  </div>

                  <Link
                    href={`/candidates/${c.id}`}
                    className="mt-4 block text-center text-sm font-semibold text-blue-600 hover:text-blue-500"
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
