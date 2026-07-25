import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { detectProvider, getAiEnvDebug } from "@/lib/ai/config";

/**
 * Auth-gated debug endpoint: confirms whether AI keys are visible to the server.
 * Does not return the secret value — only presence + short prefix.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const debug = getAiEnvDebug();
  let ready = false;
  let provider: string | null = null;
  let keyPrefix: string | null = null;

  try {
    const cfg = detectProvider();
    ready = Boolean(cfg.apiKey);
    provider = cfg.provider;
    keyPrefix = cfg.apiKey ? `${cfg.apiKey.slice(0, 7)}…` : null;
  } catch {
    ready = false;
  }

  return NextResponse.json({
    ready,
    provider,
    keyPrefix,
    debug,
  });
}
