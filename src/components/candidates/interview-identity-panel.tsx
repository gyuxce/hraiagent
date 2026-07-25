"use client";

import { useEffect, useState } from "react";
import { getInterviewIdentityMedia } from "@/lib/actions/async-interview";

type Props = {
  sessionId: string;
  challengeCode?: string | null;
  challengePassed?: boolean | null;
  faceMatchStatus?: string | null;
  faceMatchNote?: string | null;
  needsManualReview?: boolean | null;
  identitySummary?: string | null;
};

export function InterviewIdentityPanel({
  sessionId,
  challengeCode,
  challengePassed,
  faceMatchStatus,
  faceMatchNote,
  needsManualReview,
  identitySummary,
}: Props) {
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [faceFrameUrl, setFaceFrameUrl] = useState<string | null>(null);
  const [loadedSummary, setLoadedSummary] = useState(identitySummary || null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await getInterviewIdentityMedia(sessionId);
      if (cancelled) return;
      if (res.error || !res.data) {
        setError(res.error || "Gagal muat media identitas");
        return;
      }
      setSelfieUrl(res.data.selfieUrl);
      setFaceFrameUrl(res.data.faceFrameUrl);
      if (res.data.identitySummary) setLoadedSummary(res.data.identitySummary);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const matchLabel =
    faceMatchStatus === "match"
      ? "Mirip"
      : faceMatchStatus === "mismatch"
        ? "Berbeda"
        : faceMatchStatus === "unclear"
          ? "Tidak jelas"
          : faceMatchStatus === "manual" || faceMatchStatus === "skipped"
            ? "Cek manual"
            : faceMatchStatus || "—";

  return (
    <div className="mt-4 rounded-lg border border-line bg-mist/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Pengaman identitas (ringan)
        </p>
        {needsManualReview && (
          <span className="rounded-md bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-hover">
            Perlu review manual
          </span>
        )}
      </div>

      {(loadedSummary || identitySummary) && (
        <p className="mt-2 text-sm text-ink-soft">
          {loadedSummary || identitySummary}
        </p>
      )}

      <div className="mt-3 grid gap-3 text-xs text-muted sm:grid-cols-3">
        <p>
          Kode tantangan:{" "}
          <strong className="text-ink">{challengeCode || "—"}</strong>
          {challengePassed === true && (
            <span className="ml-1 text-teal">· terdeteksi</span>
          )}
          {challengePassed === false && (
            <span className="ml-1 text-bad">· tidak terdeteksi</span>
          )}
        </p>
        <p>
          Face match: <strong className="text-ink">{matchLabel}</strong>
        </p>
        <p className="sm:col-span-1">{faceMatchNote || "—"}</p>
      </div>

      {error && <p className="mt-2 text-xs text-bad">{error}</p>}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-xs text-muted">Selfie awal</p>
          {selfieUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={selfieUrl}
              alt="Selfie kandidat"
              className="aspect-[4/3] w-full rounded-lg object-cover"
            />
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center rounded-lg bg-mist text-xs text-muted">
              Belum ada selfie
            </div>
          )}
        </div>
        <div>
          <p className="mb-1 text-xs text-muted">Frame dari video</p>
          {faceFrameUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={faceFrameUrl}
              alt="Frame wajah dari video"
              className="aspect-[4/3] w-full rounded-lg object-cover"
            />
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center rounded-lg bg-mist text-xs text-muted">
              Belum ada frame
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
