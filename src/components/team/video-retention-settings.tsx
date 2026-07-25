"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateVideoRetentionDays } from "@/lib/actions/video-retention";
import {
  VIDEO_RETENTION_PRESETS,
  retentionLabel,
} from "@/lib/interview/video-retention";
import { useToast } from "@/components/ui/toast";

type Props = {
  initialDays: number;
  migrationMissing?: boolean;
  loadError?: string | null;
};

export function VideoRetentionSettings({
  initialDays,
  migrationMissing = false,
  loadError = null,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [days, setDays] = useState(initialDays);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(loadError);

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const res = await updateVideoRetentionDays(days);
      if (res.error) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success(
        days === 0
          ? "Auto-hapus video dimatikan"
          : `Video interview dihapus otomatis setelah ${days} hari`
      );
      router.refresh();
    });
  }

  return (
    <div className="surface-panel mb-8 p-5 sm:p-6">
      <p className="page-kicker">Penyimpanan · privacy</p>
      <h2 className="mt-1 font-display text-lg font-bold text-ink">
        Retensi video interview
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Video jawaban, selfie, dan face-frame dihapus otomatis setelah periode
        ini. <strong className="font-semibold text-ink-soft">Skor AI,
        transkrip, dan ringkasan tetap tersimpan</strong> untuk ranking &
        laporan.
      </p>

      {migrationMissing && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Jalankan migration{" "}
          <code className="rounded bg-white/80 px-1.5 py-0.5 text-xs">
            00012_video_retention.sql
          </code>{" "}
          di Supabase SQL Editor sebelum mengatur retensi.
        </div>
      )}

      {error && !migrationMissing && (
        <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="block min-w-[12rem] flex-1">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
            Hapus media setelah
          </span>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            disabled={pending || migrationMissing}
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink disabled:opacity-50"
          >
            {VIDEO_RETENTION_PRESETS.map((d) => (
              <option key={d} value={d}>
                {retentionLabel(d)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={handleSave}
          disabled={pending || migrationMissing || days === initialDays}
          className="btn-primary disabled:opacity-50"
        >
          {pending ? "Menyimpan..." : "Simpan"}
        </button>
      </div>

      <p className="mt-3 text-xs text-muted">
        Default 30 hari. Cron harian membersihkan sesi yang sudah lewat masa
        retensi (butuh{" "}
        <code className="rounded bg-mist px-1 py-0.5">CRON_SECRET</code> +{" "}
        <code className="rounded bg-mist px-1 py-0.5">
          SUPABASE_SERVICE_ROLE_KEY
        </code>{" "}
        di Vercel).
      </p>
    </div>
  );
}
