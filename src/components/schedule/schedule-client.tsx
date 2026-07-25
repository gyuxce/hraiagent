"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createInterviewSchedule,
  deleteInterviewSchedule,
  updateInterviewScheduleStatus,
} from "@/lib/actions/schedules";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export type ScheduleRow = {
  id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  location: string | null;
  meeting_url: string | null;
  notes: string | null;
  status: string;
  candidates?: { id: string; name: string } | null;
  job_requisitions?: { title: string } | null;
  client_companies?: { name: string } | null;
};

export type CandidateOption = {
  id: string;
  name: string;
  job_requisitions?: { title: string; client_companies?: { name: string } | null } | null;
};

type Props = {
  schedules: ScheduleRow[];
  candidates: CandidateOption[];
  canWrite: boolean;
  isAdmin: boolean;
};

const statusLabel: Record<string, string> = {
  scheduled: "Terjadwal",
  completed: "Selesai",
  cancelled: "Batal",
  no_show: "No-show",
};

function toIcs(schedule: ScheduleRow) {
  const start = new Date(schedule.scheduled_at);
  const end = new Date(
    start.getTime() + (schedule.duration_minutes || 60) * 60000
  );
  const fmt = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");
  const desc = [
    schedule.candidates?.name ? `Kandidat: ${schedule.candidates.name}` : "",
    schedule.job_requisitions?.title
      ? `Job: ${schedule.job_requisitions.title}`
      : "",
    schedule.meeting_url ? `Meeting: ${schedule.meeting_url}` : "",
    schedule.notes || "",
  ]
    .filter(Boolean)
    .join("\\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Saring//Schedule//ID",
    "BEGIN:VEVENT",
    `UID:${schedule.id}@saring.app`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${schedule.title.replace(/\n/g, " ")}`,
    `DESCRIPTION:${desc}`,
    schedule.location ? `LOCATION:${schedule.location}` : "",
    schedule.meeting_url ? `URL:${schedule.meeting_url}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

function downloadIcs(schedule: ScheduleRow) {
  const blob = new Blob([toIcs(schedule)], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${schedule.title.replace(/\s+/g, "_")}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ScheduleClient({
  schedules,
  candidates,
  canWrite,
  isAdmin,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await createInterviewSchedule(new FormData(e.currentTarget));
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    e.currentTarget.reset();
    router.refresh();
  }

  async function handleStatus(id: string, status: string) {
    setBusy(true);
    const result = await updateInterviewScheduleStatus(id, status);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function confirmDelete() {
    if (!pendingDeleteId) return;
    setBusy(true);
    const result = await deleteInterviewSchedule(pendingDeleteId);
    setBusy(false);
    setPendingDeleteId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="page-kicker">Calendar</p>
        <h1 className="page-title">Schedule</h1>
        <p className="page-sub">
          Jadwalkan interview manusia; unduh .ics untuk kalender eksternal
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {canWrite && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4"
        >
          <h2 className="text-sm font-semibold text-gray-900">
            Buat jadwal interview
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">
                Kandidat
              </label>
              <select
                name="candidate_id"
                required
                defaultValue=""
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="" disabled>
                  Pilih kandidat
                </option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.job_requisitions?.title
                      ? ` — ${c.job_requisitions.title}`
                      : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Judul
              </label>
              <input
                name="title"
                required
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="Interview teknis — round 1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Waktu
              </label>
              <input
                name="scheduled_at"
                type="datetime-local"
                required
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Durasi (menit)
              </label>
              <input
                name="duration_minutes"
                type="number"
                min={15}
                max={480}
                defaultValue={60}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Lokasi / Meeting URL
              </label>
              <input
                name="meeting_url"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="https://meet.google.com/..."
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">
                Catatan
              </label>
              <textarea
                name="notes"
                rows={2}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={busy || candidates.length === 0}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            Simpan Jadwal
          </button>
        </form>
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {schedules.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-gray-500">
            Belum ada jadwal interview.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Waktu
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Judul
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Kandidat
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {schedules.map((s) => (
                  <tr key={s.id}>
                    <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">
                      {new Date(s.scheduled_at).toLocaleString("id-ID")}
                      <div className="text-xs text-gray-400">
                        {s.duration_minutes} menit
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="font-medium text-gray-900">{s.title}</div>
                      <div className="text-xs text-gray-500">
                        {s.job_requisitions?.title || "—"}
                        {s.client_companies?.name
                          ? ` · ${s.client_companies.name}`
                          : ""}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {s.candidates?.name || "—"}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {canWrite ? (
                        <select
                          value={s.status}
                          disabled={busy}
                          onChange={(e) => handleStatus(s.id, e.target.value)}
                          className="rounded-full bg-gray-100 px-2 py-1 text-xs"
                        >
                          {Object.keys(statusLabel).map((k) => (
                            <option key={k} value={k}>
                              {statusLabel[k]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-gray-600">
                          {statusLabel[s.status] || s.status}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => downloadIcs(s)}
                          className="font-medium text-blue-600"
                        >
                          .ics
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setPendingDeleteId(s.id)}
                            className="font-medium text-red-600"
                          >
                            Hapus
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(pendingDeleteId)}
        title="Hapus jadwal?"
        description="Jadwal interview ini akan dihapus permanen. Tindakan ini tidak bisa dibatalkan."
        confirmLabel="Ya, hapus"
        loading={busy && Boolean(pendingDeleteId)}
        onCancel={() => {
          if (!busy) setPendingDeleteId(null);
        }}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
