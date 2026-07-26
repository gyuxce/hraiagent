"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  analyzeCompletedInterview,
  createAsyncInterview,
} from "@/lib/actions/async-interview";
import { InterviewIdentityPanel } from "@/components/candidates/interview-identity-panel";
import { useToast } from "@/components/ui/toast";

export type AsyncSessionRow = {
  id: string;
  invite_token: string;
  status: string;
  overall_score: number | null;
  overall_summary: string | null;
  created_at: string;
  completed_at: string | null;
  expires_at: string | null;
  challenge_code?: string | null;
  challenge_passed?: boolean | null;
  face_match_status?: string | null;
  face_match_note?: string | null;
  needs_manual_review?: boolean | null;
  identity_summary?: string | null;
  selfie_path?: string | null;
  media_purged_at?: string | null;
  questions?: { id: string; question_text: string; focus_area: string | null; sort_order: number }[];
};

type Props = {
  candidateId: string;
  sessions: AsyncSessionRow[];
  canWrite?: boolean;
  /** Surfaced when Supabase select fails (e.g. missing migration columns). */
  loadError?: string | null;
};

function scoreBadgeClass(score: number): string {
  if (score <= 39) return "bg-red-50 text-red-700";
  if (score <= 59) return "bg-amber-50 text-amber-800";
  if (score <= 74) return "bg-slate-100 text-slate-700";
  return "bg-green-50 text-green-700";
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallback below
  }

  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.left = "-9999px";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

