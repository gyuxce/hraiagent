"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createInterviewNote,
  deleteInterviewNote,
  regenerateInterviewSummary,
} from "@/lib/actions/interviews";
import type { InterviewNote } from "@/types/database";

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

  async function handleDelete(id: string) {
    if (!confirm("Hapus catatan interview ini?")) return;
    setBusyId(id);
    const result = await deleteInterviewNote(id, candidateId);
    setBusyId(null);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Catatan Interview
        </h2>
        {canWrite && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500"
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

      {notes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          Belum ada catatan interview. Paste transkrip atau tulis catatan
          setelah interview manusia.
        </div>
      ) : (
        <div className="space-y-4">
          {notes.map((note) => (
            <div
              key={note.id}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-gray-900">{note.title}</h3>
                  <p className="text-xs text-gray-400">
                    {new Date(note.conducted_at).toLocaleString("id-ID")}
                  </p>
                </div>
                {canWrite && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busyId === note.id}
                      onClick={() => handleRegen(note.id)}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-500 disabled:opacity-50"
                    >
                      {busyId === note.id ? "..." : "Re-AI Summary"}
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        disabled={busyId === note.id}
                        onClick={() => handleDelete(note.id)}
                        className="text-sm font-medium text-red-600 hover:text-red-500 disabled:opacity-50"
                      >
                        Hapus
                      </button>
                    )}
                  </div>
                )}
              </div>

              {note.ai_summary && (
                <div className="mb-4 rounded-lg bg-blue-50 p-4">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
                    AI Summary
                  </p>
                  <pre className="whitespace-pre-wrap font-sans text-sm text-blue-950">
                    {note.ai_summary}
                  </pre>
                </div>
              )}

              {note.interviewer_notes && (
                <div className="mb-3">
                  <p className="text-xs font-semibold uppercase text-gray-500">
                    Catatan Interviewer
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
                    {note.interviewer_notes}
                  </p>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold uppercase text-gray-500">
                  Transkrip
                </p>
                <p className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap text-sm text-gray-700">
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
                  className="rounded border-gray-300 text-blue-600"
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
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {loading ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
