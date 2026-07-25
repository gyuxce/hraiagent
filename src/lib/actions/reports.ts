"use server";

import { createClient } from "@/lib/supabase/server";
import { ensureUserHasAgency } from "@/lib/actions/agency";

function csvEscape(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function exportClientCandidatesCsv(clientId: string) {
  const supabase = await createClient();
  const ensured = await ensureUserHasAgency();
  if (ensured.error || !ensured.profile?.agency_id) {
    return { error: ensured.error || "Unauthorized", csv: null as string | null };
  }

  if (!clientId) {
    return { error: "Client wajib dipilih", csv: null };
  }

  const { data: client, error: clientError } = await supabase
    .from("client_companies")
    .select("id, name")
    .eq("id", clientId)
    .single();

  if (clientError || !client) {
    return { error: "Client tidak ditemukan", csv: null };
  }

  const { data: jobs, error: jobsError } = await supabase
    .from("job_requisitions")
    .select("id, title")
    .eq("client_id", clientId);

  if (jobsError) {
    return { error: jobsError.message, csv: null };
  }

  const jobIds = (jobs || []).map((j) => j.id);
  if (jobIds.length === 0) {
    return { error: "Belum ada job untuk client ini", csv: null };
  }

  const jobTitle = new Map((jobs || []).map((j) => [j.id, j.title]));

  const { data: candidates, error } = await supabase
    .from("candidates")
    .select(
      "name, email, phone, status, ai_score, ai_summary, created_at, job_id"
    )
    .in("job_id", jobIds)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message, csv: null };

  const header = [
    "client",
    "job_title",
    "candidate_name",
    "email",
    "phone",
    "status",
    "ai_score",
    "ai_summary",
    "created_at",
  ];

  const rows = (candidates || []).map((c) =>
    [
      client.name,
      jobTitle.get(c.job_id) || "",
      c.name,
      c.email,
      c.phone || "",
      c.status,
      c.ai_score ?? "",
      c.ai_summary || "",
      c.created_at,
    ]
      .map(csvEscape)
      .join(",")
  );

  const csv = [header.join(","), ...rows].join("\n");
  return {
    error: null,
    csv,
    filename: `report-${client.name.replace(/[^a-zA-Z0-9_-]+/g, "_").toLowerCase()}.csv`,
  };
}
