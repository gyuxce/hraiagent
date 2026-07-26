import Link from "next/link";
import {
  Briefcase,
  Users,
  UserCheck,
  Clock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ensureUserHasAgency } from "@/lib/actions/agency";
import { isClientViewer } from "@/lib/auth/roles";
import {
  ClientDashboard,
  type PortalCandidateRow,
  type PortalJobRow,
} from "@/components/portal/client-dashboard";
import { OnboardingChecklist } from "@/components/onboarding/onboarding-checklist";
import { EmptyState } from "@/components/onboarding/empty-state";
import { AiUsageCard } from "@/components/usage/ai-usage-card";
import { getAgencyAiUsage } from "@/lib/ai/usage";

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
  // Auth/profile is request-cached with layout via getSessionProfile()
  const ensured = await ensureUserHasAgency();

  if (ensured.error && !ensured.profile?.agency_id) {
    return (
      <div className="rounded-xl bg-accent-soft p-4 text-sm text-accent-hover">
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
    supabase.from("job_requisitions").select("id, title, status, client_id"),
    supabase
      .from("candidates")
      .select("id, status, ai_score, job_id, name, created_at"),
    supabase
      .from("candidates")
      .select("id, name, status, ai_score, created_at, job_requisitions(title)")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  // Client portal: dedicated report-like dashboard
  if (viewer) {
    const clientName = clients?.[0]?.name || "Client Anda";
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
            scored.reduce((sum, c) => sum + (c.ai_score || 0), 0) /
              scored.length
          )
        : null;

    const pipeline: Record<string, number> = {};
    for (const c of candidates || []) {
      pipeline[c.status] = (pipeline[c.status] || 0) + 1;
    }

    const jobRows: PortalJobRow[] = (jobs || []).map((j) => {
      const related = (candidates || []).filter((c) => c.job_id === j.id);
      const scores = related
        .map((c) => c.ai_score)
        .filter((s): s is number => s != null);
      return {
        id: j.id,
        title: j.title,
        status: j.status,
        candidateCount: related.length,
        avgScore:
          scores.length > 0
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
            : null,
      };
    });

    const recent: PortalCandidateRow[] = (recentCandidates || []).map((c) => {
      const jr = c.job_requisitions as unknown as
        | { title?: string }
        | { title?: string }[]
        | null;
      const jobTitle = Array.isArray(jr)
        ? jr[0]?.title || "—"
        : jr?.title || "—";
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        ai_score: c.ai_score,
        created_at: c.created_at,
        jobTitle,
      };
    });

    return (
      <ClientDashboard
        stats={{
          clientName,
          openJobs,
          totalCandidates,
          inPipeline,
          avgScore,
        }}
        jobs={jobRows}
        recent={recent}
        pipeline={pipeline}
      />
    );
  }

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

  const stats = [
    { name: "Lowongan terbuka", value: String(openJobs), icon: Briefcase },
    { name: "Total klien", value: String(totalClients), icon: Users },
    { name: "Total kandidat", value: String(totalCandidates), icon: UserCheck },
    { name: "Dalam pipeline", value: String(inPipeline), icon: Clock },
  ];

  const aiUsage = await getAgencyAiUsage(
    supabase,
    ensured.profile?.agency_id || undefined
  );

  const statusLabel: Record<string, string> = {
    submitted: "Baru",
    screened: "Di-screen",
    interview: "Interview",
    offer: "Offer",
    hired: "Diterima",
    rejected: "Ditolak",
  };
  const statusColor: Record<string, string> = {
    submitted: "bg-mist text-muted",
    screened: "bg-teal-soft text-teal",
    interview: "bg-accent-soft text-accent-hover",
    offer: "bg-amber-50 text-amber-800",
    hired: "bg-teal-soft text-teal",
    rejected: "bg-red-50 text-red-700",
  };

  return (
    <div>
      <div className="mb-8">
        <p className="page-kicker">Ruang kerja agency</p>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-sub">
          Ringkasan performa rekrutmen lintas klien
          {avgScore != null && (
            <span className="text-ink-soft">
              {" "}
              · AI rata-rata {avgScore}/100 · {totalJobs} lowongan
            </span>
          )}
        </p>
      </div>

      <OnboardingChecklist
        progress={{
          hasClient: totalClients > 0,
          hasJob: totalJobs > 0,
          hasCandidate: totalCandidates > 0,
        }}
      />

      <AiUsageCard usage={aiUsage} />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.name} className="surface-panel p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-muted">{stat.name}</p>
                <p className="mt-2 font-display text-3xl font-bold tracking-tight text-ink">
                  {stat.value}
                </p>
              </div>
              <div className="rounded-lg bg-mist p-2.5 text-ink-soft">
                <stat.icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-8 surface-panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <h2 className="font-display text-lg font-bold text-ink">
              Performa Multi-Klien
            </h2>
            <p className="text-sm text-muted">Breakdown pipeline per client</p>
          </div>
          <Link
            href="/reports"
            className="text-sm font-semibold text-accent hover:text-accent-hover"
          >
            Lihat reports
          </Link>
        </div>
        {clientStats.length === 0 ? (
          <EmptyState
            stepLabel="Langkah 1 dari 3"
            title="Belum ada client"
            description="Tambah client company untuk melihat breakdown pipeline di sini."
            action={
              <Link href="/clients" className="btn-primary">
                Tambah client
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-line">
              <thead className="bg-mist/70">
                <tr>
                  {["Klien", "Lowongan", "Kandidat", "Pipeline", "Rata AI"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {clientStats.map((c) => (
                  <tr key={c.id} className="hover:bg-mist/40">
                    <td className="px-6 py-3 text-sm font-medium text-ink">
                      {c.name}
                    </td>
                    <td className="px-6 py-3 text-sm text-muted">{c.openJobs}</td>
                    <td className="px-6 py-3 text-sm text-muted">
                      {c.candidates}
                    </td>
                    <td className="px-6 py-3 text-sm text-muted">{c.pipeline}</td>
                    <td className="px-6 py-3 text-sm text-muted">
                      {c.avgScore != null ? `${c.avgScore}/100` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="surface-panel overflow-hidden">
        <div className="border-b border-line px-6 py-4">
          <h2 className="font-display text-lg font-bold text-ink">
            Kandidat Terbaru
          </h2>
        </div>
        {!recentCandidates?.length ? (
          <EmptyState
            stepLabel="Langkah 3 dari 3"
            title="Belum ada kandidat"
            description="Setelah ada job, upload CV atau import CSV — kandidat terbaru muncul di sini."
            action={
              <Link href="/candidates" className="btn-primary">
                Ke kandidat
              </Link>
            }
          />
        ) : (
          <div className="divide-y divide-line">
            {recentCandidates.map((c) => (
              <Link
                key={c.id}
                href={`/candidates/${c.id}`}
                className="flex items-center justify-between px-6 py-4 transition hover:bg-mist/50"
              >
                <div className="flex items-center gap-x-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-mist text-ink-soft">
                    <UserCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink">{c.name}</p>
                    <p className="text-sm text-muted">
                      {(() => {
                        const jr = c.job_requisitions as unknown as
                          | { title?: string }
                          | { title?: string }[]
                          | null;
                        if (Array.isArray(jr)) return jr[0]?.title || "—";
                        return jr?.title || "—";
                      })()}
                      {c.ai_score != null && (
                        <span className="text-ink-soft/80">
                          {" "}
                          · Skor {c.ai_score}/100
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                      statusColor[c.status] || statusColor.submitted
                    }`}
                  >
                    {statusLabel[c.status] || c.status}
                  </span>
                  <span className="hidden text-xs text-muted sm:inline">
                    {formatRelativeTime(c.created_at)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
