"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { overrideCandidateScore } from "@/lib/actions/candidates";
import type { ScoreBreakdown } from "@/lib/ai/openrouter";
import { useToast } from "@/components/ui/toast";
import { summaryPoints } from "@/lib/cv/summary-points";

type Props = {
  candidateId: string;
  aiScore: number | null;
  manualScore: number | null;
  manualReason: string | null;
  summary: string | null;
  breakdown: ScoreBreakdown | null;
  canWrite: boolean;
};

function pickList(items: string[] | undefined, fallback: string): string[] {
  const list = (items || []).map((s) => s.trim()).filter(Boolean);
  return list.length ? list.slice(0, 3) : [fallback];
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

  const rubricRows = breakdown
    ? [
        { label: "Must-have", value: breakdown.must_have },
        { label: "Skills", value: breakdown.skills },
        { label: "Experience", value: breakdown.experience },
        { label: "Education", value: breakdown.education },
      ]
    : [];

  const signalRows = breakdown
    ? [
        {
          label: "Strength",
          tone: "text-secondary-hover",
          points: pickList(breakdown.strengths, "—"),
        },
        {
          label: "Gap",
          tone: "text-accent-hover",
          points: pickList(breakdown.gaps, "—"),
        },
        {
          label: "Red flag",
          tone: "text-bad",
          points: pickList(
            breakdown.red_flags,
            "Tidak ada red flag menonjol"
          ),
        },
      ]
    : [];

  const summaryBullets = summaryPoints(summary, 3);

  return (
    <section className="border-b border-line py-8">
      <p className="page-kicker">Kenapa skor ini</p>
      <h2 className="mt-1 font-display text-xl font-bold text-ink">
        Signal screening
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Rubrik CV vs requirement job — bukan skor interview.
      </p>

      {breakdown ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="surface-panel overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[16rem] text-left text-sm">
                <thead className="bg-mist/70">
                  <tr>
                    <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted">
                      Rubrik
                    </th>
                    <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted">
                      Skor
                    </th>
                    <th className="hidden px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted sm:table-cell">
                      Signal
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rubricRows.map((row) => (
                    <tr key={row.label}>
                      <td className="px-4 py-2.5 font-medium text-ink">
                        {row.label}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-ink-soft">
                        {row.value}/100
                      </td>
                      <td className="hidden px-4 py-2.5 sm:table-cell">
                        <div className="h-1.5 max-w-[8rem] overflow-hidden rounded-full bg-mist-deep">
                          <div
                            className="h-full rounded-full bg-accent"
                            style={{
                              width: `${Math.max(0, Math.min(100, row.value))}%`,
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="surface-panel overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[16rem] text-left text-sm">
                <thead className="bg-mist/70">
                  <tr>
                    <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted">
                      Sinyal
                    </th>
                    <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted">
                      Poin
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {signalRows.map((row) => (
                    <tr key={row.label}>
                      <th
                        className={`w-[30%] px-4 py-2.5 align-top text-xs font-semibold uppercase tracking-wide ${row.tone}`}
                      >
                        {row.label}
                      </th>
                      <td className="px-4 py-2.5 text-ink-soft">
                        <ul className="list-disc space-y-1 pl-4">
                          {row.points.map((p, i) => (
                            <li key={`${row.label}-${i}`}>{p}</li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">
          Belum ada breakdown rubrik. Hitung skor dari daftar kandidat.
        </p>
      )}

      {manualReason && (
        <p className="mt-4 text-sm text-secondary-hover">
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
              Ringkasan AI
            </p>
            {summaryBullets.length ? (
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-ink-soft">
                {summaryBullets.map((p, i) => (
                  <li key={`sum-${i}`}>{p}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">Tidak ada ringkasan.</p>
            )}
          </div>
          {breakdown && (
            <div className="surface-panel overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[18rem] text-left text-sm">
                  <thead className="bg-mist/70">
                    <tr>
                      <th className="px-4 py-2.5 text-xs font-semibold uppercase text-secondary-hover">
                        Strengths
                      </th>
                      <th className="px-4 py-2.5 text-xs font-semibold uppercase text-accent-hover">
                        Gaps
                      </th>
                      <th className="px-4 py-2.5 text-xs font-semibold uppercase text-bad">
                        Red flags
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="align-top">
                      <td className="px-4 py-3 text-ink-soft">
                        <ul className="list-disc space-y-1 pl-4">
                          {(breakdown.strengths || []).length ? (
                            breakdown.strengths.map((s) => (
                              <li key={s}>{s}</li>
                            ))
                          ) : (
                            <li>—</li>
                          )}
                        </ul>
                      </td>
                      <td className="px-4 py-3 text-ink-soft">
                        <ul className="list-disc space-y-1 pl-4">
                          {(breakdown.gaps || []).length ? (
                            breakdown.gaps.map((s) => <li key={s}>{s}</li>)
                          ) : (
                            <li>—</li>
                          )}
                        </ul>
                      </td>
                      <td className="px-4 py-3 text-ink-soft">
                        <ul className="list-disc space-y-1 pl-4">
                          {(breakdown.red_flags || []).length ? (
                            breakdown.red_flags.map((s) => (
                              <li key={s}>{s}</li>
                            ))
                          ) : (
                            <li>Tidak ada</li>
                          )}
                        </ul>
                      </td>
                    </tr>
                  </tbody>
                </table>
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
