"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createCandidate } from "@/lib/actions/candidates";
import { useToast } from "@/components/ui/toast";

export type JobOption = {
  id: string;
  title: string;
  status: string;
  client_companies?: { name: string } | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  jobs: JobOption[];
};

export function CandidateFormModal({ open, onClose, jobs }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  if (!open) return null;

  const openJobs = jobs.filter((j) => j.status === "open" || j.status === "on_hold");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await createCandidate(formData);

    setLoading(false);

    if (result?.error) {
      setError(result.error);
      toast.error(result.error);
      return;
    }

    toast.success(
      result?.pendingScreening
        ? "Kandidat tersimpan — AI screening jalan di background"
        : "Kandidat ditambahkan"
    );
    router.refresh();
    onClose();
    // Poll a few times so AI score appears without manual reload
    if (result?.pendingScreening) {
      setTimeout(() => router.refresh(), 6000);
      setTimeout(() => router.refresh(), 15000);
      setTimeout(() => router.refresh(), 30000);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl border border-gray-200">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Tambah Kandidat</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {openJobs.length === 0 ? (
          <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
            Belum ada job open. Buat job dulu di menu Jobs.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 break-words">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="job_id" className="block text-sm font-medium text-gray-700">
                Job *
              </label>
              <select
                id="job_id"
                name="job_id"
                required
                defaultValue=""
                className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="" disabled>
                  Pilih lowongan
                </option>
                {openJobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title}
                    {j.client_companies?.name ? ` — ${j.client_companies.name}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="cv" className="block text-sm font-medium text-gray-700">
                Upload CV (PDF/DOCX/TXT)
              </label>
              <input
                id="cv"
                name="cv"
                type="file"
                accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                className="mt-1 block w-full text-sm text-gray-600 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
              />
              <p className="mt-1 text-xs text-gray-400">
                AI akan parse CV & scoring (OpenRouter)
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Nama
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Opsional jika ada CV (AI ekstrak)"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Opsional jika ada CV"
                />
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                  Telepon
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="text"
                  className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Opsional"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                name="run_ai"
                value="true"
                defaultChecked
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Jalankan AI screening setelah upload
            </label>

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
                {loading ? "Menyimpan..." : "Tambah Kandidat"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
