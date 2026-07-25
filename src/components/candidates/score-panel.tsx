"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { overrideCandidateScore } from "@/lib/actions/candidates";
import type { ScoreBreakdown } from "@/lib/ai/openrouter";
import { useToast } from "@/components/ui/toast";

type Props = {
  candidateId: string;
  aiScore: number | null;
  manualScore: number | null;
  manualReason: string | null;
  summary: string | null;
  breakdown: ScoreBreakdown | null;
  canWrite: boolean;
};

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-ink-soft">{label}</span>
        <span className="text-muted">{value}/100</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-mist-deep">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

export function ScorePanel({
  candidateId,
  aiScore,
  manualScore,
  manualReason,
  summary,
  breakdown,
  canWrite,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const effective = manualScore ?? aiScore;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await overrideCandidateScore(new FormData(e.currentTarget));
    setLoading(false);
    if (result.error) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    toast.success("Override skor disimpan");
    router.refresh();
  }

  async function handleClear() {
    setLoading(true);
    setError(null);
    const fd = new FormData();
    fd.set("candidate_id", candidateId);
    fd.set("clear", "true");
    const result = await overrideCandidateScore(fd);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    toast.success("Kembali ke skor AI");
    router.refresh();
  }

  return (
    <div className="surface-panel p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-ink">
            Screening Score
          </h2>
          <p className="text-sm text-muted">
            {manualScore != null
              ? "Skor efektif dari override recruiter"
              : "Skor AI dari rubrik ketat (boleh di-override)"}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-3xl font-bold text-ink">
            {effective != null ? effective : "—"}
            <span className="text-base font-semibold text-muted">/100</span>
          </p>
          <p className="text-xs text-muted">
            {manualScore != null
              ? `Manual · AI ${aiScore ?? "—"}`
              : aiScore != null
                ? "Sumber: AI"
                : "Belum di-screen"}
          </p>
        </div>
      </div>

      <p className="mb-4 whitespace-pre-wrap text-sm text-ink-soft">
        {summary || "Belum ada AI screening."}
      </p>

      {breakdown && (
        <div className="mb-5 space-y-3 rounded-xl border border-line bg-mist/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Breakdown rubrik
          </p>
          <Bar label="Must-have (40%)" value={breakdown.must_have} />
          <Bar label="Skills (25%)" value={breakdown.skills} />
          <Bar label="Experience (25%)" value={breakdown.experience} />
          <Bar label="Education (10%)" value={breakdown.education} />
          {(breakdown.strengths?.length > 0 ||
            breakdown.gaps?.length > 0 ||
            breakdown.red_flags?.length > 0) && (
            <div className="grid gap-3 pt-2 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs font-semibold text-teal">Strengths</p>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-ink-soft">
                  {(breakdown.strengths || []).map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-warn">Gaps</p>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-ink-soft">
                  {(breakdown.gaps || []).map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-bad">Red flags</p>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-ink-soft">
                  {(breakdown.red_flags || []).length ? (
                    breakdown.red_flags.map((s) => <li key={s}>{s}</li>)
                  ) : (
                    <li>Tidak ada</li>
                  )}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {manualReason && (
        <div className="mb-4 rounded-lg bg-teal-soft px-3 py-2 text-sm text-teal">
          Alasan override: {manualReason}
        </div>
      )}

      {error && (
        <div className="mb-3 rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent-hover">
          {error}
        </div>
      )}

      {canWrite && (
        <form onSubmit={handleSubmit} className="space-y-3 border-t border-line pt-4">
          <input type="hidden" name="candidate_id" value={candidateId} />
          <p className="text-sm font-semibold text-ink">Override manual</p>
          <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
            <div>
              <label className="block text-xs font-medium text-muted">Skor</label>
              <input
                name="manual_score"
                type="number"
                min={0}
                max={100}
                defaultValue={manualScore ?? aiScore ?? ""}
                required
                className="field-input"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted">
                Alasan
              </label>
              <input
                name="manual_score_reason"
                required
                minLength={5}
                defaultValue={manualReason || ""}
                placeholder="Contoh: must-have React terbukti di project X"
                className="field-input"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary disabled:opacity-50"
            >
              {loading ? "Menyimpan..." : "Simpan override"}
            </button>
            {manualScore != null && (
              <button
                type="button"
                disabled={loading}
                onClick={handleClear}
                className="btn-secondary disabled:opacity-50"
              >
                Pakai skor AI lagi
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
