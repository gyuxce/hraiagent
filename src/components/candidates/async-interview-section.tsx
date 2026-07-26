"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  analyzeCompletedInterview,
  createAsyncInterview,
} from "@/lib/actions/async-interview";
import { InterviewIdentityPanel } from "@/components/candidates/interview-identity-panel";
import { useToast } from "@/components/ui/toast";
import { summaryPoints } from "@/lib/cv/summary-points";

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
  questions?: {
    id: string;
    question_text: string;
    focus_area: string | null;
    sort_order: number;
  }[];
};

type Props = {
  candidateId: string;
  sessions: AsyncSessionRow[];
  canWrite?: boolean;
  loadError?: string | null;
};

function scoreBadgeClass(score: number): string {
  if (score <= 39) return "bg-accent-soft text-accent-hover";
  if (score <= 59) return "bg-mist-deep text-ink-soft";
  if (score <= 74) return "bg-secondary-soft text-secondary-hover";
  return "bg-secondary-soft text-secondary-hover";
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

  const analyzingPending = sessions.some(
    (s) =>
      (s.status === "completed" || s.status === "expired") &&
      s.overall_score == null &&
      Boolean(s.completed_at)
  );

  useEffect(() => {
    if (!analyzingPending) return;
    const tick = window.setInterval(() => {
      router.refresh();
    }, 4000);
    const stop = window.setTimeout(() => window.clearInterval(tick), 120_000);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(stop);
    };
  }, [analyzingPending, router]);

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
      result?.questionsFromAi
        ? "Link siap — pertanyaan AI unik untuk sesi ini"
        : "Link siap — pertanyaan sementara dipakai; AI menyempurnakan sebentar lagi"
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
    toast.success("Skor siap");
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
      <div className="page-header mb-4">
        <div className="min-w-0">
          <p className="page-kicker">Fase 2.5 · skor terpisah dari CV</p>
          <h2 className="font-display text-lg font-bold text-ink">
            AI Interview Async
          </h2>
          <p className="page-sub">
            Skor dari transkrip suara. Video bisa dihapus otomatis (Tim → Retensi
            video); skor & transkrip tetap aman.
          </p>
        </div>
        {canWrite && (
          <div className="page-header-actions">
            <button
              type="button"
              onClick={handleCreate}
              disabled={loading}
              className="btn-primary disabled:opacity-50"
            >
              {loading ? "Membuat link..." : "+ Buat Interview Async"}
            </button>
          </div>
        )}
      </div>

      {(loadError || error) && (
        <div className="mb-4 rounded-lg bg-accent-soft p-3 text-sm text-accent-hover">
          {loadError || error}
        </div>
      )}

      {analyzingPending && (
        <div className="mb-4 flex items-center gap-2 text-sm text-muted">
          <span className="loading-spinner" aria-hidden />
          <span>Memproses…</span>
        </div>
      )}

      {inviteUrl && (
        <div className="mb-4 rounded-lg border border-line bg-secondary-soft p-4">
          <p className="text-sm font-medium text-ink">
            Link interview siap dikirim ke kandidat:
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              readOnly
              value={inviteUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="field-input mt-0 w-full flex-1 !py-2 text-xs"
            />
            <button
              type="button"
              onClick={() => handleCopy(inviteUrl)}
              className="btn-primary shrink-0 !min-h-9 px-3 text-sm"
            >
              {copied === inviteUrl ? "✓ Tersalin" : "Salin link"}
            </button>
          </div>
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-surface p-8 text-center text-sm text-muted">
          {loadError ? (
            <>
              Sesi gagal dimuat. Perbaiki error di atas, lalu refresh.
            </>
          ) : canWrite ? (
            <>
              Belum ada sesi. Klik <strong>+ Buat Interview Async</strong>.
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
            const points = summaryPoints(s.overall_summary, 4);

            return (
              <div key={s.id} className="surface-panel p-4">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[18rem] text-left text-sm">
                    <tbody className="divide-y divide-line">
                      <tr>
                        <th className="w-[32%] py-2 pr-3 text-xs font-medium text-muted">
                          Status
                        </th>
                        <td className="py-2 capitalize text-ink">
                          {s.status}
                          {s.needs_manual_review && (
                            <span className="ml-2 rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] font-semibold text-accent-hover">
                              Review identitas
                            </span>
                          )}
                        </td>
                      </tr>
                      <tr>
                        <th className="py-2 pr-3 text-xs font-medium text-muted">
                          Skor
                        </th>
                        <td className="py-2">
                          {s.overall_score != null ? (
                            <span
                              className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${scoreBadgeClass(s.overall_score)}`}
                            >
                              {s.overall_score}/100
                            </span>
                          ) : s.status === "completed" ? (
                            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                              <span className="loading-spinner !h-3 !w-3" />
                              Memproses…
                            </span>
                          ) : (
                            <span className="text-xs text-muted">—</span>
                          )}
                        </td>
                      </tr>
                      <tr>
                        <th className="py-2 pr-3 text-xs font-medium text-muted">
                          Dibuat
                        </th>
                        <td className="py-2 text-xs text-ink-soft">
                          {new Date(s.created_at).toLocaleString("id-ID")}
                        </td>
                      </tr>
                      {s.expires_at && (
                        <tr>
                          <th className="py-2 pr-3 text-xs font-medium text-muted">
                            Kedaluwarsa
                          </th>
                          <td className="py-2 text-xs text-ink-soft">
                            {new Date(s.expires_at).toLocaleDateString("id-ID")}
                          </td>
                        </tr>
                      )}
                      {questions.length > 0 && (
                        <tr>
                          <th className="py-2 pr-3 text-xs font-medium text-muted">
                            Soal
                          </th>
                          <td className="py-2 text-xs text-ink-soft">
                            {questions.length} pertanyaan
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopy(url)}
                    className="btn-chip btn-chip-ghost"
                  >
                    {copied === url ? "✓ Tersalin" : "Salin link"}
                  </button>
                  <Link
                    href={url}
                    target="_blank"
                    className="btn-chip btn-chip-ghost"
                  >
                    Buka preview
                  </Link>
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : s.id)}
                    className="btn-chip btn-chip-ghost"
                  >
                    {isOpen ? "Sembunyikan detail" : "Lihat detail"}
                  </button>
                  {canWrite &&
                    (s.status === "completed" || s.status === "in_progress") &&
                    s.overall_score == null && (
                      <button
                        type="button"
                        disabled={busyId === s.id}
                        onClick={() => handleAnalyze(s.id)}
                        className="btn-chip btn-chip-accent"
                      >
                        {busyId === s.id ? "…" : "Hitung skor"}
                      </button>
                    )}
                  {canWrite &&
                    s.status === "completed" &&
                    s.overall_score != null && (
                      <button
                        type="button"
                        disabled={busyId === s.id}
                        onClick={() => handleAnalyze(s.id)}
                        className="btn-chip btn-chip-ghost"
                      >
                        {busyId === s.id ? "…" : "Hitung ulang"}
                      </button>
                    )}
                </div>

                <input
                  readOnly
                  value={url}
                  onFocus={(e) => e.currentTarget.select()}
                  className="mt-3 w-full min-w-0 rounded-lg border border-line bg-mist/50 px-2.5 py-2 text-xs text-ink-soft"
                />

                {points.length > 0 && (
                  <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-ink-soft">
                    {points.map((p, idx) => (
                      <li key={`${s.id}-p-${idx}`} className="leading-relaxed">
                        {p}
                      </li>
                    ))}
                  </ul>
                )}

                {isOpen && (
                  <div className="mt-4 space-y-3 border-t border-line pt-4">
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
                    <div className="rounded-lg border border-line bg-mist/30 p-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                        Pertanyaan AI
                      </p>
                      {questions.length === 0 ? (
                        <p className="text-sm text-muted">
                          Pertanyaan tidak termuat. Refresh halaman.
                        </p>
                      ) : (
                        <ol className="list-decimal space-y-2 pl-5 text-sm text-ink">
                          {questions
                            .slice()
                            .sort((a, b) => a.sort_order - b.sort_order)
                            .map((q) => (
                              <li key={q.id}>
                                <span>{q.question_text}</span>
                                {q.focus_area && (
                                  <span className="ml-2 rounded-md bg-surface px-1.5 py-0.5 text-xs capitalize text-muted">
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
