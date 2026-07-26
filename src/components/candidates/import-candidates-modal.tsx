"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { importCandidatesFromCsv } from "@/lib/actions/import-candidates";
import type { JobOption } from "./candidate-form-modal";

type Props = {
  open: boolean;
  onClose: () => void;
  jobs: JobOption[];
};

const TEMPLATE = `name,email,phone,job,status
Andi Pratama,andi@email.com,08123456789,Software Engineer,submitted
Siti Rahma,siti@email.com,,Product Manager,screened
`;

export function ImportCandidatesModal({ open, onClose, jobs }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const openJobs = jobs.filter(
    (j) => j.status === "open" || j.status === "on_hold"
  );

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cullr-candidates-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const res = await importCandidatesFromCsv(formData);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    const warn =
      res.warnings && res.warnings.length
        ? ` · ${res.warnings.slice(0, 2).join("; ")}`
        : "";
    setResult(
      `Berhasil import ${res.imported} kandidat` +
        (res.skipped ? ` · ${res.skipped} baris dilewati` : "") +
        warn
    );
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-[2px]">
      <div className="surface-panel w-full max-w-lg p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-ink">
              Import dari spreadsheet
            </h2>
            <p className="mt-1 text-sm text-muted">
              Upload CSV (export dari Excel/Google Sheets). Header didukung:
              name/nama, email, phone, job/posisi, status.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium text-muted hover:text-ink"
          >
            Tutup
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent-hover">
            {error}
          </div>
        )}
        {result && (
          <div className="mb-4 rounded-lg bg-teal-soft px-3 py-2 text-sm text-teal">
            {result}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-soft">
              Job default (jika kolom job kosong)
            </label>
            <select name="job_id" className="field-input" defaultValue="">
              <option value="">— Wajib isi kolom job di CSV —</option>
              {openJobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                  {j.client_companies?.name
                    ? ` — ${j.client_companies.name}`
                    : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-soft">
              File CSV
            </label>
            <input
              name="file"
              type="file"
              accept=".csv,text/csv"
              required
              className="mt-1 block w-full text-sm text-muted file:mr-4 file:rounded-lg file:border-0 file:bg-accent-soft file:px-4 file:py-2 file:text-sm file:font-semibold file:text-accent-hover"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={downloadTemplate}
              className="text-sm font-semibold text-ink underline-offset-2 hover:underline"
            >
              Unduh template CSV
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary disabled:opacity-50"
            >
              {loading ? "Mengimport..." : "Import kandidat"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
