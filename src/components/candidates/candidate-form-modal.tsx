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
        ? "Kandidat tersimpan — AI masih jalan, skor menyusul (~beberapa detik)"
        : "Kandidat ditambahkan"
    );
    router.refresh();
    onClose();
    if (result?.pendingScreening) {
      setTimeout(() => router.refresh(), 4000);
      setTimeout(() => router.refresh(), 10000);
      setTimeout(() => router.refresh(), 20000);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-line bg-surface p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-ink">Tambah Kandidat</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xl leading-none text-muted hover:text-ink"
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
              <div className="rounded-lg bg-accent-soft p-3 text-sm text-accent-hover break-words">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="job_id" className="block text-sm font-medium text-ink-soft">
                Job *
              </label>
              <select
                id="job_id"
                name="job_id"
                required
                defaultValue=""
                className="field-input"
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
              <label htmlFor="cv" className="block text-sm font-medium text-ink-soft">
                Upload CV (PDF/DOCX/TXT)
              </label>
              <input
                id="cv"
                name="cv"
                type="file"
                accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                className="mt-1 block w-full text-sm text-muted"
              />
              <p className="mt-1 text-xs text-muted">
                AI parse & scoring — biasanya selesai dalam beberapa detik
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="name" className="block text-sm font-medium text-ink-soft">
                  Nama
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  className="field-input"
                  placeholder="Opsional jika ada CV (AI ekstrak nama — bukan nomor HP)"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-ink-soft">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  className="field-input"
                  placeholder="Opsional jika ada CV"
                />
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-ink-soft">
                  Telepon
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="text"
                  className="field-input"
                  placeholder="Opsional"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-ink-soft">
              <input
                type="checkbox"
                name="run_ai"
                value="true"
                defaultChecked
                className="rounded border-line text-accent focus:ring-accent"
              />
              Jalankan AI screening setelah upload
            </label>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="btn-secondary">
                Batal
              </button>
              <button type="submit" disabled={loading} className="btn-primary disabled:opacity-50">
                {loading ? "Menyimpan & screening…" : "Tambah Kandidat"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