export function AsyncInterviewSection({
  candidateId,
  sessions,
  canWrite = true,
  loadError = null,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(
    sessions[0]?.id || null
  );

  async function handleCreate() {
    setLoading(true);
    setError(null);
    setInviteUrl(null);
    const result = await createAsyncInterview(candidateId);
    setLoading(false);
    if (result?.error) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    toast.success(
      "Link siap — pertanyaan langsung tersedia (AI menyempurnakan di background)"
    );
    if (result?.inviteUrl) {
      setInviteUrl(result.inviteUrl);
      const ok = await copyToClipboard(result.inviteUrl);
      if (ok) setCopied(result.inviteUrl);
    }
    router.refresh();
  }

  async function handleAnalyze(sessionId: string) {
    setBusyId(sessionId);
    setError(null);
    const result = await analyzeCompletedInterview(sessionId);
    setBusyId(null);
    if (result?.error) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    toast.success("Analisis AI selesai");
    router.refresh();
  }

  async function handleCopy(url: string) {
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopied(url);
      toast.success("Link interview disalin");
      setTimeout(() => setCopied(null), 2500);
    } else {
      setError("Gagal salin otomatis. Blok link lalu Ctrl+C manual.");
      toast.error("Gagal salin — select link lalu Ctrl+C");
    }
  }

  const base = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div id="async-interview" className="mt-8 scroll-mt-20">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="page-kicker">Fase 2.5 · skor terpisah dari CV</p>
          <h2 className="font-display text-lg font-bold text-ink">
            AI Interview Async
          </h2>
          <p className="mt-1 text-sm text-muted">
            Skor AI = dari <strong>transkrip suara → teks</strong> (bukan analisis
            video mahal). Video bukti bisa dihapus otomatis setelah X hari
            (atur di Team → Retensi video); skor & transkrip tetap aman.
          </p>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={handleCreate}
            disabled={loading}
            className="btn-primary disabled:opacity-50"
          >
            {loading ? "Membuat link..." : "+ Buat Interview Async"}
          </button>
        )}
      </div>

      {(loadError || error) && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {loadError || error}
        </div>
      )}

      {inviteUrl && (
        <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
          <p className="text-sm font-medium text-indigo-900">
            Link interview siap dikirim ke kandidat:
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              readOnly
              value={inviteUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full flex-1 rounded border border-indigo-200 bg-white px-2 py-1.5 text-xs text-indigo-900"
            />
            <button
              type="button"
              onClick={() => handleCopy(inviteUrl)}
              className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              {copied === inviteUrl ? "✓ Tersalin" : "Salin Link"}
            </button>
          </div>
          <p className="mt-2 text-xs text-indigo-700">
            Tip: klik kotak link (otomatis select) lalu Ctrl+C jika tombol gagal.
          </p>
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          {loadError ? (
            <>
              Sesi gagal dimuat (bukan kosong). Perbaiki error di atas, lalu
              refresh. Cek juga Supabase Table{" "}
              <code className="text-xs">async_interview_sessions</code>.
            </>
          ) : canWrite ? (
            <>
              Belum ada sesi untuk kandidat ini. Klik{" "}
              <strong>+ Buat Interview Async</strong>. Jika di Supabase Table
              Editor ada skor tapi di sini kosong: pastikan{" "}
              <code className="text-xs">candidate_id</code> row itu sama dengan
              kandidat ini, dan <code className="text-xs">agency_id</code> cocok
              dengan akun login Anda (RLS).
            </>
          ) : (
            "Belum ada sesi interview async untuk kandidat ini."
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => {
            const url = `${base}/interview/${s.invite_token}`;
            const questions = s.questions || [];
            const isOpen = expanded === s.id;

            return (
              <div
                key={s.id}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 w-full sm:flex-1">
                      <p className="text-sm font-semibold capitalize text-gray-900">
                        Status: {s.status}
                        {s.overall_score != null && (
                          <span
                            className={`ml-2 rounded-full px-2 py-0.5 text-xs ${scoreBadgeClass(s.overall_score)}`}
                          >
                            Score {s.overall_score}/100
                          </span>
                        )}
                        {s.status === "completed" && s.overall_score == null && (
                          <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
                            Analisis pending
                          </span>
                        )}
                        {s.needs_manual_review && (
                          <span className="ml-2 rounded-full bg-orange-50 px-2 py-0.5 text-xs text-orange-700">
                            Review identitas
                          </span>
                        )}
                        {s.media_purged_at && (
                          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                            Media dihapus (retensi)
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        Dibuat {new Date(s.created_at).toLocaleString("id-ID")}
                        {s.expires_at &&
                          ` · Expired ${new Date(s.expires_at).toLocaleDateString("id-ID")}`}
                        {questions.length > 0 &&
                          ` · ${questions.length} pertanyaan`}
                        {s.media_purged_at &&
                          ` · Media dibersihkan ${new Date(s.media_purged_at).toLocaleDateString("id-ID")}`}
                      </p>
                    </div>

                    <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
                      <button
                        type="button"
                        onClick={() => handleCopy(url)}
                        className="btn-secondary px-3 py-1.5 text-xs"
                      >
                        {copied === url ? "✓ Tersalin" : "Salin link"}
                      </button>
                      <Link
                        href={url}
                        target="_blank"
                        className="btn-secondary px-3 py-1.5 text-xs"
                      >
                        Buka preview
                      </Link>
                      <button
                        type="button"
                        onClick={() =>
                          setExpanded(isOpen ? null : s.id)
                        }
                        className="btn-secondary px-3 py-1.5 text-xs"
                      >
                        {isOpen ? "Sembunyikan soal" : "Lihat soal AI"}
                      </button>
                      {canWrite &&
                        (s.status === "completed" ||
                          s.status === "in_progress") &&
                        s.overall_score == null && (
                          <button
                            type="button"
                            disabled={busyId === s.id}
                            onClick={() => handleAnalyze(s.id)}
                            className="btn-primary px-3 py-1.5 text-xs disabled:opacity-50"
                          >
                            {busyId === s.id
                              ? "Analisis..."
                              : "Jalankan Analisis AI"}
                          </button>
                        )}
                      {canWrite &&
                        s.status === "completed" &&
                        s.overall_score != null && (
                          <button
                            type="button"
                            disabled={busyId === s.id}
                            onClick={() => handleAnalyze(s.id)}
                            className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50"
                          >
                            {busyId === s.id ? "..." : "Re-analisis"}
                          </button>
                        )}
                    </div>
                  </div>

                  <input
                    readOnly
                    value={url}
                    onFocus={(e) => e.currentTarget.select()}
                    className="w-full min-w-0 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700"
                  />

                  {s.overall_summary && (
                    <p className="prose-read w-full min-w-0 max-w-full break-words whitespace-pre-wrap text-gray-700">
                      {s.overall_summary}
                    </p>
                  )}
                </div>

                {isOpen && (
                  <div className="mt-4 space-y-3">
                    <InterviewIdentityPanel
                      sessionId={s.id}
                      challengeCode={s.challenge_code}
                      challengePassed={s.challenge_passed}
                      faceMatchStatus={s.face_match_status}
                      faceMatchNote={s.face_match_note}
                      needsManualReview={s.needs_manual_review}
                      identitySummary={s.identity_summary}
                      mediaPurgedAt={s.media_purged_at}
                    />
                    <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Pertanyaan yang di-generate AI
                      </p>
                      {questions.length === 0 ? (
                        <p className="text-sm text-gray-500">
                          Pertanyaan tidak termuat. Refresh halaman.
                        </p>
                      ) : (
                        <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-800">
                          {questions
                            .slice()
                            .sort((a, b) => a.sort_order - b.sort_order)
                            .map((q) => (
                              <li key={q.id}>
                                <span>{q.question_text}</span>
                                {q.focus_area && (
                                  <span className="ml-2 rounded-full bg-white px-1.5 py-0.5 text-xs capitalize text-gray-500">
                                    {q.focus_area}
                                  </span>
                                )}
                              </li>
                            ))}
                        </ol>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
