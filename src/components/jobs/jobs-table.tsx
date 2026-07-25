"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientCompany } from "@/types/database";
import { deleteJob } from "@/lib/actions/jobs";
import { JobFormModal, type JobWithClient } from "./job-form-modal";

type Props = {
  jobs: JobWithClient[];
  clients: ClientCompany[];
  isAdmin: boolean;
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

export function JobsTable({ jobs, clients, isAdmin }: Props) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<JobWithClient | null>(null);
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

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Hapus job "${title}"?`)) return;

    setDeletingId(id);
    setError(null);
    const result = await deleteJob(id);
    setDeletingId(null);

    if (result?.error) {
      setError(result.error);
      return;
    }

    router.refresh();
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
          <p className="mt-1 text-sm text-gray-500">Kelola lowongan per klien</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors"
        >
          + Buat Job
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {jobs.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm text-gray-500">Belum ada job requisition.</p>
            <button
              type="button"
              onClick={openCreate}
              className="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-500"
            >
              + Buat job pertama
            </button>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Posisi
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Requirements
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aksi
                </th>
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
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                    {Array.isArray(job.requirements) && job.requirements.length > 0
                      ? job.requirements.slice(0, 3).join(", ")
                      : "—"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => openEdit(job)}
                        className="text-blue-600 hover:text-blue-500 font-medium"
                      >
                        Edit
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleDelete(job.id, job.title)}
                          disabled={deletingId === job.id}
                          className="text-red-600 hover:text-red-500 font-medium disabled:opacity-50"
                        >
                          {deletingId === job.id ? "..." : "Hapus"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <JobFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        job={editing}
        clients={clients}
      />
    </div>
  );
}
