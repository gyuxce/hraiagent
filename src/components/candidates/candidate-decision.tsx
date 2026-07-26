"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateCandidateStatus } from "@/lib/actions/candidates";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EditContactForm } from "@/components/candidates/edit-contact-form";
import { CHIP, scoreChipClass } from "@/lib/brand-palette";
import { summaryPoints } from "@/lib/cv/summary-points";

type Props = {
  candidateId: string;
  name: string;
  email: string;
  phone: string | null;
  jobLabel: string;
  status: string;
  score: number | null;
  isManualScore: boolean;
  decisionLine: string;
  jobId: string | null;
  canWrite: boolean;
};

function decisionTone(score: number | null): {
  wrap: string;
  label: string;
} {
  if (score == null) {
    return { wrap: CHIP.neutral, label: "Belum di-screen" };
  }
  if (score >= 70) {
    return { wrap: CHIP.good, label: "Lanjut (tahap interview)" };
  }
  if (score >= 60) {
    return { wrap: CHIP.navy, label: "Bisa interview dengan catatan" };
  }
  if (score >= 40) {
    return { wrap: CHIP.warn, label: "Lemah / cadangan" };
  }
  return { wrap: CHIP.bad, label: "Kurang cocok" };
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
  const tone = decisionTone(score);
  const points = summaryPoints(decisionLine, 3);

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
          {canWrite && (
            <div className="mt-2">
              <EditContactForm
                candidateId={candidateId}
                name={name}
                email={email}
                phone={phone}
              />
            </div>
          )}
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

      <div className="surface-panel mt-5 overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[16rem] text-left text-sm">
            <tbody className="divide-y divide-line">
              <tr>
                <th className="w-[30%] px-4 py-2.5 text-xs font-medium text-muted">
                  Lowongan
                </th>
                <td className="px-4 py-2.5 text-ink">{jobLabel || "—"}</td>
              </tr>
              <tr>
                <th className="px-4 py-2.5 text-xs font-medium text-muted">
                  Status
                </th>
                <td className="px-4 py-2.5 capitalize text-ink">{status}</td>
              </tr>
              <tr>
                <th className="px-4 py-2.5 text-xs font-medium text-muted">
                  Skor CV
                </th>
                <td className="px-4 py-2.5">
                  <span
                    className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${scoreChipClass(score)}`}
                  >
                    {score != null ? `${score}/100` : "—"}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {points.length > 0 ? (
        <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-ink-soft">
          {points.map((p, i) => (
            <li key={`d-${i}`} className="leading-relaxed">
              {p}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted">
          Belum ada ringkasan AI — jalankan screening dulu.
        </p>
      )}

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
              className="btn-danger disabled:opacity-50"
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
