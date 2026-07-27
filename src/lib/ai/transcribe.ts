/**
 * Server-side speech-to-text fallback for browsers without Web Speech API
 * (Firefox, Safari, some mobile). Tries providers in order:
 *   1. Groq Whisper (GROQ_API_KEY) — fast, free tier, good Indonesian
 *   2. OpenAI Whisper (OPENAI_API_KEY)
 * Never throws — transcription failure must not break the interview flow.
 */

export type TranscribeResult = {
  text: string | null;
  provider?: "groq" | "openai";
  reason?: "not_configured" | "provider_error";
  error?: string;
};

const MAX_AUDIO_BYTES = 24 * 1024 * 1024; // Whisper hard limit is 25MB

async function callWhisperApi(params: {
  endpoint: string;
  apiKey: string;
  model: string;
  blob: Blob;
  filename: string;
}): Promise<{ text: string | null; error?: string }> {
  const form = new FormData();
  form.set("file", new File([params.blob], params.filename, { type: params.blob.type || "video/webm" }));
  form.set("model", params.model);
  form.set("language", "id");
  form.set("response_format", "json");

  try {
    const res = await fetch(params.endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${params.apiKey}` },
      body: form,
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { text: null, error: `${res.status}: ${body.slice(0, 200)}` };
    }

    const json = (await res.json()) as { text?: string };
    return { text: (json.text || "").trim() || null };
  } catch (err) {
    return {
      text: null,
      error: err instanceof Error ? err.message : "Request gagal",
    };
  }
}

export function sttConfigured(): boolean {
  return Boolean(
    process.env.GROQ_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim()
  );
}

export async function transcribeAudio(
  blob: Blob,
  filename = "answer.webm"
): Promise<TranscribeResult> {
  if (blob.size === 0) {
    return { text: null, reason: "provider_error", error: "File kosong" };
  }
  if (blob.size > MAX_AUDIO_BYTES) {
    return {
      text: null,
      reason: "provider_error",
      error: "File terlalu besar untuk transkripsi (>24MB)",
    };
  }

  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (groqKey) {
    const result = await callWhisperApi({
      endpoint: "https://api.groq.com/openai/v1/audio/transcriptions",
      apiKey: groqKey,
      model: process.env.GROQ_STT_MODEL?.trim() || "whisper-large-v3-turbo",
      blob,
      filename,
    });
    if (result.text) return { text: result.text, provider: "groq" };
    // Fall through to OpenAI if configured
    const openaiKey = process.env.OPENAI_API_KEY?.trim();
    if (!openaiKey) {
      return { text: null, reason: "provider_error", error: `Groq: ${result.error}` };
    }
  }

  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (openaiKey) {
    const result = await callWhisperApi({
      endpoint: "https://api.openai.com/v1/audio/transcriptions",
      apiKey: openaiKey,
      model: process.env.OPENAI_STT_MODEL?.trim() || "whisper-1",
      blob,
      filename,
    });
    if (result.text) return { text: result.text, provider: "openai" };
    return { text: null, reason: "provider_error", error: `OpenAI: ${result.error}` };
  }

  return { text: null, reason: "not_configured" };
}
