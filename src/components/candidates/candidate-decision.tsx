"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateCandidateStatus } from "@/lib/actions/candidates";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Props = {
  candidateId: string;
  name: string;
  email: string;
  phone: string | null;
  jobLabel: string;
  status: string;
  score: number | null;
  isManualScore: boolean;
  /** One-line decision hint from AI summary */
  decisionLine: string;
  jobId: string | null;
  canWrite: boolean;
};

function scoreTone(score: number | null): {
  wrap: string;
  label: string;
} {
  if (score == null) {
    return { wrap: "bg-mist text-muted", label: "Belum di-screen" };
  }
  if (score >= 75) {
    return { wrap: "bg-teal-soft text-teal", label: "Layak lanjut interview" };
  }
  if (score >= 50) {
    return {
      wrap: "bg-mist-deep text-ink-soft",
      label: "Pertimbangkan dengan hati-hati",
    };
  }
  return { wrap: "bg-accent-soft text-accent-hover", label: "Kurang cocok" };
}

export function CandidateDecision({
  candidateId,
  name,
  email,
  phone,
  jobLabel,
  status,
  score,
  isManualScore,
  decisionLine,
  jobId,
  canWrite,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [confirmReject, setConfirmReject] = useState(false);
  const tone = scoreTone(score);

  function setStatus(next: string, okMsg: string) {
    startTransition(async () => {
      const res = await updateCandidateStatus(candidateId, next);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(okMsg);
      router.refresh();
    });
  }

  return (
    <section className="border-b border-line pb-8">
      <p className="page-kicker">Putusan screening</p>
      <div className="mt-2 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="page-title break-words">{name}</h1>
          <p className="page-sub break-words">
            {email}
            {phone ? ` · ${phone}` : ""}
          </p>
          <p className="mt-1 text-sm text-ink-soft">{jobLabel}</p>
          <p className="mt-1 text-xs capitalize text-muted">Status: {status}</p>
        </div>

        <div className="shrink-0 text-left lg:text-right">
          <p className="font-display text-5xl font-bold tracking-tight text-ink">
            {score != null ? score : "—"}
            <span className="text-xl font-semibold text-muted">/100</span>
          </p>
          <p className="mt-1 text-xs text-muted">
            Screening CV{isManualScore ? " · override manual" : ""}
          </p>
          <span
            className={`mt-2 inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${tone.wrap}`}
          >
            {tone.label}
          </span>
        </div>
      </div>

      <p className="prose-read mt-5 max-w-3xl text-ink-soft">
        {decisionLine || "Belum ada ringkasan AI — jalankan screening dulu."}
      </p>

      {canWrite && (
        <div className="mt-6 flex flex-wrap gap-2">
          <a href="#async-interview" className="btn-primary">
            Lanjut interview
          </a>
          {jobId && (
            <Link href={`/compare?job=${jobId}`} className="btn-secondary">
              Bandingkan
            </Link>
          )}
          {status !== "rejected" ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirmReject(true)}
              className="btn-secondary text-bad disabled:opacity-50"
            >
              Tolak
            </button>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                setStatus("screened", "Status dikembalikan ke screened")
              }
              className="btn-secondary disabled:opacity-50"
            >
              Batalkan tolak
            </button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmReject}
        title="Tolak kandidat?"
        description={`${name} akan ditandai rejected. Anda masih bisa mengubah status nanti.`}
        confirmLabel="Ya, tolak"
        cancelLabel="Batal"
        loading={pending}
        onCancel={() => setConfirmReject(false)}
        onConfirm={() => {
          setConfirmReject(false);
          setStatus("rejected", "Kandidat ditolak");
        }}
      />
    </section>
  );
}
