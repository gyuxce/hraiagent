"use server";

import { revalidatePath } from "next/cache";
import { requireAgencyContext } from "@/lib/auth/agency-context";
import { VIDEO_RETENTION_PRESETS } from "@/lib/interview/video-retention";

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

export async function getVideoRetentionDays(): Promise<{
  days?: number;
  error?: string;
  migrationMissing?: boolean;
}> {
  const ctx = await requireAgencyContext();
  if (ctx.error || !ctx.profile) {
    return { error: ctx.error || "Unauthorized" };
  }

  const { data, error } = await ctx.supabase
    .from("agencies")
    .select("video_retention_days")
    .eq("id", ctx.profile.agency_id)
    .single();

  if (error) {
    const missing =
      /video_retention_days|column/i.test(error.message || "") ||
      error.code === "42703";
    return {
      error: missing
        ? "Kolom retensi belum ada. Jalankan migration 00012_video_retention.sql di Supabase."
        : formatError(error),
      migrationMissing: missing,
    };
  }

  const days =
    typeof data?.video_retention_days === "number"
      ? data.video_retention_days
      : 30;
  return { days };
}

export async function updateVideoRetentionDays(days: number): Promise<{
  error?: string;
  days?: number;
}> {
  const ctx = await requireAgencyContext();
  if (ctx.error || !ctx.profile) {
    return { error: ctx.error || "Unauthorized" };
  }

  if (ctx.profile.role !== "admin_agency") {
    return { error: "Hanya admin agency yang bisa mengubah retensi video" };
  }

  const allowed = new Set<number>(VIDEO_RETENTION_PRESETS);
  if (!allowed.has(days)) {
    return { error: "Nilai retensi tidak valid" };
  }

  const { error } = await ctx.supabase
    .from("agencies")
    .update({ video_retention_days: days })
    .eq("id", ctx.profile.agency_id);

  if (error) {
    const missing =
      /video_retention_days|column/i.test(error.message || "") ||
      error.code === "42703";
    return {
      error: missing
        ? "Kolom retensi belum ada. Jalankan migration 00012_video_retention.sql di Supabase."
        : formatError(error),
    };
  }

  revalidatePath("/team");
  revalidatePath("/candidates");
  return { days };
}
