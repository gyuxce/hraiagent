import type { SupabaseClient } from "@supabase/supabase-js";

export type AiEventType =
  | "cv_screen"
  | "interview_summary"
  | "async_question_gen"
  | "async_analyze";

export type AiUsageSnapshot = {
  ok: boolean;
  agency_id?: string;
  year_month?: string;
  plan_tier?: string;
  quota: number;
  used: number;
  remaining: number;
  breakdown?: {
    cv_screen: number;
    interview_summary: number;
    async_question_gen: number;
    async_analyze: number;
  };
  error?: string;
  /** true bila migration 00010 belum dijalankan — AI tetap diizinkan */
  soft?: boolean;
};

type ConsumeParams = {
  agencyId: string;
  eventType: AiEventType;
  units?: number;
  userId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  model?: string | null;
};

function isMissingRpc(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  const msg = (error.message || "").toLowerCase();
  return (
    error.code === "42883" ||
    msg.includes("consume_ai_quota") ||
    msg.includes("get_agency_ai_usage") ||
    msg.includes("could not find the function") ||
    msg.includes("schema cache")
  );
}

function parseUsagePayload(data: unknown): AiUsageSnapshot | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const quota = typeof d.quota === "number" ? d.quota : null;
  const used = typeof d.used === "number" ? d.used : null;
  if (quota == null || used == null) return null;
  const breakdown =
    d.breakdown && typeof d.breakdown === "object"
      ? (d.breakdown as AiUsageSnapshot["breakdown"])
      : undefined;
  return {
    ok: d.ok !== false,
    agency_id: typeof d.agency_id === "string" ? d.agency_id : undefined,
    year_month: typeof d.year_month === "string" ? d.year_month : undefined,
    plan_tier: typeof d.plan_tier === "string" ? d.plan_tier : undefined,
    quota,
    used,
    remaining:
      typeof d.remaining === "number"
        ? d.remaining
        : Math.max(quota - used, 0),
    breakdown,
    error: typeof d.error === "string" ? d.error : undefined,
  };
}

/** Soft-allow when metering migration belum ada, agar app tidak putus. */
export async function consumeAiQuota(
  supabase: SupabaseClient,
  params: ConsumeParams
): Promise<AiUsageSnapshot> {
  const { data, error } = await supabase.rpc("consume_ai_quota", {
    p_agency_id: params.agencyId,
    p_event_type: params.eventType,
    p_units: params.units ?? 1,
    p_user_id: params.userId ?? null,
    p_resource_type: params.resourceType ?? null,
    p_resource_id: params.resourceId ?? null,
    p_model: params.model ?? null,
  });

  if (error) {
    if (isMissingRpc(error)) {
      return {
        ok: true,
        soft: true,
        quota: 0,
        used: 0,
        remaining: 0,
        error: "Migration 00010_ai_usage_metering.sql belum dijalankan",
      };
    }
    return {
      ok: false,
      quota: 0,
      used: 0,
      remaining: 0,
      error: error.message,
    };
  }

  const parsed = parseUsagePayload(data);
  if (!parsed) {
    return {
      ok: false,
      quota: 0,
      used: 0,
      remaining: 0,
      error: "Respons kuota AI tidak valid",
    };
  }
  return parsed;
}

export async function consumeAiQuotaForAsyncToken(
  supabase: SupabaseClient,
  params: {
    token: string;
    eventType: AiEventType;
    units?: number;
    resourceType?: string | null;
    resourceId?: string | null;
    model?: string | null;
  }
): Promise<AiUsageSnapshot> {
  const { data, error } = await supabase.rpc("consume_ai_quota_for_async_token", {
    p_token: params.token,
    p_event_type: params.eventType,
    p_units: params.units ?? 1,
    p_resource_type: params.resourceType ?? null,
    p_resource_id: params.resourceId ?? null,
    p_model: params.model ?? null,
  });

  if (error) {
    if (isMissingRpc(error)) {
      return {
        ok: true,
        soft: true,
        quota: 0,
        used: 0,
        remaining: 0,
        error: "Migration 00010_ai_usage_metering.sql belum dijalankan",
      };
    }
    return {
      ok: false,
      quota: 0,
      used: 0,
      remaining: 0,
      error: error.message,
    };
  }

  const parsed = parseUsagePayload(data);
  if (!parsed) {
    return {
      ok: false,
      quota: 0,
      used: 0,
      remaining: 0,
      error: "Respons kuota AI tidak valid",
    };
  }
  return parsed;
}

export async function getAgencyAiUsage(
  supabase: SupabaseClient,
  agencyId?: string
): Promise<AiUsageSnapshot> {
  const { data, error } = await supabase.rpc(
    "get_agency_ai_usage",
    agencyId ? { p_agency_id: agencyId } : {}
  );

  if (error) {
    if (isMissingRpc(error)) {
      return {
        ok: false,
        soft: true,
        quota: 0,
        used: 0,
        remaining: 0,
        error: "Migration 00010_ai_usage_metering.sql belum dijalankan",
      };
    }
    return {
      ok: false,
      quota: 0,
      used: 0,
      remaining: 0,
      error: error.message,
    };
  }

  const parsed = parseUsagePayload(data);
  if (!parsed) {
    return {
      ok: false,
      quota: 0,
      used: 0,
      remaining: 0,
      error: "Respons usage AI tidak valid",
    };
  }
  return parsed;
}

export function quotaExceededMessage(usage: AiUsageSnapshot): string {
  if (usage.quota > 0) {
    return `Kuota AI bulanan habis (${usage.used}/${usage.quota} unit). Upgrade plan atau tunggu reset bulan depan.`;
  }
  return usage.error || "Kuota AI bulanan habis";
}
