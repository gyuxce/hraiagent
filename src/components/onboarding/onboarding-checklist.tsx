"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { BRAND } from "@/lib/brand";

export type OnboardingProgress = {
  hasClient: boolean;
  hasJob: boolean;
  hasCandidate: boolean;
};

type Props = {
  progress: OnboardingProgress;
};

const STORAGE_KEY = "cullr_onboarding_dismissed";
const LEGACY_STORAGE_KEY = "saring_onboarding_dismissed";

const STEPS = [
  {
    key: "client" as const,
    title: "Tambah client company",
    description: "Daftarkan perusahaan klien yang Anda layani.",
    href: "/clients",
    cta: "Ke Clients",
    done: (p: OnboardingProgress) => p.hasClient,
  },
  {
    key: "job" as const,
    title: "Buat job requisition",
    description: "Tulis lowongan + requirement agar AI bisa men-score CV.",
    href: "/jobs",
    cta: "Ke Jobs",
    done: (p: OnboardingProgress) => p.hasJob,
  },
  {
    key: "candidate" as const,
    title: "Upload / import kandidat pertama",
    description: "Upload CV (PDF/DOCX) atau import CSV, lalu jalankan screening.",
    href: "/candidates",
    cta: "Ke Candidates",
    done: (p: OnboardingProgress) => p.hasCandidate,
  },
];

export function OnboardingChecklist({ progress }: Props) {
  // null = belum hydrate; hindari flash checklist yang sudah di-dismiss
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const current = localStorage.getItem(STORAGE_KEY) === "1";
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY) === "1";
      setDismissed(current || legacy);
    } catch {
      setDismissed(false);
    }
  }, []);

  const completed = STEPS.filter((s) => s.done(progress)).length;
  const allDone = completed === STEPS.length;

  if (dismissed === null || dismissed || allDone) return null;

  const next = STEPS.find((s) => !s.done(progress));

  return (
    <div className="surface-panel mb-8 overflow-hidden">
      <div className="border-b border-line bg-paper/80 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="page-kicker">Mulai dengan {BRAND.name}</p>
            <h2 className="mt-1 font-display text-xl font-bold text-ink">
              3 langkah setup agency
            </h2>
            <p className="mt-1 text-sm text-muted">
              {BRAND.slogan} Selesaikan checklist ini untuk alur inti jalan.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold text-ink-soft">
              {completed}/3 selesai
            </p>
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.setItem(STORAGE_KEY, "1");
                } catch {
                  /* ignore */
                }
                setDismissed(true);
              }}
              className="text-xs font-medium text-muted hover:text-ink"
            >
              Sembunyikan
            </button>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-mist-deep">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${(completed / 3) * 100}%` }}
          />
        </div>
      </div>

      <ol className="divide-y divide-line">
        {STEPS.map((step, index) => {
          const done = step.done(progress);
          const isNext = next?.key === step.key;
          return (
            <li
              key={step.key}
              className={`flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 ${
                isNext ? "bg-accent-soft/40" : ""
              }`}
            >
              <div className="flex min-w-0 items-start gap-3">
                <div
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    done
                      ? "bg-teal text-white"
                      : isNext
                        ? "bg-accent text-white"
                        : "bg-mist text-muted"
                  }`}
                >
                  {done ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span className="text-xs font-bold">{index + 1}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p
                    className={`text-sm font-semibold ${
                      done ? "text-muted line-through" : "text-ink"
                    }`}
                  >
                    {step.title}
                  </p>
                  <p className="mt-0.5 text-sm text-muted">{step.description}</p>
                </div>
              </div>
              {!done && (
                <Link
                  href={step.href}
                  className={isNext ? "btn-primary shrink-0" : "btn-secondary shrink-0"}
                >
                  {step.cta}
                </Link>
              )}
              {done && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal">
                  <Check className="h-3.5 w-3.5" /> Selesai
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
