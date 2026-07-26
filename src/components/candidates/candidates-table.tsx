"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  deleteCandidate,
  rescreenCandidate,
  updateCandidateStatus,
} from "@/lib/actions/candidates";
import {
  CandidateFormModal,
  type JobOption,
} from "./candidate-form-modal";
import { ImportCandidatesModal } from "./import-candidates-modal";
import { EmptyState } from "@/components/onboarding/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { effectiveScore } from "@/lib/candidates/score";

export type CandidateRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  ai_score: number | null;
  manual_score?: number | null;
  ai_summary: string | null;
  status: string;
  cv_file_path: string | null;
  parsed_data: Record<string, unknown> | null;
  job_id?: string;
  job_requisitions?: {
    id: string;
    title: string;
    client_companies?: { name: string } | null;
  } | null;
};

type Props = {
  candidates: CandidateRow[];
  jobs: JobOption[];
  isAdmin: boolean;
  canWrite?: boolean;
};

const statusOptions = [
  "submitted",
  "screened",
  "interview",
  "offer",
  "hired",
  "rejected",
] as const;

const statusStyle: Record<string, string> = {
  submitted: "bg-gray-100 text-gray-700",
  screened: "bg-accent-soft text-accent-hover",
  interview: "bg-mist-deep text-ink-soft",
  offer: "bg-amber-50 text-amber-700",
  hired: "bg-green-50 text-green-700",
  rejected: "bg-red-50 text-red-700",
};

function scoreColor(score: number | null) {
  if (score == null) return "bg-gray-100 text-gray-500";
  if (score >= 80) return "bg-green-50 text-green-700";
  if (score >= 60) return "bg-accent-soft text-accent-hover";
  if (score >= 40) return "bg-yellow-50 text-yellow-700";
  return "bg-red-50 text-red-700";
}

