import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ensureUserHasAgency } from "@/lib/actions/agency";
import { RankingFilters } from "@/components/interview/ranking-filters";
import { summaryPoints } from "@/lib/cv/summary-points";

type Props = {
  searchParams: Promise<{ job?: string }>;
};

export default async function RankingPage({ searchParams }: Props) {
  const { job: jobId } = await searchParams;
  const supabase = await createClient();
  const ensured = await ensureUserHasAgency();

  if (ensured.error && !ensured.profile?.agency_id) {
    return (
      <div className="rounded-lg bg-accent-soft p-4 text-sm text-accent-hover">
        {ensured.error}
      </div>
    );
  }

  const { data: jobs } = await supabase
    .from("job_requisitions")
    .select("id, title, client_companies(name)")
    .order("created_at", { ascending: false });

  const selectedJobId = jobId || jobs?.[0]?.id || "";

  let rows: {
    session_id: string;
    overall_score: number | null;
    overall_summary: string | null;
    status: string;
    completed_at: string | null;
    candidates: {
      id: string;
      name: string;
      email: string;
      ai_score: number | null;
    } | null;
  }[] = [];

  if (selectedJobId) {
    const { data } = await supabase
      .from("async_interview_sessions")
      .select(
        "id, overall_score, overall_summary, status, completed_at, candidates(id, name, email, ai_score)"
      )
      .eq("job_id", selectedJobId)
      .order("overall_score", { ascending: false, nullsFirst: false });

    rows = (data || []).map((r) => {
      const cand = r.candidates as unknown;
      const c = Array.isArray(cand) ? cand[0] : cand;
      return {
        session_id: r.id,
        overall_score: r.overall_score,
        overall_summary: r.overall_summary,
        status: r.status,
        completed_at: r.completed_at,
        candidates: c as {
          id: string;
          name: string;
          email: string;
          ai_score: number | null;
        } | null,
      };
    });
  }

  const jobOptions = (jobs || []).map((j) => {
    const cc = j.client_companies as unknown;
    const name = Array.isArray(cc)
      ? cc[0]?.name
      : (cc as { name?: string } | null)?.name;
    return {
      id: j.id,
      label: name ? `${j.title} — ${name}` : j.title,
    };
  });

  return (
    <div>
      <div className="mb-8">
        <p className="page-kicker">Dua skor, dua makna</p>
        <h1 className="page-title">Peringkat AI Interview</h1>
        <p className="page-sub">
          Diurutkan dari <strong>skor interview</strong> (kualitas jawaban
          async). <strong>Skor CV</strong> di sampingnya = kecocokan CV dari
          screening — tidak digabung otomatis.
        </p>
      </div>

      <RankingFilters jobs={jobOptions} selectedJobId={selectedJobId} />

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-surface p-10 text-center text-sm text-muted">
          Belum ada hasil interview async untuk lowongan ini.
        </div>
      ) : (
        <>
          {/* Mobile: swipeable cards */}
          <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-1 pb-2 md:hidden">
            {rows.map((r, i) => {
              const points = summaryPoints(r.overall_summary, 2);
              return (
                <article
                  key={r.session_id}
                  className="surface-panel w-[min(86vw,20rem)] shrink-0 snap-start p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-display text-lg font-bold text-ink">
                      #{i + 1}
                    </p>
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                        r.overall_score == null
                          ? "bg-mist text-muted"
                          : r.overall_score <= 39
                            ? "bg-accent-soft text-accent-hover"
                            : "bg-secondary-soft text-secondary-hover"
                      }`}
                    >
                      {r.overall_score != null
                        ? `${r.overall_score}/100`
                        : "Belum skor"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-ink">
                    {r.candidates?.name || "—"}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {r.candidates?.email}
                  </p>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <dt className="text-muted">Skor CV</dt>
                      <dd className="font-semibold text-ink">
                        {r.candidates?.ai_score != null
                          ? `${r.candidates.ai_score}/100`
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">Status</dt>
                      <dd className="capitalize font-semibold text-ink">
                        {r.status}
                      </dd>
                    </div>
                  </dl>
                  {points.length > 0 && (
                    <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-ink-soft">
                      {points.map((p) => (
                        <li key={p.slice(0, 32)}>{p}</li>
                      ))}
                    </ul>
                  )}
                  {r.candidates?.id && (
                    <Link
                      href={`/candidates/${r.candidates.id}`}
                      className="btn-chip btn-chip-accent mt-4 w-full"
                    >
                      Detail
                    </Link>
                  )}
                </article>
              );
            })}
          </div>

          {/* Desktop / tablet: horizontal scroll table */}
          <div className="surface-panel hidden overflow-hidden md:block">
            <div className="overflow-x-auto overscroll-x-contain">
              <table className="min-w-[720px] w-full divide-y divide-line">
                <thead className="bg-mist/70">
                  <tr>
                    {[
                      "Peringkat",
                      "Kandidat",
                      "Skor CV",
                      "Skor interview",
                      "Status",
                      "Aksi",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((r, i) => {
                    const points = summaryPoints(r.overall_summary, 1);
                    return (
                      <tr key={r.session_id} className="hover:bg-mist/40">
                        <td className="px-6 py-4 text-sm font-bold text-ink">
                          #{i + 1}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-ink">
                            {r.candidates?.name || "—"}
                          </div>
                          <div className="text-xs text-muted">
                            {r.candidates?.email}
                          </div>
                          {points[0] && (
                            <p className="mt-1 text-xs text-ink-soft">
                              {points[0]}
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-ink-soft">
                          {r.candidates?.ai_score != null
                            ? `${r.candidates.ai_score}/100`
                            : "—"}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`rounded-md px-2 py-1 text-xs font-medium ${
                              r.overall_score == null
                                ? "bg-mist text-muted"
                                : r.overall_score <= 39
                                  ? "bg-accent-soft text-accent-hover"
                                  : r.overall_score <= 59
                                    ? "bg-mist-deep text-ink-soft"
                                    : "bg-secondary-soft text-secondary-hover"
                            }`}
                          >
                            {r.overall_score != null
                              ? `${r.overall_score}/100`
                              : "Belum dianalisis"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm capitalize text-ink-soft">
                          {r.status}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {r.candidates?.id && (
                            <Link
                              href={`/candidates/${r.candidates.id}`}
                              className="font-semibold text-accent hover:text-accent-hover"
                            >
                              Detail
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
