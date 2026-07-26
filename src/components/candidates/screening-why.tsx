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
      <div className="h-1.5 overflow-hidden rounded-full bg-mist-deep">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

function pickOne(items: string[] | undefined, fallback: string): string {
  const first = (items || []).find((s) => s && s.trim());
  return first?.trim() || fallback;
}

export function ScreeningWhy({
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
  const [openDetail, setOpenDetail] = useState(false);
  const [openOverride, setOpenOverride] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  const strength = pickOne(breakdown?.strengths, "—");
  const gap = pickOne(breakdown?.gaps, "—");
  const flag = pickOne(
    breakdown?.red_flags,
    breakdown ? "Tidak ada red flag menonjol" : "—"
  );

  return (
    <section className="border-b border-line py-8">
      <p className="page-kicker">Kenapa skor ini</p>
      <h2 className="mt-1 font-display text-xl font-bold text-ink">
        Signal screening
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Rubrik CV vs requirement job — bukan skor interview. Tiga poin utama di
        bawah; detail lengkap bisa dibuka.
      </p>

      {breakdown ? (
        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="space-y-3">
            <Bar label="Must-have" value={breakdown.must_have} />
            <Bar label="Skills" value={breakdown.skills} />
            <Bar label="Experience" value={breakdown.experience} />
            <Bar label="Education" value={breakdown.education} />
          </div>
          <ul className="space-y-3 text-sm">
            <li className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal">
                Strength
              </p>
              <p className="prose-read mt-1 text-ink-soft">{strength}</p>
            </li>
            <li className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-warn">
                Gap
              </p>
              <p className="prose-read mt-1 text-ink-soft">{gap}</p>
            </li>
            <li className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-bad">
                Red flag
              </p>
              <p className="prose-read mt-1 text-ink-soft">{flag}</p>
            </li>
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">
          Belum ada breakdown rubrik. Jalankan AI screening dari daftar kandidat.
        </p>
      )}

      {manualReason && (
        <p className="mt-4 text-sm text-teal">
          Override: {manualReason}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setOpenDetail((v) => !v)}
          className="text-sm font-semibold text-accent hover:text-accent-hover"
        >
          {openDetail ? "Sembunyikan detail AI" : "Lihat detail AI"}
        </button>
        {canWrite && (
          <button
            type="button"
            onClick={() => setOpenOverride((v) => !v)}
            className="text-sm font-semibold text-ink-soft hover:text-ink"
          >
            {openOverride ? "Tutup override" : "Override skor"}
          </button>
        )}
      </div>

      {openDetail && (
        <div className="mt-4 space-y-4 border-t border-line pt-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Ringkasan lengkap
            </p>
            <p className="prose-read mt-2 whitespace-pre-wrap text-ink-soft">
              {summary || "Tidak ada ringkasan."}
            </p>
          </div>
          {breakdown && (
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs font-semibold text-teal">Semua strengths</p>
                <ul className="prose-read mt-1 list-disc space-y-1 pl-4 text-ink-soft">
                  {(breakdown.strengths || []).length ? (
                    breakdown.strengths.map((s) => <li key={s}>{s}</li>)
                  ) : (
                    <li>—</li>
                  )}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-warn">Semua gaps</p>
                <ul className="prose-read mt-1 list-disc space-y-1 pl-4 text-ink-soft">
                  {(breakdown.gaps || []).length ? (
                    breakdown.gaps.map((s) => <li key={s}>{s}</li>)
                  ) : (
                    <li>—</li>
                  )}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-bad">Semua red flags</p>
                <ul className="prose-read mt-1 list-disc space-y-1 pl-4 text-ink-soft">
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

      {openOverride && canWrite && (
        <form
          onSubmit={handleSubmit}
          className="mt-4 space-y-3 border-t border-line pt-4"
        >
          <input type="hidden" name="candidate_id" value={candidateId} />
          {error && (
            <div className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent-hover">
              {error}
            </div>
          )}
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
    </section>
  );
}
