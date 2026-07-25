import { createClient } from "@/lib/supabase/server";
import { ensureUserHasAgency } from "@/lib/actions/agency";
import { ReportsClient } from "@/components/reports/reports-client";
import { AiUsageCard } from "@/components/usage/ai-usage-card";
import { getAgencyAiUsage } from "@/lib/ai/usage";
import { isClientViewer } from "@/lib/auth/roles";
import type { ClientCompany } from "@/types/database";

export default async function ReportsPage() {
  const supabase = await createClient();
  const ensured = await ensureUserHasAgency();

  if (ensured.error && !ensured.profile?.agency_id) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        {ensured.error}
      </div>
    );
  }

  const viewer = isClientViewer(ensured.profile);

  const [{ data: clients }, { data: jobs }, { data: candidates }, aiUsage] =
    await Promise.all([
      supabase
        .from("client_companies")
        .select("*")
        .order("name", { ascending: true }),
      supabase.from("job_requisitions").select("id, client_id, status"),
      supabase.from("candidates").select("id, job_id, status, ai_score"),
      viewer
        ? Promise.resolve(null)
        : getAgencyAiUsage(supabase, ensured.profile?.agency_id || undefined),
    ]);

  const jobClient = new Map((jobs || []).map((j) => [j.id, j.client_id]));
  const openJobsByClient = new Map<string, number>();
  for (const j of jobs || []) {
    if (j.status !== "open") continue;
    openJobsByClient.set(j.client_id, (openJobsByClient.get(j.client_id) || 0) + 1);
  }

  const candByClient = new Map<
    string,
    { total: number; pipeline: number; scores: number[] }
  >();

  for (const c of candidates || []) {
    const clientId = jobClient.get(c.job_id);
    if (!clientId) continue;
    const row = candByClient.get(clientId) || {
      total: 0,
      pipeline: 0,
      scores: [],
    };
    row.total += 1;
    if (c.status !== "hired" && c.status !== "rejected") row.pipeline += 1;
    if (c.ai_score != null) row.scores.push(c.ai_score);
    candByClient.set(clientId, row);
  }

  const stats = (clients || []).map((client) => {
    const c = candByClient.get(client.id);
    const avg =
      c && c.scores.length > 0
        ? Math.round(c.scores.reduce((a, b) => a + b, 0) / c.scores.length)
        : null;
    return {
      id: client.id,
      name: client.name,
      openJobs: openJobsByClient.get(client.id) || 0,
      candidates: c?.total || 0,
      inPipeline: c?.pipeline || 0,
      avgScore: avg,
    };
  });

  return (
    <div>
      {aiUsage && <AiUsageCard usage={aiUsage} />}
      <ReportsClient
        clients={(clients || []) as ClientCompany[]}
        stats={stats}
      />
    </div>
  );
}
