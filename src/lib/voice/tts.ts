import { createHash } from "crypto";

/**
 * TTS adapter (OpenAI gpt-4o-mini-tts default).
 * Abstraksi sengaja tipis: ganti provider = ganti file ini / env TTS_PROVIDER.
 * Never throws — UI punya fallback teks jika TTS tidak tersedia (N4).
 */

export type TtsResult = {
  audio: Buffer | null;
  contentType: string;
  reason?: "not_configured" | "provider_error";
  error?: string;
};

const MAX_TTS_CHARS = 1200;

export function ttsConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function ttsVoice(): string {
  return process.env.TTS_VOICE?.trim() || "nova";
}

/** Cache key stabil per (teks, voice) — greeting/closing dipakai berulang. */
export function ttsCacheKey(text: string): string {
  return createHash("sha256")
    .update(`${ttsVoice()}::${text.trim()}`)
    .digest("hex")
    .slice(0, 40);
}

export async function synthesizeSpeech(text: string): Promise<TtsResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return { audio: null, contentType: "audio/mpeg", reason: "not_configured" };

  const input = text.trim().slice(0, MAX_TTS_CHARS);
  if (!input) return { audio: null, contentType: "audio/mpeg", reason: "provider_error", error: "Teks kosong" };

  try {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.TTS_MODEL?.trim() || "gpt-4o-mini-tts",
        voice: ttsVoice(),
        input,
        response_format: "mp3",
        instructions:
          "Bicara dalam Bahasa Indonesia yang natural, hangat, dan profesional seperti HRD yang ramah. Tempo sedang, tidak terburu-buru.",
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        audio: null,
        contentType: "audio/mpeg",
        reason: "provider_error",
        error: `OpenAI TTS ${res.status}: ${body.slice(0, 200)}`,
      };
    }

    const audio = Buffer.from(await res.arrayBuffer());
    return { audio, contentType: "audio/mpeg" };
  } catch (err) {
    return {
      audio: null,
      contentType: "audio/mpeg",
      reason: "provider_error",
      error: err instanceof Error ? err.message : "TTS gagal",
    };
  }
}
