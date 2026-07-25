"use client";

import { useRouter } from "next/navigation";

type Props = {
  jobs: { id: string; label: string }[];
  selectedJobId: string;
};

export function RankingFilters({ jobs, selectedJobId }: Props) {
  const router = useRouter();

  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700">
        Filter Job
      </label>
      <select
        value={selectedJobId}
        onChange={(e) => router.push(`/ranking?job=${e.target.value}`)}
        className="mt-1 block w-full max-w-md rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
      >
        {jobs.map((j) => (
          <option key={j.id} value={j.id}>
            {j.label}
          </option>
        ))}
      </select>
    </div>
  );
}
