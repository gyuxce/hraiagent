"use server";

import { revalidatePath } from "next/cache";
import { canWriteAgencyData } from "@/lib/auth/roles";
import { normalizeHeaderAliases, parseCsv } from "@/lib/csv/parse";
import { requireAgencyContext } from "@/lib/auth/agency-context";

function formatError(error: unknown): string {
  if (!error) return "Terjadi kesalahan";
  if (typeof error === "string") return error;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null) {
    const e = error as Record<string, unknown>;
    if (typeof e.message === "string" && e.message) return e.message;
  }
  return "Terjadi kesalahan";
}

const VALID_STATUS = new Set([
  "submitted",
  "screened",
  "interview",
  "offer",
  "hired",
  "rejected",
]);

export async function importCandidatesFromCsv(formData: FormData) {
  const {
    supabase,
    error: authError,
    profile,
  } = await requireAgencyContext();
  if (authError || !profile) {
    return { error: authError || "Unauthorized" };
  }
  if (!canWriteAgencyData(profile)) {
    return { error: "Client viewer tidak bisa import kandidat" };
  }

  const agencyId = profile.agency_id;
  const file = formData.get("file") as File | null;
  const defaultJobId = String(formData.get("job_id") || "").trim() || null;

  if (!file || file.size === 0) {
    return { error: "File CSV wajib diupload" };
  }
  if (file.size > 2 * 1024 * 1024) {
    return { error: "Ukuran CSV maksimal 2MB" };
  }

  const fileName = file.name.toLowerCase();
  if (
    !fileName.endsWith(".csv") &&
    file.type &&
    !file.type.includes("csv") &&
    file.type !== "text/plain"
  ) {
    return { error: "Format harus .csv (export dari Excel/Google Sheets)" };
  }

  const text = await file.text();
  const { rows } = parseCsv(text);
  if (rows.length === 0) {
    return { error: "CSV kosong atau header tidak terbaca" };
  }
  if (rows.length > 500) {
    return { error: "Maksimal 500 baris per import" };
  }

  const { data: jobs, error: jobsError } = await supabase
    .from("job_requisitions")
    .select("id, title")
    .eq("agency_id", agencyId);

  if (jobsError) return { error: formatError(jobsError) };

  const jobIds = new Set((jobs || []).map((j) => j.id as string));
  const byTitle = new Map(
    (jobs || []).map((j) => [j.title.trim().toLowerCase(), j.id as string])
  );

  if (defaultJobId && !jobIds.has(defaultJobId)) {
    return { error: "Job default tidak valid" };
  }

  type Prepared = {
    job_id: string;
    agency_id: string;
    name: string;
    email: string;
    phone: string | null;
    status: string;
  };

  const prepared: Prepared[] = [];
  const rowErrors: string[] = [];

  rows.forEach((raw, idx) => {
    const line = idx + 2;
    const n = normalizeHeaderAliases(raw);
    if (!n.name) {
      rowErrors.push(`Baris ${line}: nama wajib`);
      return;
    }
    if (!n.email || !n.email.includes("@")) {
      rowErrors.push(`Baris ${line}: email tidak valid`);
      return;
    }

    let jobId = defaultJobId;
    if (n.job) {
      jobId = byTitle.get(n.job.toLowerCase()) || null;
      if (!jobId) {
        rowErrors.push(
          `Baris ${line}: job "${n.job}" tidak ditemukan di agency`
        );
        return;
      }
    }
    if (!jobId) {
      rowErrors.push(
        `Baris ${line}: kolom job kosong dan tidak ada job default`
      );
      return;
    }

    const status = n.status.toLowerCase();
    prepared.push({
      job_id: jobId,
      agency_id: agencyId,
      name: n.name,
      email: n.email.toLowerCase(),
      phone: n.phone || null,
      status: VALID_STATUS.has(status) ? status : "submitted",
    });
  });

  if (prepared.length === 0) {
    return {
      error:
        "Tidak ada baris valid. " +
        (rowErrors.slice(0, 3).join("; ") ||
          "Pastikan header: name,email,phone,job,status"),
    };
  }

  const { data: inserted, error } = await supabase
    .from("candidates")
    .insert(prepared)
    .select("id");

  if (error) return { error: formatError(error) };

  revalidatePath("/candidates");
  revalidatePath("/dashboard");
  revalidatePath("/reports");

  return {
    success: true,
    imported: inserted?.length || prepared.length,
    skipped: rowErrors.length,
    warnings: rowErrors.slice(0, 8),
  };
}
