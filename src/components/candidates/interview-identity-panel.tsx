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
  mediaPurgedAt?: string | null;
};

function faceMatchLabel(status: string | null | undefined): string {
  if (status === "match") return "Mirip";
  if (status === "mismatch") return "Berbeda";
  if (status === "unclear") return "Tidak jelas";
  if (status === "manual" || status === "skipped") return "Cek manual";
  if (status === "pending") return "Pending";
  return status?.trim() || "—";
}

/** Infer structured fields from summary text when DB columns were not selected. */
function inferFromSummary(summary: string | null | undefined): {
  challengePassed: boolean | null;
  faceMatchStatus: string | null;
} {
  const s = (summary || "").toLowerCase();
  let challengePassed: boolean | null = null;
  if (
    s.includes("kode tantangan disebut") ||
    s.includes("kode tantangan terdeteksi")
  ) {
    challengePassed = true;
  } else if (
    s.includes("kode tantangan tidak") ||
    s.includes("tidak terdeteksi")
  ) {
    challengePassed = false;
  }

  let faceMatchStatus: string | null = null;
  if (s.includes("face match: mirip") || s.includes("face match mirip")) {
    faceMatchStatus = "match";
  } else if (s.includes("berbeda") || s.includes("curiga joki")) {
    faceMatchStatus = "mismatch";
  } else if (s.includes("tidak jelas")) {
    faceMatchStatus = "unclear";
  } else if (s.includes("cek manual")) {
    faceMatchStatus = "manual";
  } else if (s.includes("face match: pending") || s.includes("pending")) {
    faceMatchStatus = "pending";
  }

  return { challengePassed, faceMatchStatus };
}

export function InterviewIdentityPanel({
  sessionId,
  challengeCode: challengeCodeProp,
  challengePassed: challengePassedProp,
  faceMatchStatus: faceMatchStatusProp,
  faceMatchNote: faceMatchNoteProp,
  needsManualReview: needsManualReviewProp,
  identitySummary,
  mediaPurgedAt = null,
}: Props) {
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [faceFrameUrl, setFaceFrameUrl] = useState<string | null>(null);
  const [loadedSummary, setLoadedSummary] = useState(identitySummary || null);
  const [challengeCode, setChallengeCode] = useState(challengeCodeProp || null);
  const [challengePassed, setChallengePassed] = useState<boolean | null>(
    challengePassedProp ?? null
  );
  const [faceMatchStatus, setFaceMatchStatus] = useState<string | null>(
    faceMatchStatusProp || null
  );
  const [faceMatchNote, setFaceMatchNote] = useState(faceMatchNoteProp || null);
  const [needsManualReview, setNeedsManualReview] = useState(
    Boolean(needsManualReviewProp)
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mediaPurgedAt) return;
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
      if (res.data.challengeCode) setChallengeCode(res.data.challengeCode);
      if (res.data.challengePassed != null) {
        setChallengePassed(res.data.challengePassed);
      }
      if (res.data.faceMatchStatus) {
        setFaceMatchStatus(res.data.faceMatchStatus);
      }
      if (res.data.faceMatchNote) setFaceMatchNote(res.data.faceMatchNote);
      if (res.data.needsManualReview != null) {
        setNeedsManualReview(Boolean(res.data.needsManualReview));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, mediaPurgedAt]);

  const summary = loadedSummary || identitySummary || null;
  const inferred = inferFromSummary(summary);
  const passed =
    challengePassed != null ? challengePassed : inferred.challengePassed;
  const matchStatus = faceMatchStatus || inferred.faceMatchStatus;
  const matchLabel = faceMatchLabel(matchStatus);

  const rows: { label: string; value: string; hint?: string }[] = [
    {
      label: "Kode tantangan",
      value: challengeCode || "—",
      hint:
        passed === true
          ? "Terdeteksi di transkrip"
          : passed === false
            ? "Tidak terdeteksi"
            : undefined,
    },
    {
      label: "Face match",
      value: matchLabel,
    },
    {
      label: "Selfie",
      value: mediaPurgedAt
        ? "Dihapus (retensi)"
        : selfieUrl
          ? "Ada"
          : "Belum ada",
    },
  ];

  return (
    <div className="mt-4 rounded-lg border border-line bg-mist/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Pengaman identitas
        </p>
        {needsManualReview && (
          <span className="rounded-md bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-hover">
            Perlu review manual
          </span>
        )}
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[16rem] text-left text-xs">
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr key={row.label}>
                <th className="w-[40%] py-2 pr-3 font-medium text-muted">
                  {row.label}
                </th>
                <td className="py-2 text-ink">
                  <strong className="font-semibold">{row.value}</strong>
                  {row.hint && (
                    <span className="ml-1.5 text-secondary">{row.hint}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {faceMatchNote && (
        <p className="prose-read mt-2 rounded-md bg-surface px-3 py-2 text-xs text-ink-soft">
          {faceMatchNote}
        </p>
      )}

      {error && !mediaPurgedAt && (
        <p className="mt-2 text-xs text-bad">{error}</p>
      )}

      {mediaPurgedAt ? (
        <p className="mt-3 rounded-lg bg-mist px-3 py-2 text-xs text-muted">
          Selfie & frame video sudah dihapus sesuai kebijakan retensi (
          {new Date(mediaPurgedAt).toLocaleDateString("id-ID")}). Status
          identitas di atas tetap tersimpan.
        </p>
      ) : (
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
      )}
    </div>
  );
}
