"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientCompany, JobRequisition } from "@/types/database";
import { createJob, updateJob } from "@/lib/actions/jobs";

export type JobWithClient = JobRequisition & {
  client_companies?: { id: string; name: string } | null;
  agency_id?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  job?: JobWithClient | null;
  clients: ClientCompany[];
};

export function JobFormModal({ open, onClose, job, clients }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) setError(null);
  }, [open, job]);

  if (!open) return null;

  const isEdit = Boolean(job);
  const requirementsText = Array.isArray(job?.requirements)
    ? job.requirements.join("\n")
    : "";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = isEdit
      ? await updateJob(job!.id, formData)
      : await createJob(formData);

    setLoading(false);

    if (result?.error) {
      setError(result.error);
      return;
    }

    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl border border-gray-200">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? "Edit Job" : "Buat Job"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {clients.length === 0 ? (
          <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
            Belum ada client. Tambah client dulu di menu Clients sebelum membuat job.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="client_id" className="block text-sm font-medium text-gray-700">
                Client *
              </label>
              <select
                id="client_id"
                name="client_id"
                required
                defaultValue={job?.client_id || ""}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="" disabled>
                  Pilih client
                </option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                Judul Posisi *
              </label>
              <input
                id="title"
                name="title"
                type="text"
                required
                defaultValue={job?.title || ""}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Frontend Developer"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Deskripsi *
              </label>
              <textarea
                id="description"
                name="description"
                required
                rows={4}
                defaultValue={job?.description || ""}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Deskripsi pekerjaan, tanggung jawab, dll"
              />
            </div>

            <div>
              <label htmlFor="requirements" className="block text-sm font-medium text-gray-700">
                Requirements
              </label>
              <textarea
                id="requirements"
                name="requirements"
                rows={3}
                defaultValue={requirementsText}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Satu requirement per baris&#10;React&#10;TypeScript&#10;3+ tahun pengalaman"
              />
              <p className="mt-1 text-xs text-gray-400">Pisahkan dengan baris baru atau koma</p>
            </div>

            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue={job?.status || "open"}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="open">Open</option>
                <option value="on_hold">On Hold</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {loading ? "Menyimpan..." : isEdit ? "Simpan" : "Buat Job"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
