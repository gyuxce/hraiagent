"use client";

import { useState } from "react";
import { exportClientCandidatesCsv } from "@/lib/actions/reports";
import type { ClientCompany } from "@/types/database";

type ClientStat = {
  id: string;
  name: string;
  openJobs: number;
  candidates: number;
  avgScore: number | null;
  inPipeline: number;
};

type Props = {
  clients: ClientCompany[];
  stats: ClientStat[];
};

export function ReportsClient({ clients, stats }: Props) {
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    if (!clientId) return;
    setBusy(true);
    setError(null);
    const result = await exportClientCandidatesCsv(clientId);
    setBusy(false);
    if (result.error || !result.csv) {
      setError(result.error || "Gagal export");
      return;
    }
    const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.filename || "report.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="mt-1 text-sm text-gray-500">
          Ringkasan per klien dan export progress kandidat (CSV)
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">
          Export progress ke klien
        </h2>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className="block text-sm font-medium text-gray-700">
              Client
            </label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={busy || !clientId}
            onClick={handleExport}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {busy ? "Mengexport..." : "Download CSV"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-900">
            Performa multi-klien
          </h2>
        </div>
        {stats.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-gray-500">
            Belum ada data klien.
          </p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Open Jobs
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Kandidat
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Pipeline
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Avg AI Score
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {stats.map((s) => (
                <tr key={s.id}>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {s.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{s.openJobs}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {s.candidates}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {s.inPipeline}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {s.avgScore != null ? `${s.avgScore}/100` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
