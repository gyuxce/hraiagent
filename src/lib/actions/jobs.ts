"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensureUserHasAgency } from "@/lib/actions/agency";

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

function parseRequirements(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function getCurrentProfile() {
  const supabase = await createClient();
  const ensured = await ensureUserHasAgency();

  if (ensured.error || !ensured.profile?.agency_id) {
    return {
      supabase,
      error: (ensured.error || "Akun belum terhubung ke agency") as string,
      profile: null,
    };
  }

  return { supabase, error: null, profile: ensured.profile };
}

export async function createJob(formData: FormData) {
  const { supabase, error: authError, profile } = await getCurrentProfile();
  if (authError || !profile) return { error: authError || "Unauthorized" };

  const clientId = String(formData.get("client_id") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const requirementsRaw = String(formData.get("requirements") || "");
  const status = String(formData.get("status") || "open") as
    | "open"
    | "closed"
    | "on_hold";

  if (!clientId) return { error: "Client wajib dipilih" };
  if (!title) return { error: "Judul posisi wajib diisi" };
  if (!description) return { error: "Deskripsi wajib diisi" };

  const validStatus = ["open", "closed", "on_hold"].includes(status)
    ? status
    : "open";

  const { error } = await supabase.from("job_requisitions").insert({
    client_id: clientId,
    agency_id: profile.agency_id,
    title,
    description,
    requirements: parseRequirements(requirementsRaw),
    status: validStatus,
  });

  if (error) return { error: formatError(error) };

  revalidatePath("/jobs");
  return { success: true };
}

export async function updateJob(id: string, formData: FormData) {
  const { supabase, error: authError } = await getCurrentProfile();
  if (authError) return { error: authError };

  const clientId = String(formData.get("client_id") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const requirementsRaw = String(formData.get("requirements") || "");
  const status = String(formData.get("status") || "open");

  if (!id) return { error: "ID job tidak valid" };
  if (!clientId) return { error: "Client wajib dipilih" };
  if (!title) return { error: "Judul posisi wajib diisi" };
  if (!description) return { error: "Deskripsi wajib diisi" };

  const validStatus = ["open", "closed", "on_hold"].includes(status)
    ? status
    : "open";

  const { error } = await supabase
    .from("job_requisitions")
    .update({
      client_id: clientId,
      title,
      description,
      requirements: parseRequirements(requirementsRaw),
      status: validStatus,
    })
    .eq("id", id);

  if (error) return { error: formatError(error) };

  revalidatePath("/jobs");
  return { success: true };
}

export async function deleteJob(id: string) {
  const { supabase, error: authError, profile } = await getCurrentProfile();
  if (authError || !profile) return { error: authError || "Unauthorized" };

  if (profile.role !== "admin_agency") {
    return { error: "Hanya admin yang bisa menghapus job" };
  }

  if (!id) return { error: "ID job tidak valid" };

  const { error } = await supabase
    .from("job_requisitions")
    .delete()
    .eq("id", id);

  if (error) return { error: formatError(error) };

  revalidatePath("/jobs");
  return { success: true };
}
