"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function formatError(error: unknown): string {
  if (!error) return "Terjadi kesalahan tidak diketahui";
  if (typeof error === "string") return error;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null) {
    const e = error as Record<string, unknown>;
    if (typeof e.message === "string" && e.message) return e.message;
    if (typeof e.msg === "string" && e.msg) return e.msg;
    if (typeof e.error_description === "string") return e.error_description;
    try {
      return JSON.stringify(error);
    } catch {
      return "Terjadi kesalahan";
    }
  }
  return "Terjadi kesalahan";
}

export async function register(formData: FormData) {
  const supabase = await createClient();

  const inviteToken = String(formData.get("invite_token") || "").trim();
  const agencyName = String(formData.get("agency_name") || "").trim();
  const fullName = String(formData.get("full_name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!fullName || !email || !password) {
    return { error: "Semua field wajib diisi" };
  }

  if (!inviteToken && !agencyName) {
    return { error: "Nama agency wajib diisi" };
  }

  if (password.length < 6) {
    return { error: "Password minimal 6 karakter" };
  }

  let inviteEmail: string | null = null;
  if (inviteToken) {
    const { data: invite, error: inviteError } = await supabase.rpc(
      "get_team_invite_by_token",
      { p_token: inviteToken }
    );
    if (inviteError || !invite) {
      return {
        error:
          "Undangan tidak valid / kadaluarsa. Minta admin kirim ulang undangan.",
      };
    }
    inviteEmail = String(
      (invite as { email?: string }).email || ""
    ).toLowerCase();
    if (inviteEmail && email.toLowerCase() !== inviteEmail) {
      return {
        error: `Email harus sama dengan undangan: ${inviteEmail}`,
      };
    }
  }

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        agency_name: agencyName || undefined,
        invite_token: inviteToken || undefined,
      },
    },
  });

  if (authError) {
    if (authError.message.toLowerCase().includes("already")) {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (loginError) {
        return { error: formatError(authError) };
      }
    } else {
      return { error: formatError(authError) };
    }
  }

  if (!authData.user && !authData.session) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { error: "Gagal membuat user. Coba lagi." };
    }
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (loginError) {
      return {
        error:
          "Akun mungkin sudah dibuat. Coba login, atau matikan Confirm email di Supabase.",
      };
    }
  }

  if (inviteToken) {
    const { error: acceptError } = await supabase.rpc("accept_team_invite", {
      p_token: inviteToken,
      p_full_name: fullName,
    });
    if (acceptError) {
      return {
        error:
          "Akun dibuat, tapi gagal join agency: " +
          formatError(acceptError) +
          ". Pastikan migration 00007 sudah dijalankan.",
      };
    }
  } else {
    const { error: rpcError } = await supabase.rpc("create_agency_with_admin", {
      agency_name: agencyName,
      admin_full_name: fullName,
    });

    if (rpcError) {
      if (rpcError.message.toLowerCase().includes("already belongs")) {
        revalidatePath("/", "layout");
        redirect("/dashboard");
      }
      return { error: "Gagal membuat agency: " + formatError(rpcError) };
    }
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function login(formData: FormData) {
  const supabase = await createClient();

  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    return { error: "Email dan password wajib diisi" };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: formatError(error) };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
