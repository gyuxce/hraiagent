import Link from "next/link";
import { Briefcase, UserCheck, Clock, FileSpreadsheet } from "lucide-react";

export type ClientPortalStats = {
  clientName: string;
  openJobs: number;
  totalCandidates: number;
  inPipeline: number;
  avgScore: number | null;
};

export type PortalJobRow = {
  id: string;
  title: string;
  status: string;
  candidateCount: number;
  avgScore: number | null;
};

export type PortalCandidateRow = {
  id: string;
  name: string;
  status: string;
  ai_score: number | null;
  created_at: string;
  jobTitle: string;
};

const statusLabel: Record<string, string> = {
  submitted: "Baru",
  screened: "Di-screen",
  interview: "Interview",
  offer: "Offer",
  hired: "Diterima",
  rejected: "Ditolak",
  open: "Open",
  closed: "Closed",
  on_hold: "On Hold",
};

const statusColor: Record<string, string> = {
  submitted: "bg-mist text-muted",
  screened: "bg-teal-soft text-teal",
  interview: "bg-accent-soft text-accent-hover",
  offer: "bg-amber-50 text-amber-800",
  hired: "bg-teal-soft text-teal",
  rejected: "bg-red-50 text-red-700",
};

type Props = {
  stats: ClientPortalStats;
  jobs: PortalJobRow[];
  recent: PortalCandidateRow[];
  pipeline: Record<string, number>;
};

export function ClientDashboard({ stats, jobs, recent, pipeline }: Props) {
  const cards = [
    { name: "Open Jobs", value: String(stats.openJobs), icon: Briefcase },
    {
      name: "Total Kandidat",
      value: String(stats.totalCandidates),
      icon: UserCheck,
    },
    { name: "Dalam Pipeline", value: String(stats.inPipeline), icon: Clock },
    {
      name: "Avg AI Score",
      value: stats.avgScore != null ? `${stats.avgScore}` : "—",
      icon: FileSpreadsheet,
    },
  ];

  const stages = [
    "submitted",
    "screened",
    "interview",
    "offer",
    "hired",
    "rejected",
  ];

  return (
    <div>
      <div className="mb-8">
        <p className="page-kicker">Portal klien</p>
        <h1 className="page-title">{stats.clientName}</h1>
        <p className="page-sub">
          Progress kandidat yang diajukan agency untuk perusahaan Anda — tampilan
          hanya baca.
        </p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((stat) => (
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

      <div className="mb-8 surface-panel p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-ink">
              Pipeline status
            </h2>
            <p className="text-sm text-muted">Sebaran kandidat per tahap</p>
          </div>
          <Link href="/reports" className="btn-secondary">
            Export laporan
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {stages.map((stage) => (
            <div
              key={stage}
              className="rounded-xl border border-line bg-mist/50 px-3 py-3"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {statusLabel[stage] || stage}
              </p>
              <p className="mt-1 font-display text-2xl font-bold text-ink">
                {pipeline[stage] || 0}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-8 surface-panel overflow-hidden">
        <div className="border-b border-line px-6 py-4">
          <h2 className="font-display text-lg font-bold text-ink">
            Lowongan aktif
          </h2>
        </div>
        {jobs.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted">
            Belum ada lowongan untuk client ini.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-line">
              <thead className="bg-mist/70">
                <tr>
                  {["Posisi", "Status", "Kandidat", "Avg AI"].map((h) => (
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
                {jobs.map((j) => (
                  <tr key={j.id} className="hover:bg-mist/40">
                    <td className="px-6 py-3 text-sm font-medium text-ink">
                      <Link
                        href={`/jobs`}
                        className="hover:text-accent"
                      >
                        {j.title}
                      </Link>
                    </td>
                    <td className="px-6 py-3 text-sm text-muted">
                      {statusLabel[j.status] || j.status}
                    </td>
                    <td className="px-6 py-3 text-sm text-muted">
                      {j.candidateCount}
                    </td>
                    <td className="px-6 py-3 text-sm text-muted">
                      {j.avgScore != null ? `${j.avgScore}/100` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="surface-panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="font-display text-lg font-bold text-ink">
            Kandidat terbaru
          </h2>
          <Link
            href="/candidates"
            className="text-sm font-semibold text-accent hover:text-accent-hover"
          >
            Lihat semua
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted">
            Belum ada kandidat yang diajukan.
          </p>
        ) : (
          <div className="divide-y divide-line">
            {recent.map((c) => (
              <Link
                key={c.id}
                href={`/candidates/${c.id}`}
                className="flex items-center justify-between px-6 py-4 transition hover:bg-mist/50"
              >
                <div>
                  <p className="text-sm font-semibold text-ink">{c.name}</p>
                  <p className="text-sm text-muted">
                    {c.jobTitle}
                    {c.ai_score != null ? ` · Skor ${c.ai_score}/100` : ""}
                  </p>
                </div>
                <span
                  className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${
                    statusColor[c.status] || statusColor.submitted
                  }`}
                >
                  {statusLabel[c.status] || c.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
