"use server";

import { revalidatePath } from "next/cache";
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

async function getCurrentProfile() {
  return requireAgencyContext();
}

export async function createClientCompany(formData: FormData) {
  const { supabase, error: authError, profile } = await getCurrentProfile();
  if (authError || !profile) return { error: authError || "Unauthorized" };

  const name = String(formData.get("name") || "").trim();
  const industry = String(formData.get("industry") || "").trim() || null;
  const contactEmail = String(formData.get("contact_email") || "").trim() || null;
  const contactPhone = String(formData.get("contact_phone") || "").trim() || null;

  if (!name) return { error: "Nama perusahaan wajib diisi" };

  const { error } = await supabase.from("client_companies").insert({
    agency_id: profile.agency_id,
    name,
    industry,
    contact_email: contactEmail,
    contact_phone: contactPhone,
  });

  if (error) return { error: formatError(error) };

  revalidatePath("/clients");
  return { success: true };
}

export async function updateClientCompany(id: string, formData: FormData) {
  const { supabase, error: authError } = await getCurrentProfile();
  if (authError) return { error: authError };

  const name = String(formData.get("name") || "").trim();
  const industry = String(formData.get("industry") || "").trim() || null;
  const contactEmail = String(formData.get("contact_email") || "").trim() || null;
  const contactPhone = String(formData.get("contact_phone") || "").trim() || null;

  if (!id) return { error: "ID client tidak valid" };
  if (!name) return { error: "Nama perusahaan wajib diisi" };

  const { error } = await supabase
    .from("client_companies")
    .update({
      name,
      industry,
      contact_email: contactEmail,
      contact_phone: contactPhone,
    })
    .eq("id", id);

  if (error) return { error: formatError(error) };

  revalidatePath("/clients");
  return { success: true };
}

export async function deleteClientCompany(id: string) {
  const { supabase, error: authError, profile } = await getCurrentProfile();
  if (authError || !profile) return { error: authError || "Unauthorized" };

  if (profile.role !== "admin_agency") {
    return { error: "Hanya admin yang bisa menghapus client" };
  }

  if (!id) return { error: "ID client tidak valid" };

  const { error } = await supabase
    .from("client_companies")
    .delete()
    .eq("id", id);

  if (error) return { error: formatError(error) };

  revalidatePath("/clients");
  return { success: true };
}
