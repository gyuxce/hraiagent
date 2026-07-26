"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientCompany } from "@/types/database";
import { deleteJob } from "@/lib/actions/jobs";
import { JobFormModal, type JobWithClient } from "./job-form-modal";
import { EmptyState } from "@/components/onboarding/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import Link from "next/link";

type Props = {
  jobs: JobWithClient[];
  clients: ClientCompany[];
  isAdmin: boolean;
  canWrite?: boolean;
};

const statusStyle: Record<string, string> = {
  open: "bg-green-50 text-green-700",
  closed: "bg-gray-100 text-gray-600",
  on_hold: "bg-yellow-50 text-yellow-700",
};

const statusLabel: Record<string, string> = {
  open: "Open",
  closed: "Closed",
  on_hold: "On Hold",
};

export function JobsTable({ jobs, clients, isAdmin, canWrite = true }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<JobWithClient | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(job: JobWithClient) {
    setEditing(job);
    setError(null);
    setModalOpen(true);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const { id, title } = pendingDelete;
    setDeletingId(id);
    setError(null);
    const result = await deleteJob(id);
    setDeletingId(null);
    setPendingDelete(null);

    if (result?.error) {
      setError(result.error);
      toast.error(result.error);
      return;
    }

    toast.success(`Job "${title}" dihapus`);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="page-kicker">
            {canWrite ? "Requisitions" : "Client portal"}
          </p>
          <h1 className="page-title">Jobs</h1>
          <p className="page-sub">
            {canWrite
              ? "Kelola lowongan per klien"
              : "Lowongan yang dikerjakan agency untuk perusahaan Anda"}
          </p>
        </div>
        {canWrite && (
          <button type="button" onClick={openCreate} className="btn-primary">
            + Buat Job
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="surface-panel overflow-hidden">
        {jobs.length === 0 ? (
          <EmptyState
            stepLabel="Langkah 2 dari 3"
            title="Belum ada lowongan"
            description={
              clients.length === 0
                ? "Buat client company dulu, baru bisa membuat job requisition dengan requirement yang jelas untuk AI scoring."
                : "Buat job dengan requirement spesifik agar skor AI lebih tajam saat screening CV."
            }
            action={
              canWrite ? (
                clients.length === 0 ? (
                  <Link href="/clients" className="btn-primary">
                    Tambah client dulu
                  </Link>
                ) : (
                  <button type="button" onClick={openCreate} className="btn-primary">
                    + Buat job pertama
                  </button>
                )
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-line">
            <thead className="bg-mist/70">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted sm:px-6">
                  Posisi
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted sm:px-6">
                  Client
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted sm:px-6">
                  Status
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted lg:table-cell lg:px-6">
                  Requirements
                </th>
                {canWrite && (
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted sm:px-6">
                    Aksi
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {job.title}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {job.client_companies?.name || "—"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        statusStyle[job.status] || statusStyle.open
                      }`}
                    >
                      {statusLabel[job.status] || job.status}
                    </span>
                  </td>
                  <td className="hidden max-w-xs truncate px-4 py-4 text-sm text-muted lg:table-cell lg:px-6">
                    {Array.isArray(job.requirements) && job.requirements.length > 0
                      ? job.requirements.slice(0, 3).join(", ")
                      : "—"}
                  </td>
                  {canWrite && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => openEdit(job)}
                          className="text-accent hover:text-accent-hover font-medium"
                        >
                          Edit
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() =>
                              setPendingDelete({ id: job.id, title: job.title })
                            }
                            disabled={deletingId === job.id}
                            className="text-red-600 hover:text-red-500 font-medium disabled:opacity-50"
                          >
                            {deletingId === job.id ? "..." : "Hapus"}
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {canWrite && (
        <JobFormModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          job={editing}
          clients={clients}
        />
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Hapus job?"
        description={
          pendingDelete
            ? `Job "${pendingDelete.title}" akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.`
            : ""
        }
        confirmLabel="Ya, hapus"
        loading={Boolean(deletingId)}
        onCancel={() => {
          if (!deletingId) setPendingDelete(null);
        }}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
