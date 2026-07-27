"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createInterviewNote,
  deleteInterviewNote,
  regenerateInterviewSummary,
} from "@/lib/actions/interviews";
import type { InterviewNote } from "@/types/database";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Props = {
  candidateId: string;
  notes: InterviewNote[];
  isAdmin: boolean;
  canWrite?: boolean;
};

export function InterviewNotesSection({
  candidateId,
  notes,
  isAdmin,
  canWrite = true,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    formData.set("candidate_id", candidateId);
    const result = await createInterviewNote(formData);
    setLoading(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  async function handleRegen(id: string) {
    setBusyId(id);
    setError(null);
    const result = await regenerateInterviewSummary(id);
    setBusyId(null);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function confirmDelete() {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setBusyId(id);
    const result = await deleteInterviewNote(id, candidateId);
    setBusyId(null);
    setPendingDeleteId(null);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <section className="mt-10">
      <div className="page-header mb-4">
        <div className="min-w-0">
          <p className="page-kicker">Fase 2 · interview manusia</p>
          <h2 className="font-display text-xl font-bold tracking-tight text-ink">
            Catatan Interview
          </h2>
          <p className="page-sub">
            Transkrip dan catatan interview manusia, dengan ringkasan AI.
          </p>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
          >
            + Tambah Catatan
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDeleteId)}
        title="Hapus catatan interview?"
        description="Catatan ini akan dihapus permanen. Tindakan ini tidak bisa dibatalkan."
        confirmLabel="Ya, hapus"
        loading={Boolean(pendingDeleteId && busyId === pendingDeleteId)}
        onCancel={() => {
          if (!busyId) setPendingDeleteId(null);
        }}
        onConfirm={confirmDelete}
      />

      {notes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-surface p-8 text-center text-sm text-muted">
          Belum ada catatan interview. Paste transkrip atau tulis catatan
          setelah interview manusia.
        </div>
      ) : (
        <div className="space-y-4">
          {notes.map((note) => (
            <div
              key={note.id}
              className="surface-panel p-5"
            >
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-ink">{note.title}</h3>
                  <p className="mt-0.5 text-xs text-muted">
                    {new Date(note.conducted_at).toLocaleString("id-ID")}
                  </p>
                </div>
                {canWrite && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busyId === note.id}
                      onClick={() => handleRegen(note.id)}
                      className="text-sm font-medium text-accent hover:text-accent-hover disabled:opacity-50"
                    >
                      {busyId === note.id ? "..." : "Re-AI Summary"}
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        disabled={busyId === note.id}
                        onClick={() => setPendingDeleteId(note.id)}
                        className="text-sm font-medium text-red-600 hover:text-red-500 disabled:opacity-50"
                      >
                        Hapus
                      </button>
                    )}
                  </div>
                )}
              </div>

              {note.ai_summary && (
                <div className="mb-4 rounded-lg bg-accent-soft p-4">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-accent-hover">
                    AI Summary
                  </p>
                  <pre className="prose-read whitespace-pre-wrap font-sans text-ink">
                    {note.ai_summary}
                  </pre>
                </div>
              )}

              {note.interviewer_notes && (
                <div className="mb-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Catatan Interviewer
                  </p>
                  <p className="prose-read mt-1 whitespace-pre-wrap text-ink-soft">
                    {note.interviewer_notes}
                  </p>
                </div>
              )}

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Transkrip
                </p>
                <p className="prose-read mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap text-ink-soft">
                  {note.transcript}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Tambah Catatan Interview
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xl text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Judul
                </label>
                <input
                  name="title"
                  type="text"
                  defaultValue="Interview HR"
                  className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Tanggal Interview
                </label>
                <input
                  name="conducted_at"
                  type="datetime-local"
                  className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Transkrip / Catatan Interview *
                </label>
                <textarea
                  name="transcript"
                  required
                  rows={8}
                  placeholder="Paste transkrip atau tulis poin-poin interview di sini..."
                  className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Catatan Interviewer (opsional)
                </label>
                <textarea
                  name="interviewer_notes"
                  rows={3}
                  className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  name="run_ai"
                  value="true"
                  defaultChecked
                  className="rounded border-gray-300 text-accent"
                />
                Generate AI summary
              </label>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
                >
                  {loading ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
