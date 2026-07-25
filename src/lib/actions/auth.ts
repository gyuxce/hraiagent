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

  const agencyName = String(formData.get("agency_name") || "").trim();
  const fullName = String(formData.get("full_name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!agencyName || !fullName || !email || !password) {
    return { error: "Semua field wajib diisi" };
  }

  if (password.length < 6) {
    return { error: "Password minimal 6 karakter" };
  }

  // 1. Sign up
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        agency_name: agencyName,
      },
    },
  });

  if (authError) {
    // If user already exists from a previous partial signup, try login
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
    // Try get current user after possible login fallback
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { error: "Gagal membuat user. Coba lagi." };
    }
  }

  // Ensure we have a session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    // Sign in if signup didn't return session (e.g. user already existed)
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

  // 2. Create agency + set admin via secure RPC (bypasses RLS)
  const { error: rpcError } = await supabase.rpc("create_agency_with_admin", {
    agency_name: agencyName,
    admin_full_name: fullName,
  });

  if (rpcError) {
    // If already has agency, just go to dashboard
    if (rpcError.message.toLowerCase().includes("already belongs")) {
      revalidatePath("/", "layout");
      redirect("/dashboard");
    }
    return { error: "Gagal membuat agency: " + formatError(rpcError) };
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
