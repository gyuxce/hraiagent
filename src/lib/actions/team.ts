"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensureUserHasAgency } from "@/lib/actions/agency";
import { isValidEmail, normalizeEmail } from "@/lib/validation/email";
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

async function assertClientInAgency(
  supabase: Awaited<ReturnType<typeof createClient>>,
  agencyId: string,
  clientId: string
) {
  const { data: client } = await supabase
    .from("client_companies")
    .select("id")
    .eq("id", clientId)
    .eq("agency_id", agencyId)
    .maybeSingle();
  return Boolean(client);
}

export async function createTeamInvite(formData: FormData) {
  const { supabase, error: authError, profile } = await requireAdmin();
  if (authError || !profile) return { error: authError || "Unauthorized" };

  const email = normalizeEmail(String(formData.get("email") || ""));
  const role = String(formData.get("role") || "recruiter").trim() as UserRole;
  const clientId = String(formData.get("client_id") || "").trim() || null;

  if (!isValidEmail(email)) {
    return { error: "Format email undangan tidak valid" };
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
    const ok = await assertClientInAgency(
      supabase,
      profile.agency_id,
      clientId
    );
    if (!ok) return { error: "Client tidak ditemukan di agency Anda" };
  }

  const { data: existingInvites } = await supabase
    .from("team_invites")
    .select("id, accepted_at, expires_at")
    .eq("agency_id", profile.agency_id)
    .eq("email", email)
    .order("created_at", { ascending: false });

  const pending = (existingInvites || []).find(
    (i) =>
      !i.accepted_at &&
      i.expires_at &&
      new Date(i.expires_at).getTime() > Date.now()
  );
  if (pending) {
    return {
      error:
        "Sudah ada undangan aktif untuk email ini. Salin link pending atau batalkan dulu.",
    };
  }

  const alreadyJoined = (existingInvites || []).some((i) => i.accepted_at);
  if (alreadyJoined) {
    return {
      error:
        "Email ini sudah pernah bergabung ke agency. Minta mereka login, atau ubah role di daftar anggota.",
    };
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
  const { supabase, error: authError, profile } = await requireAdmin();
  if (authError || !profile) return { error: authError || "Unauthorized" };

  if (!id) return { error: "Undangan tidak valid" };

  const { data, error } = await supabase
    .from("team_invites")
    .delete()
    .eq("id", id)
    .eq("agency_id", profile.agency_id)
    .is("accepted_at", null)
    .select("id");

  if (error) return { error: formatError(error) };
  if (!data?.length) {
    return { error: "Undangan tidak ditemukan atau sudah diterima" };
  }

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
  if (role !== "client_viewer" && clientId) {
    return { error: "Hanya client viewer yang punya client company" };
  }

  if (userId === profile.id && role !== "admin_agency") {
    return { error: "Tidak bisa menurunkan role akun admin sendiri" };
  }

  if (clientId) {
    const ok = await assertClientInAgency(
      supabase,
      profile.agency_id,
      clientId
    );
    if (!ok) return { error: "Client tidak ditemukan di agency Anda" };
  }

  const { data, error } = await supabase
    .from("users")
    .update({
      role,
      client_id: role === "client_viewer" ? clientId : null,
    })
    .eq("id", userId)
    .eq("agency_id", profile.agency_id)
    .select("id");

  if (error) return { error: formatError(error) };
  if (!data?.length) return { error: "Anggota tidak ditemukan" };

  revalidatePath("/team");
  return { success: true };
}

export async function getInvitePreview(token: string) {
  const supabase = await createClient();
  const cleaned = String(token || "").trim();
  if (!cleaned || cleaned.length < 10) {
    return { error: "Link undangan tidak valid", data: null };
  }

  const { data, error } = await supabase.rpc("get_team_invite_by_token", {
    p_token: cleaned,
  });
  if (error) return { error: formatError(error), data: null };
  if (!data) {
    return {
      error: "Undangan tidak valid, sudah dipakai, atau kadaluarsa",
      data: null,
    };
  }
  return { error: null, data };
}
