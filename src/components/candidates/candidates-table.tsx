"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  deleteCandidate,
  rescreenCandidate,
  updateCandidateStatus,
} from "@/lib/actions/candidates";
import {
  CandidateFormModal,
  type JobOption,
} from "./candidate-form-modal";

export type CandidateRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  ai_score: number | null;
  ai_summary: string | null;
  status: string;
  cv_file_path: string | null;
  parsed_data: Record<string, unknown> | null;
  job_id?: string;
  job_requisitions?: {
    id: string;
    title: string;
    client_companies?: { name: string } | null;
  } | null;
};

type Props = {
  candidates: CandidateRow[];
  jobs: JobOption[];
  isAdmin: boolean;
  canWrite?: boolean;
};

const statusOptions = [
  "submitted",
  "screened",
  "interview",
  "offer",
  "hired",
  "rejected",
] as const;

const statusStyle: Record<string, string> = {
  submitted: "bg-gray-100 text-gray-700",
  screened: "bg-blue-50 text-blue-700",
  interview: "bg-purple-50 text-purple-700",
  offer: "bg-amber-50 text-amber-700",
  hired: "bg-green-50 text-green-700",
  rejected: "bg-red-50 text-red-700",
};

function scoreColor(score: number | null) {
  if (score == null) return "bg-gray-100 text-gray-500";
  if (score >= 80) return "bg-green-50 text-green-700";
  if (score >= 60) return "bg-blue-50 text-blue-700";
  if (score >= 40) return "bg-yellow-50 text-yellow-700";
  return "bg-red-50 text-red-700";
}

export function CandidatesTable({
  candidates,
  jobs,
  isAdmin,
  canWrite = true,
}: Props) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleStatus(id: string, status: string) {
    setBusyId(id);
    setError(null);
    const result = await updateCandidateStatus(id, status);
    setBusyId(null);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleRescreen(id: string) {
    setBusyId(id);
    setError(null);
    const result = await rescreenCandidate(id);
    setBusyId(null);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Hapus kandidat "${name}"?`)) return;
    setBusyId(id);
    setError(null);
    const result = await deleteCandidate(id);
    setBusyId(null);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Candidates</h1>
          <p className="mt-1 text-sm text-gray-500">
            Pipeline kandidat + AI screening + interview notes
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/compare"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Bandingkan
          </Link>
          {canWrite && (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors"
            >
              + Tambah Kandidat
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {candidates.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm text-gray-500">Belum ada kandidat.</p>
            {canWrite && (
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-500"
              >
                + Tambah kandidat pertama
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Nama
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Posisi
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    AI Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {candidates.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <Link
                        href={`/candidates/${c.id}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-500"
                      >
                        {c.name}
                      </Link>
                      <div className="text-xs text-gray-500">{c.email}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <div>{c.job_requisitions?.title || "—"}</div>
                      {c.job_requisitions?.client_companies?.name && (
                        <div className="text-xs text-gray-400">
                          {c.job_requisitions.client_companies.name}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${scoreColor(
                          c.ai_score
                        )}`}
                      >
                        {c.ai_score != null ? `${c.ai_score}/100` : "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {canWrite ? (
                        <select
                          value={c.status}
                          disabled={busyId === c.id}
                          onChange={(e) => handleStatus(c.id, e.target.value)}
                          className={`rounded-full border-0 px-2 py-1 text-xs font-medium focus:ring-2 focus:ring-blue-500 ${
                            statusStyle[c.status] || statusStyle.submitted
                          }`}
                        >
                          {statusOptions.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                            statusStyle[c.status] || statusStyle.submitted
                          }`}
                        >
                          {c.status}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/candidates/${c.id}`}
                          className="font-medium text-blue-600 hover:text-blue-500"
                        >
                          Detail
                        </Link>
                        {canWrite && c.cv_file_path && (
                          <button
                            type="button"
                            disabled={busyId === c.id}
                            onClick={() => handleRescreen(c.id)}
                            className="font-medium text-indigo-600 hover:text-indigo-500 disabled:opacity-50"
                          >
                            {busyId === c.id ? "..." : "Re-AI"}
                          </button>
                        )}
                        {canWrite && isAdmin && (
                          <button
                            type="button"
                            disabled={busyId === c.id}
                            onClick={() => handleDelete(c.id, c.name)}
                            className="font-medium text-red-600 hover:text-red-500 disabled:opacity-50"
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

      {canWrite && (
        <CandidateFormModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          jobs={jobs}
        />
      )}
    </div>
  );
}
