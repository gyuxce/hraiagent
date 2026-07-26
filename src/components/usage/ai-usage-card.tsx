import type { AiUsageSnapshot } from "@/lib/ai/usage";

type Props = {
  usage: AiUsageSnapshot;
};

function monthLabel(ym?: string) {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return "bulan ini";
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function AiUsageCard({ usage }: Props) {
  if (usage.soft) {
    return (
      <div className="surface-panel mb-8 p-5">
        <p className="page-kicker">Pemakaian AI</p>
        <h2 className="mt-1 font-display text-lg font-bold text-ink">
          Metering belum aktif
        </h2>
        <p className="mt-2 text-sm text-muted">
          Jalankan migration{" "}
          <code className="rounded bg-mist px-1.5 py-0.5 text-xs text-ink">
            00010_ai_usage_metering.sql
          </code>{" "}
          di Supabase untuk mulai menghitung kuota screening/bulan.
        </p>
      </div>
    );
  }

  if (!usage.ok && usage.error) {
    return (
      <div className="mb-8 rounded-xl border border-line bg-accent-soft/40 px-5 py-4 text-sm text-accent-hover">
        Gagal memuat AI usage: {usage.error}
      </div>
    );
  }

  const pct =
    usage.quota > 0
      ? Math.min(100, Math.round((usage.used / usage.quota) * 100))
      : 0;
  const nearLimit = pct >= 80;
  const exhausted = usage.remaining <= 0;

  return (
    <div className="surface-panel mb-8 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 sm:px-6">
        <div>
          <p className="page-kicker">
            Pemakaian AI · {monthLabel(usage.year_month)}
          </p>
          <h2 className="mt-1 font-display text-lg font-bold text-ink">
            Kuota screening bulanan
          </h2>
          <p className="mt-1 text-sm text-muted">
            Plan {usage.plan_tier || "starter"} · 1 unit = 1 panggilan AI
            (CV screen, summary, generate pertanyaan, atau analisis async).
          </p>
        </div>
        <p className="font-display text-2xl font-bold tracking-tight text-ink">
          {usage.used}
          <span className="text-base font-semibold text-muted">
            /{usage.quota}
          </span>
        </p>
      </div>

      <div className="px-5 pb-4 sm:px-6">
        <div className="h-2 overflow-hidden rounded-full bg-mist-deep">
          <div
            className={`h-full rounded-full transition-all ${
              exhausted
                ? "bg-bad"
                : nearLimit
                  ? "bg-warn"
                  : "bg-teal"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p
          className={`mt-2 text-sm ${
            exhausted ? "font-medium text-bad" : "text-muted"
          }`}
        >
          {exhausted
            ? "Kuota habis — AI call berikutnya akan diblok sampai reset bulan depan / upgrade."
            : `${usage.remaining} unit tersisa bulan ini`}
        </p>

        {usage.breakdown && (
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {(
              [
                ["CV screen", usage.breakdown.cv_screen],
                ["Interview summary", usage.breakdown.interview_summary],
                ["Async questions", usage.breakdown.async_question_gen],
                ["Async analyze", usage.breakdown.async_analyze],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-lg bg-mist/70 px-3 py-2">
                <dt className="text-xs text-muted">{label}</dt>
                <dd className="mt-0.5 font-semibold text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}
