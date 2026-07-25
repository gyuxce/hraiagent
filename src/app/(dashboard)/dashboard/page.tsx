import Link from "next/link";
import {
  Briefcase,
  Users,
  UserCheck,
  Clock,
  TrendingUp,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ensureUserHasAgency } from "@/lib/actions/agency";
import { isClientViewer } from "@/lib/auth/roles";

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} hari lalu`;
  return new Date(dateStr).toLocaleDateString("id-ID");
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const ensured = await ensureUserHasAgency();

  if (ensured.error && !ensured.profile?.agency_id) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        {ensured.error}
      </div>
    );
  }

  const viewer = isClientViewer(ensured.profile);

  const [
    { data: clients },
    { data: jobs },
    { data: candidates },
    { data: recentCandidates },
  ] = await Promise.all([
    supabase.from("client_companies").select("id, name").order("name"),
    supabase.from("job_requisitions").select("id, status, client_id"),
    supabase.from("candidates").select("id, status, ai_score, job_id"),
    supabase
      .from("candidates")
      .select("id, name, status, ai_score, created_at, job_requisitions(title)")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const totalClients = clients?.length || 0;
  const totalJobs = jobs?.length || 0;
  const openJobs = jobs?.filter((j) => j.status === "open").length || 0;
  const totalCandidates = candidates?.length || 0;
  const inPipeline =
    candidates?.filter(
      (c) => c.status !== "hired" && c.status !== "rejected"
    ).length || 0;
  const scored = candidates?.filter((c) => c.ai_score != null) || [];
  const avgScore =
    scored.length > 0
      ? Math.round(
          scored.reduce((sum, c) => sum + (c.ai_score || 0), 0) / scored.length
        )
      : null;

  const jobClient = new Map((jobs || []).map((j) => [j.id, j.client_id]));
  const clientStats = (clients || []).map((client) => {
    const clientJobs = (jobs || []).filter((j) => j.client_id === client.id);
    const clientJobIds = new Set(clientJobs.map((j) => j.id));
    const clientCands = (candidates || []).filter((c) =>
      clientJobIds.has(c.job_id)
    );
    const scores = clientCands
      .map((c) => c.ai_score)
      .filter((s): s is number => s != null);
    return {
      id: client.id,
      name: client.name,
      openJobs: clientJobs.filter((j) => j.status === "open").length,
      candidates: clientCands.length,
      pipeline: clientCands.filter(
        (c) => c.status !== "hired" && c.status !== "rejected"
      ).length,
      avgScore:
        scores.length > 0
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : null,
    };
  });

  // silence unused for client_viewer path where clients list is scoped
  void jobClient;

  const stats = [
    { name: "Open Jobs", value: String(openJobs), icon: Briefcase },
    {
      name: viewer ? "Client Anda" : "Total Clients",
      value: String(totalClients),
      icon: Users,
    },
    { name: "Total Kandidat", value: String(totalCandidates), icon: UserCheck },
    { name: "Dalam Pipeline", value: String(inPipeline), icon: Clock },
  ];

  const statusLabel: Record<string, string> = {
    submitted: "Baru",
    screened: "Di-screen",
    interview: "Interview",
    offer: "Offer",
    hired: "Diterima",
    rejected: "Ditolak",
  };
  const statusColor: Record<string, string> = {
    submitted: "bg-gray-100 text-gray-600",
    screened: "bg-blue-100 text-blue-600",
    interview: "bg-purple-100 text-purple-600",
    offer: "bg-amber-100 text-amber-600",
    hired: "bg-green-100 text-green-600",
    rejected: "bg-red-100 text-red-600",
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          {viewer
            ? "Overview progress kandidat untuk client Anda"
            : "Overview performa rekrutmen lintas klien"}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {stats.map((stat) => (
          <div
            key={stat.name}
            className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
              <div className="rounded-lg bg-blue-50 p-3">
                <stat.icon className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-gray-500">
                {totalJobs} total job
                {avgScore != null && (
                  <span className="text-gray-400">
                    {" "}
                    • AI rata² {avgScore}/100
                  </span>
                )}
              </span>
            </div>
          </div>
        ))}
      </div>

      {!viewer && (
        <div className="mb-8 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Performa Multi-Klien
            </h2>
            <Link
              href="/reports"
              className="text-sm font-medium text-blue-600 hover:text-blue-500"
            >
              Lihat reports
            </Link>
          </div>
          {clientStats.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-gray-500">
              Belum ada client. Tambah client untuk melihat breakdown.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Client
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Open Jobs
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Kandidat
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Pipeline
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Avg AI
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {clientStats.map((c) => (
                    <tr key={c.id}>
                      <td className="px-6 py-3 text-sm font-medium text-gray-900">
                        {c.name}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600">
                        {c.openJobs}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600">
                        {c.candidates}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600">
                        {c.pipeline}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600">
                        {c.avgScore != null ? `${c.avgScore}/100` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Kandidat Terbaru
          </h2>
        </div>
        {!recentCandidates?.length ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">
            Belum ada kandidat.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {recentCandidates.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between px-6 py-4"
              >
                <div className="flex items-center gap-x-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                    <UserCheck className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{c.name}</p>
                    <p className="text-sm text-gray-500">
                      {(() => {
                        const jr = c.job_requisitions as unknown as
                          | { title?: string }
                          | { title?: string }[]
                          | null;
                        if (Array.isArray(jr)) return jr[0]?.title || "—";
                        return jr?.title || "—";
                      })()}
                      {c.ai_score != null && (
                        <span className="text-gray-400">
                          {" "}
                          • Skor {c.ai_score}/100
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                      statusColor[c.status] || statusColor.submitted
                    }`}
                  >
                    {statusLabel[c.status] || c.status}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatRelativeTime(c.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
