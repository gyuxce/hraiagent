/**
 * Server-only AI provider config.
 * Keep secrets out of client bundles — only import from server actions / RSC.
 */

function cleanEnv(value: string | undefined): string {
  let v = (value || "").trim();
  // Common paste mistakes in Vercel / .env
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  // Strip accidental "Bearer " prefix
  if (/^bearer\s+/i.test(v)) {
    v = v.replace(/^bearer\s+/i, "").trim();
  }
  return v;
}

function readKey(...names: string[]): string {
  for (const name of names) {
    const v = cleanEnv(process.env[name]);
    if (v) return v;
  }
  return "";
}

const PROVIDERS: Record<string, { baseUrl: string; defaultModel: string }> = {
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "x-ai/grok-4.5",
  },
  opencode: {
    baseUrl: "https://opencode.ai/zen/go/v1",
    defaultModel: "deepseek-v4-flash",
  },
};

export type AiProviderConfig = {
  baseUrl: string;
  model: string;
  apiKey: string;
  provider: "openrouter" | "opencode" | "unknown";
};

/** Non-secret snapshot for error messages / debugging. */
export function getAiEnvDebug() {
  const openrouter = Boolean(readKey("OPENROUTER_API_KEY", "OPEN_ROUTER_API_KEY"));
  const aiApi = Boolean(readKey("AI_API_KEY"));
  const opencode = Boolean(readKey("OPENCODE_API_KEY"));
  const publicOpenrouter = Boolean(readKey("NEXT_PUBLIC_OPENROUTER_API_KEY"));
  return {
    hasOPENROUTER_API_KEY: openrouter,
    hasAI_API_KEY: aiApi,
    hasOPENCODE_API_KEY: opencode,
    hasNEXT_PUBLIC_OPENROUTER_API_KEY: publicOpenrouter,
    AI_PROVIDER: cleanEnv(process.env.AI_PROVIDER) || null,
    VERCEL_ENV: process.env.VERCEL_ENV || null,
    NODE_ENV: process.env.NODE_ENV || null,
  };
}

export function missingAiKeyMessage(): string {
  const d = getAiEnvDebug();
  const flags = [
    `OPENROUTER=${d.hasOPENROUTER_API_KEY ? "yes" : "no"}`,
    `AI_API_KEY=${d.hasAI_API_KEY ? "yes" : "no"}`,
    `OPENCODE=${d.hasOPENCODE_API_KEY ? "yes" : "no"}`,
    `VERCEL_ENV=${d.VERCEL_ENV || "—"}`,
  ].join(" · ");

  return [
    "API key AI belum terbaca di server.",
    "Di Vercel → Settings → Environment Variables pastikan nama tepat OPENROUTER_API_KEY, centang Production, lalu Redeploy (Deployments → … → Redeploy).",
    `Debug: ${flags}`,
  ].join(" ");
}

/**
 * Vision model for selfie ↔ video face check (OpenRouter).
 * Fallback list is tried in order when the primary returns 404.
 */
export function getVisionModel(): string {
  return (
    cleanEnv(process.env.AI_VISION_MODEL) || "google/gemini-2.5-flash"
  );
}

export function getVisionModelFallbacks(): string[] {
  const primary = getVisionModel();
  const extras = [
    "google/gemini-2.5-flash",
    "openai/gpt-4o-mini",
    "google/gemini-flash-1.5",
  ];
  return [primary, ...extras.filter((m) => m !== primary)];
}

export function detectProvider(): AiProviderConfig {
  const explicit = cleanEnv(process.env.AI_PROVIDER).toLowerCase();
  const openRouterKey = readKey(
    "OPENROUTER_API_KEY",
    "OPEN_ROUTER_API_KEY",
    "AI_API_KEY",
    "NEXT_PUBLIC_OPENROUTER_API_KEY"
  );
  const openCodeKey = readKey("OPENCODE_API_KEY");

  // Explicit provider only if its key exists — otherwise fall back to available key.
  // (Common misconfig: AI_PROVIDER=opencode but only OPENROUTER_API_KEY is set.)
  if (explicit === "openrouter" && openRouterKey) {
    return {
      baseUrl:
        cleanEnv(process.env.AI_BASE_URL) || PROVIDERS.openrouter.baseUrl,
      model: cleanEnv(process.env.AI_MODEL) || PROVIDERS.openrouter.defaultModel,
      apiKey: openRouterKey,
      provider: "openrouter",
    };
  }

  if (explicit === "opencode" && openCodeKey) {
    return {
      baseUrl: cleanEnv(process.env.AI_BASE_URL) || PROVIDERS.opencode.baseUrl,
      model: cleanEnv(process.env.AI_MODEL) || PROVIDERS.opencode.defaultModel,
      apiKey: openCodeKey,
      provider: "opencode",
    };
  }

  if (openRouterKey) {
    return {
      baseUrl:
        cleanEnv(process.env.AI_BASE_URL) || PROVIDERS.openrouter.baseUrl,
      model: cleanEnv(process.env.AI_MODEL) || PROVIDERS.openrouter.defaultModel,
      apiKey: openRouterKey,
      provider: "openrouter",
    };
  }

  if (openCodeKey) {
    return {
      baseUrl: cleanEnv(process.env.AI_BASE_URL) || PROVIDERS.opencode.baseUrl,
      model: cleanEnv(process.env.AI_MODEL) || PROVIDERS.opencode.defaultModel,
      apiKey: openCodeKey,
      provider: "opencode",
    };
  }

  throw new Error(missingAiKeyMessage());
}
