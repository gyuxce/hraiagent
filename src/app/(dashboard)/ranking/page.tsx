import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ensureUserHasAgency } from "@/lib/actions/agency";
import { RankingFilters } from "@/components/interview/ranking-filters";

type Props = {
  searchParams: Promise<{ job?: string }>;
};

export default async function RankingPage({ searchParams }: Props) {
  const { job: jobId } = await searchParams;
  const supabase = await createClient();
  const ensured = await ensureUserHasAgency();

  if (ensured.error && !ensured.profile?.agency_id) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
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
        <h1 className="page-title">Ranking AI Interview</h1>
        <p className="page-sub">
          Diurutkan dari <strong>Interview Score</strong> (kualitas jawaban
          async). <strong>CV Score</strong> di sampingnya = kecocokan CV dari
          screening — tidak digabung otomatis.
        </p>
      </div>

      <RankingFilters jobs={jobOptions} selectedJobId={selectedJobId} />

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
          Belum ada hasil interview async untuk job ini.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Rank
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Kandidat
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  CV Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Interview Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rows.map((r, i) => (
                <tr key={r.session_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-bold text-gray-900">
                    #{i + 1}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      {r.candidates?.name || "—"}
                    </div>
                    <div className="text-xs text-gray-500">
                      {r.candidates?.email}
                    </div>
                    {r.overall_summary && (
                      <p className="mt-1 line-clamp-2 text-xs text-gray-500">
                        {r.overall_summary}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {r.candidates?.ai_score != null
                      ? `${r.candidates.ai_score}/100`
                      : "—"}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        r.overall_score == null
                          ? "bg-gray-100 text-gray-600"
                          : r.overall_score <= 39
                            ? "bg-red-50 text-red-700"
                            : r.overall_score <= 59
                              ? "bg-amber-50 text-amber-800"
                              : r.overall_score <= 74
                                ? "bg-slate-100 text-slate-700"
                                : "bg-green-50 text-green-700"
                      }`}
                    >
                      {r.overall_score != null
                        ? `${r.overall_score}/100`
                        : "Belum dianalisi"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm capitalize text-gray-600">
                    {r.status}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {r.candidates?.id && (
                      <Link
                        href={`/candidates/${r.candidates.id}`}
                        className="font-medium text-blue-600 hover:text-blue-500"
                      >
                        Detail
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
