import { detectProvider, getScreeningModel } from "@/lib/ai/config";

/**
 * Dialogue policy engine — setelah kandidat menjawab, LLM memutuskan:
 * follow_up (gali lagi) atau next (lanjut pertanyaan berikutnya).
 * Pakai model cepat/murah (screening model) karena ini per-turn latency-sensitive.
 * Never throws — fallback "next" agar sesi tidak pernah macet karena LLM.
 */

export type TurnDecision = {
  action: "follow_up" | "next";
  followUpQuestion: string | null;
  /** Catatan internal singkat (untuk debugging recruiter nanti) */
  rationale: string | null;
};

export async function decideInterviewTurn(params: {
  jobTitle: string;
  requirements: string[];
  questionText: string;
  answerTranscript: string;
  followUpsUsedForQuestion: number;
  followUpsMaxPerQuestion: number;
  followUpsUsedTotal: number;
  followUpsMaxTotal: number;
}): Promise<TurnDecision> {
  const fallback: TurnDecision = {
    action: "next",
    followUpQuestion: null,
    rationale: "fallback",
  };

  const capReached =
    params.followUpsUsedForQuestion >= params.followUpsMaxPerQuestion ||
    params.followUpsUsedTotal >= params.followUpsMaxTotal;
  if (capReached) return { ...fallback, rationale: "cap-reached" };
  if (params.answerTranscript.trim().length < 10) return fallback;

  try {
    const { baseUrl, apiKey } = detectProvider();
    const model = getScreeningModel();

    const prompt = `Kamu pewawancara HRD berpengalaman. Nilai jawaban kandidat, lalu putuskan: perlu SATU pertanyaan follow-up singkat untuk menggali, atau lanjut (next).

POSISI: ${params.jobTitle}
REQUIREMENT: ${params.requirements.slice(0, 6).join("; ") || "-"}
PERTANYAAN: ${params.questionText}
JAWABAN KANDIDAT: "${params.answerTranscript.slice(0, 1500)}"

Follow-up HANYA jika jawaban dangkal/generalist DAN penggaliannya relevan ke posisi. Jangan follow-up jawaban yang sudah konkret (ada contoh, angka, hasil). Maksimal 1 kalimat tanya, Bahasa Indonesia natural seperti ngobrol, bukan interogasi.

JSON only: {"action":"follow_up"|"next","follow_up":"kalimat tanya atau null","rationale":"maks 8 kata"}`;

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(baseUrl.includes("openrouter.ai")
          ? {
              "HTTP-Referer":
                process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
              "X-Title": "Cullr",
            }
          : {}),
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 220,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) return fallback;
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content as string | undefined;
    if (!content) return fallback;

    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return fallback;
    const parsed = JSON.parse(match[0]) as {
      action?: string;
      follow_up?: string | null;
      rationale?: string;
    };

    if (
      parsed.action === "follow_up" &&
      typeof parsed.follow_up === "string" &&
      parsed.follow_up.trim().length >= 10 &&
      parsed.follow_up.trim().length <= 300
    ) {
      return {
        action: "follow_up",
        followUpQuestion: parsed.follow_up.trim(),
        rationale: (parsed.rationale || "").slice(0, 120) || null,
      };
    }
    return { ...fallback, rationale: (parsed.rationale || "next").slice(0, 120) };
  } catch {
    return fallback;
  }
}