export function CandidatesTable({
  candidates,
  jobs,
  isAdmin,
  canWrite = true,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleStatus(id: string, status: string) {
    setBusyId(id);
    setError(null);
    const result = await updateCandidateStatus(id, status);
    setBusyId(null);
    if (result?.error) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    toast.success("Status kandidat diperbarui");
    router.refresh();
  }

  async function handleRescreen(id: string) {
    setBusyId(id);
    setError(null);
    const result = await rescreenCandidate(id);
    setBusyId(null);
    if (result?.error) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    toast.success(result?.pendingScreening ? "Memproses…" : "Skor diperbarui");
    router.refresh();
    if (result?.pendingScreening) {
      setTimeout(() => router.refresh(), 6000);
      setTimeout(() => router.refresh(), 15000);
      setTimeout(() => router.refresh(), 30000);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const { id, name } = pendingDelete;
    setBusyId(id);
    setError(null);
    const result = await deleteCandidate(id);
    setBusyId(null);
    setPendingDelete(null);
    if (result?.error) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    toast.success(`Kandidat "${name}" dihapus`);
    router.refresh();
  }

  return (
    <div>
      <div className="page-header">
        <div className="min-w-0">
          <p className="page-kicker">
            {canWrite ? "Pipeline" : "Portal klien"}
          </p>
          <h1 className="page-title">Kandidat</h1>
          <p className="page-sub">
            {canWrite
              ? "Screening AI, status ATS, import CSV, dan AI Interview Async (di halaman Detail)"
              : "Daftar kandidat yang diajukan agency — tampilan hanya baca"}
          </p>
        </div>
        <div className="page-header-actions">
          {canWrite && (
            <>
              <Link href="/compare" className="btn-secondary">
                Bandingkan
              </Link>
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className="btn-secondary"
              >
                Import CSV
              </button>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="btn-primary"
              >
                + Tambah kandidat
              </button>
            </>
          )}
          {!canWrite && (
            <Link href="/reports" className="btn-secondary">
              Export laporan
            </Link>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="surface-panel overflow-hidden">
        {candidates.length === 0 ? (
          <EmptyState
            stepLabel="Langkah 3 dari 3"
            title="Belum ada kandidat"
            description={
              jobs.length === 0
                ? "Buat job dulu, lalu upload CV (PDF/DOCX) atau import CSV agar AI bisa men-score kecocokan."
                : "Upload CV atau import spreadsheet. Centang screening agar skor muncul otomatis."
            }
            action={
              canWrite ? (
                jobs.length === 0 ? (
                  <Link href="/jobs" className="btn-primary">
                    Buat job dulu
                  </Link>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setImportOpen(true)}
                      className="btn-secondary"
                    >
                      Import CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalOpen(true)}
                      className="btn-primary"
                    >
                      + Tambah kandidat
                    </button>
                  </>
                )
              ) : undefined
            }
          />
        ) : (
          <>
            {/* Mobile cards */}
            <div className="divide-y divide-line md:hidden">
              {candidates.map((c) => {
                const score = effectiveScore(c);
                return (
                  <div key={c.id} className="space-y-3 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/candidates/${c.id}`}
                          className="text-sm font-semibold text-ink hover:text-accent"
                        >
                          {c.name}
                        </Link>
                        <p className="truncate text-xs text-muted">{c.email}</p>
                        <p className="mt-1 text-xs text-ink-soft">
                          {c.job_requisitions?.title || "—"}
                          {c.job_requisitions?.client_companies?.name
                            ? ` · ${c.job_requisitions.client_companies.name}`
                            : ""}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 inline-flex rounded-md px-2 py-1 text-xs font-medium ${scoreColor(
                          score
                        )}`}
                      >
                        {score != null ? `${score}` : "—"}
                        {c.manual_score != null ? " M" : ""}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {canWrite ? (
                        <select
                          value={c.status}
                          disabled={busyId === c.id}
                          onChange={(e) => handleStatus(c.id, e.target.value)}
                          className={`btn-chip border-0 ${
                            statusStyle[c.status] || statusStyle.submitted
                          }`}
                        >
                          {statusOptions.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className={`btn-chip ${
                            statusStyle[c.status] || statusStyle.submitted
                          }`}
                        >
                          {c.status}
                        </span>
                      )}
                      <Link
                        href={`/candidates/${c.id}`}
                        className="btn-chip btn-chip-ghost"
                      >
                        Detail
                      </Link>
                      {canWrite && c.cv_file_path && (
                        <button
                          type="button"
                          disabled={busyId === c.id}
                          onClick={() => handleRescreen(c.id)}
                          className="btn-chip btn-chip-accent"
                        >
                          {busyId === c.id ? "..." : "Re-AI"}
                        </button>
                      )}
                      {canWrite && isAdmin && (
                        <button
                          type="button"
                          disabled={busyId === c.id}
                          onClick={() =>
                            setPendingDelete({ id: c.id, name: c.name })
                          }
                          className="btn-chip btn-chip-danger"
                        >
                          Hapus
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full divide-y divide-line">
                <thead className="bg-mist/70">
                  <tr>
                    {["Nama", "Posisi", "Score", "Status", "Aksi"].map((h) => (
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
                  {candidates.map((c) => {
                    const score = effectiveScore(c);
                    return (
                      <tr key={c.id} className="hover:bg-mist/40">
                        <td className="px-6 py-4">
                          <Link
                            href={`/candidates/${c.id}`}
                            className="text-sm font-medium text-accent hover:text-accent-hover"
                          >
                            {c.name}
                          </Link>
                          <div className="text-xs text-muted">{c.email}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-muted">
                          <div>{c.job_requisitions?.title || "—"}</div>
                          {c.job_requisitions?.client_companies?.name && (
                            <div className="text-xs text-muted/80">
                              {c.job_requisitions.client_companies.name}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${scoreColor(
                              score
                            )}`}
                          >
                            {score != null ? `${score}/100` : "—"}
                            {c.manual_score != null ? " · M" : ""}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {canWrite ? (
                            <select
                              value={c.status}
                              disabled={busyId === c.id}
                              onChange={(e) =>
                                handleStatus(c.id, e.target.value)
                              }
                              className={`rounded-md border-0 px-2 py-1 text-xs font-medium ${
                                statusStyle[c.status] || statusStyle.submitted
                              }`}
                            >
                              {statusOptions.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span
                              className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${
                                statusStyle[c.status] || statusStyle.submitted
                              }`}
                            >
                              {c.status}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              href={`/candidates/${c.id}`}
                              className="btn-chip btn-chip-ghost"
                            >
                              Detail
                            </Link>
                            {canWrite && c.cv_file_path && (
                              <button
                                type="button"
                                disabled={busyId === c.id}
                                onClick={() => handleRescreen(c.id)}
                                className="btn-chip btn-chip-accent"
                                title="Hitung ulang skor"
                              >
                                {busyId === c.id ? "Memproses..." : "Re-AI"}
                              </button>
                            )}
                            {canWrite && isAdmin && (
                              <button
                                type="button"
                                disabled={busyId === c.id}
                                onClick={() =>
                                  setPendingDelete({ id: c.id, name: c.name })
                                }
                                className="btn-chip btn-chip-danger"
                              >
                                Hapus
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {canWrite && (
        <>
          <CandidateFormModal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            jobs={jobs}
          />
          <ImportCandidatesModal
            open={importOpen}
            onClose={() => setImportOpen(false)}
            jobs={jobs}
          />
        </>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Hapus kandidat?"
        description={
          pendingDelete
            ? `Kandidat "${pendingDelete.name}" akan dihapus permanen beserta data terkait. Tindakan ini tidak bisa dibatalkan.`
            : ""
        }
        confirmLabel="Ya, hapus"
        loading={Boolean(pendingDelete && busyId === pendingDelete.id)}
        onCancel={() => {
          if (!busyId) setPendingDelete(null);
        }}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
