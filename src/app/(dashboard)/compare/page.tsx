import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ensureUserHasAgency } from "@/lib/actions/agency";
import { CompareClient } from "@/components/candidates/compare-client";

type Props = {
  searchParams: Promise<{ job?: string }>;
};

export default async function ComparePage({ searchParams }: Props) {
  const { job: jobId } = await searchParams;
  const supabase = await createClient();
  const ensured = await ensureUserHasAgency();

  if (ensured.error && !ensured.profile?.agency_id) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        {ensured.error}
      </div>
    );
  }

  const { data: jobs } = await supabase
    .from("job_requisitions")
    .select("id, title, status, client_companies(name)")
    .order("created_at", { ascending: false });

  const selectedJobId = jobId || jobs?.[0]?.id || "";

  let candidates: unknown[] = [];
  let interviewNotes: unknown[] = [];
  let selectedJob = null;

  if (selectedJobId) {
    const [{ data: job }, { data: cands }, { data: notes }] = await Promise.all([
      supabase
        .from("job_requisitions")
        .select("id, title, description, requirements, client_companies(name)")
        .eq("id", selectedJobId)
        .single(),
      supabase
        .from("candidates")
        .select("*")
        .eq("job_id", selectedJobId)
        .order("ai_score", { ascending: false, nullsFirst: false }),
      supabase
        .from("interview_notes")
        .select("id, candidate_id, title, ai_summary, conducted_at")
        .order("conducted_at", { ascending: false }),
    ]);
    selectedJob = job;
    candidates = cands || [];
    interviewNotes = notes || [];
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Bandingkan Kandidat
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Side-by-side AI score, summary CV, dan ringkasan interview untuk satu
          lowongan
        </p>
      </div>

      <CompareClient
        jobs={(jobs || []) as {
          id: string;
          title: string;
          status: string;
          client_companies?: { name: string } | { name: string }[] | null;
        }[]}
        selectedJobId={selectedJobId}
        selectedJob={selectedJob as {
          id: string;
          title: string;
          description: string;
          requirements: string[];
          client_companies?: { name: string } | { name: string }[] | null;
        } | null}
        candidates={
          candidates as {
            id: string;
            name: string;
            email: string;
            ai_score: number | null;
            ai_summary: string | null;
            status: string;
            parsed_data: Record<string, unknown> | null;
          }[]
        }
        interviewNotes={
          interviewNotes as {
            id: string;
            candidate_id: string;
            title: string;
            ai_summary: string | null;
            conducted_at: string;
          }[]
        }
      />

      {!jobs?.length && (
        <div className="mt-6 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
          Belum ada job.{" "}
          <Link href="/jobs" className="font-semibold underline">
            Buat job dulu
          </Link>
        </div>
      )}
    </div>
  );
}
