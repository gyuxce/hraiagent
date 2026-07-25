"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensureUserHasAgency } from "@/lib/actions/agency";
import type { UserRole } from "@/types/database";

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

async function requireAdmin() {
  const supabase = await createClient();
  const ensured = await ensureUserHasAgency();
  if (ensured.error || !ensured.profile?.agency_id) {
    return {
      supabase,
      error: ensured.error || "Akun belum terhubung ke agency",
      profile: null as null,
    };
  }
  if (ensured.profile.role !== "admin_agency") {
    return {
      supabase,
      error: "Hanya admin agency yang bisa kelola tim",
      profile: null as null,
    };
  }
  return { supabase, error: null as null, profile: ensured.profile };
}

export async function createTeamInvite(formData: FormData) {
  const { supabase, error: authError, profile } = await requireAdmin();
  if (authError || !profile) return { error: authError || "Unauthorized" };

  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const role = String(formData.get("role") || "recruiter").trim() as UserRole;
  const clientId = String(formData.get("client_id") || "").trim() || null;

  if (!email || !email.includes("@")) {
    return { error: "Email undangan tidak valid" };
  }

  if (!["admin_agency", "recruiter", "client_viewer"].includes(role)) {
    return { error: "Role tidak valid" };
  }

  if (role === "client_viewer" && !clientId) {
    return { error: "Client viewer wajib dihubungkan ke satu client company" };
  }

  if (role !== "client_viewer" && clientId) {
    return { error: "Hanya client viewer yang punya client company" };
  }

  if (clientId) {
    const { data: client } = await supabase
      .from("client_companies")
      .select("id")
      .eq("id", clientId)
      .eq("agency_id", profile.agency_id)
      .maybeSingle();
    if (!client) return { error: "Client tidak ditemukan" };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: invite, error } = await supabase
    .from("team_invites")
    .insert({
      agency_id: profile.agency_id,
      email,
      role,
      client_id: role === "client_viewer" ? clientId : null,
      invited_by: user?.id || null,
    })
    .select("id, token, email, role, expires_at")
    .single();

  if (error || !invite) {
    return {
      error:
        formatError(error) +
        ". Pastikan sudah run migration 00007_team_invites_client_scope.sql",
    };
  }

  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_URL ||
    "http://localhost:3000";
  const origin = base.startsWith("http") ? base : `https://${base}`;
  const inviteUrl = `${origin.replace(/\/$/, "")}/register?invite=${invite.token}`;

  revalidatePath("/team");
  return {
    success: true,
    inviteUrl,
    token: invite.token as string,
    email: invite.email as string,
  };
}

export async function revokeTeamInvite(id: string) {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const { error } = await supabase
    .from("team_invites")
    .delete()
    .eq("id", id)
    .is("accepted_at", null);

  if (error) return { error: formatError(error) };
  revalidatePath("/team");
  return { success: true };
}

export async function updateTeamMemberRole(formData: FormData) {
  const { supabase, error: authError, profile } = await requireAdmin();
  if (authError || !profile) return { error: authError || "Unauthorized" };

  const userId = String(formData.get("user_id") || "").trim();
  const role = String(formData.get("role") || "").trim() as UserRole;
  const clientId = String(formData.get("client_id") || "").trim() || null;

  if (!userId) return { error: "User wajib dipilih" };
  if (!["admin_agency", "recruiter", "client_viewer"].includes(role)) {
    return { error: "Role tidak valid" };
  }
  if (role === "client_viewer" && !clientId) {
    return { error: "Client viewer wajib punya client company" };
  }

  if (userId === profile.id && role !== "admin_agency") {
    return { error: "Tidak bisa menurunkan role akun admin sendiri" };
  }

  const { error } = await supabase
    .from("users")
    .update({
      role,
      client_id: role === "client_viewer" ? clientId : null,
    })
    .eq("id", userId)
    .eq("agency_id", profile.agency_id);

  if (error) return { error: formatError(error) };
  revalidatePath("/team");
  return { success: true };
}

export async function getInvitePreview(token: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_team_invite_by_token", {
    p_token: token,
  });
  if (error) return { error: formatError(error), data: null };
  if (!data) return { error: "Undangan tidak valid / kadaluarsa", data: null };
  return { error: null, data };
}
