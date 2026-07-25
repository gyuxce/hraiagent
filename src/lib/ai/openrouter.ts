export type ParsedCvData = {
  name: string | null;
  email: string | null;
  phone: string | null;
  skills: string[];
  experience: string[];
  education: string[];
  summary: string | null;
};

export type ScreeningResult = {
  score: number;
  summary: string;
  parsed: ParsedCvData;
};

/**
 * AI Provider — swap via AI_PROVIDER env:
 *   "openrouter" → OpenRouter
 *   "opencode"   → OpenCode Go
 *
 * Jika tidak diset → auto-detect dari API key yang tersedia
 */
const PROVIDERS: Record<
  string,
  { baseUrl: string; defaultModel: string }
> = {
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "deepseek/deepseek-v4-flash",
  },
  opencode: {
    baseUrl: "https://opencode.ai/zen/go/v1",
    defaultModel: "deepseek-v4-flash",
  },
};

function detectProvider(): { baseUrl: string; model: string; apiKey: string } {
  // 1. Explicit AI_PROVIDER
  const explicit = process.env.AI_PROVIDER?.toLowerCase();
  if (explicit && PROVIDERS[explicit]) {
    const p = PROVIDERS[explicit];
    const key =
      explicit === "openrouter"
        ? process.env.OPENROUTER_API_KEY || process.env.AI_API_KEY
        : process.env.OPENCODE_API_KEY || process.env.AI_API_KEY;
    return {
      baseUrl: process.env.AI_BASE_URL || p.baseUrl,
      model: process.env.AI_MODEL || p.defaultModel,
      apiKey: key || "",
    };
  }

  // 2. Auto-detect from available keys
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const openCodeKey = process.env.OPENCODE_API_KEY;

  if (openRouterKey) {
    return {
      baseUrl: process.env.AI_BASE_URL || PROVIDERS.openrouter.baseUrl,
      model: process.env.AI_MODEL || PROVIDERS.openrouter.defaultModel,
      apiKey: openRouterKey,
    };
  }

  if (openCodeKey) {
    return {
      baseUrl: process.env.AI_BASE_URL || PROVIDERS.opencode.baseUrl,
      model: process.env.AI_MODEL || PROVIDERS.opencode.defaultModel,
      apiKey: openCodeKey,
    };
  }

  throw new Error(
    "OPENROUTER_API_KEY atau OPENCODE_API_KEY belum diset di .env.local"
  );
}

export async function screenCandidateWithAI(params: {
  cvText: string;
  jobTitle: string;
  jobDescription: string;
  requirements: string[];
}): Promise<ScreeningResult> {
  const { baseUrl, model, apiKey } = detectProvider();

  if (!apiKey) {
    throw new Error(
      "API key AI belum diset. Isi OPENROUTER_API_KEY di .env.local"
    );
  }

  const requirementsText =
    params.requirements.length > 0
      ? params.requirements.map((r, i) => `${i + 1}. ${r}`).join("\n")
      : "(tidak ada requirement spesifik)";

  const prompt = `Kamu adalah asisten rekrutmen profesional di Indonesia.
Analisis dokumen kandidat terhadap job requirement.

JOB TITLE: ${params.jobTitle}

JOB DESCRIPTION:
${params.jobDescription}

REQUIREMENTS:
${requirementsText}

DOCUMENT TEXT:
${params.cvText.slice(0, 12000)}

Aturan penting:
1. Jika dokumen BUKAN CV/resume (misal panduan, invoice, artikel, random PDF), set score = 0 dan jelaskan di summary bahwa file bukan CV.
2. Jika CV tapi tidak cocok job, score rendah (0-40) dengan alasan jelas.
3. Jika cukup cocok, score 41-70. Jika sangat cocok, 71-100.
4. score HARUS angka integer 0-100 (bukan string).
5. Ekstrak data CV jika ada. Jika bukan CV, parsed fields boleh null/array kosong.

Jawab HANYA JSON valid (tanpa markdown):
{
  "score": 85,
  "is_cv": true,
  "summary": "ringkasan 2-4 kalimat Bahasa Indonesia",
  "parsed": {
    "name": "...",
    "email": "...",
    "phone": "...",
    "skills": ["..."],
    "experience": ["..."],
    "education": ["..."],
    "summary": "ringkasan profil singkat"
  }
}`;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(baseUrl.includes("openrouter.ai")
        ? {
            "HTTP-Referer":
              process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
            "X-Title": "RecruitAI",
          }
        : {}),
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are a recruitment screening assistant. Always respond with valid JSON only.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `AI API error (${response.status}): ${errText.slice(0, 400)}`
    );
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (!content || typeof content !== "string") {
    throw new Error("Respons AI kosong atau tidak valid");
  }

  const parsed = extractJson(content);
  const score = clampScore(parseScore(parsed.score));
  let summary =
    typeof parsed.summary === "string" && parsed.summary
      ? parsed.summary
      : "Tidak ada ringkasan dari AI.";

  if (parsed.is_cv === false && score === 0) {
    summary =
      summary ||
      "Dokumen yang diupload bukan CV/resume, sehingga skor kecocokan = 0.";
  }

  if (score === 0 && !summary.toLowerCase().includes("bukan")) {
    summary = `${summary} (Skor 0: dokumen tidak relevan / tidak cocok dengan job.)`;
  }

  const p = (parsed.parsed || {}) as Record<string, unknown>;

  return {
    score,
    summary,
    parsed: {
      name: strOrNull(p.name),
      email: strOrNull(p.email),
      phone: strOrNull(p.phone),
      skills: strArray(p.skills),
      experience: strArray(p.experience),
      education: strArray(p.education),
      summary: strOrNull(p.summary),
    },
  };
}

export async function summarizeInterviewTranscript(params: {
  candidateName: string;
  jobTitle: string;
  jobDescription: string;
  requirements: string[];
  transcript: string;
  interviewerNotes?: string | null;
}): Promise<{ summary: string; strengths: string[]; concerns: string[]; recommendation: string }> {
  const { baseUrl, model, apiKey } = detectProvider();
  if (!apiKey) {
    throw new Error("API key AI belum diset. Isi OPENROUTER_API_KEY di .env.local");
  }

  const requirementsText =
    params.requirements.length > 0
      ? params.requirements.map((r, i) => `${i + 1}. ${r}`).join("\n")
      : "(tidak ada)";

  const prompt = `Kamu asisten rekrutmen. Rangkum hasil interview manusia (bukan buat keputusan final).

KANDIDAT: ${params.candidateName}
JOB: ${params.jobTitle}

DESKRIPSI JOB:
${params.jobDescription}

REQUIREMENTS:
${requirementsText}

TRANSKRIP / CATATAN INTERVIEW:
${params.transcript.slice(0, 14000)}

CATATAN INTERVIEWER:
${params.interviewerNotes || "(tidak ada)"}

Jawab HANYA JSON valid:
{
  "summary": "ringkasan 3-6 kalimat Bahasa Indonesia",
  "strengths": ["poin kekuatan"],
  "concerns": ["poin risiko/kekurangan"],
  "recommendation": "rekomendasi singkat untuk recruiter (mis. lanjut / hati-hati / tidak recommended) + alasan"
}`;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(baseUrl.includes("openrouter.ai")
        ? {
            "HTTP-Referer":
              process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
            "X-Title": "RecruitAI",
          }
        : {}),
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You summarize human-led interviews for recruiters. Valid JSON only. Be fair and concise. Bahasa Indonesia.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI API error (${response.status}): ${errText.slice(0, 400)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Respons AI kosong");
  }

  const parsed = extractJson(content);
  return {
    summary:
      typeof parsed.summary === "string" && parsed.summary
        ? parsed.summary
        : "Tidak ada ringkasan.",
    strengths: strArray(parsed.strengths),
    concerns: strArray(parsed.concerns),
    recommendation:
      typeof parsed.recommendation === "string"
        ? parsed.recommendation
        : "Tidak ada rekomendasi.",
  };
}

async function chatJson(prompt: string, system: string): Promise<Record<string, unknown>> {
  const { baseUrl, model, apiKey } = detectProvider();
  if (!apiKey) {
    throw new Error("API key AI belum diset. Isi OPENROUTER_API_KEY di .env.local");
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(baseUrl.includes("openrouter.ai")
        ? {
            "HTTP-Referer":
              process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
            "X-Title": "RecruitAI",
          }
        : {}),
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI API error (${response.status}): ${errText.slice(0, 400)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Respons AI kosong");
  }
  return extractJson(content);
}

export async function generateInterviewQuestions(params: {
  jobTitle: string;
  jobDescription: string;
  requirements: string[];
  candidateName?: string;
  count?: number;
}): Promise<{ question_text: string; focus_area: string }[]> {
  const count = params.count ?? 5;
  const requirementsText =
    params.requirements.length > 0
      ? params.requirements.map((r, i) => `${i + 1}. ${r}`).join("\n")
      : "(umum)";

  const prompt = `Buat ${count} pertanyaan interview async (bukan real-time) untuk posisi berikut.
Pertanyaan harus bisa dijawab dengan rekaman video pendek atau teks (1-3 menit).

JOB: ${params.jobTitle}
KANDIDAT: ${params.candidateName || "Kandidat"}

DESKRIPSI:
${params.jobDescription}

REQUIREMENTS:
${requirementsText}

Campur: behavioral, teknis/relevan job, situational, dan komunikasi.
Bahasa Indonesia, jelas, netral (hindari bias demografi).

JSON saja:
{
  "questions": [
    { "question_text": "...", "focus_area": "behavioral|teknis|situational|komunikasi" }
  ]
}`;

  const parsed = await chatJson(
    prompt,
    "You generate fair async interview questions. Valid JSON only. Bahasa Indonesia."
  );

  const list = Array.isArray(parsed.questions) ? parsed.questions : [];
  return list
    .map((q) => {
      const item = q as Record<string, unknown>;
      return {
        question_text: String(item.question_text || "").trim(),
        focus_area: String(item.focus_area || "umum").trim(),
      };
    })
    .filter((q) => q.question_text.length > 0)
    .slice(0, count);
}

export async function analyzeInterviewAnswer(params: {
  jobTitle: string;
  question: string;
  focusArea?: string | null;
  answerText: string;
}): Promise<{ score: number; feedback: string }> {
  const prompt = `Nilai jawaban interview async untuk recruiter.

JOB: ${params.jobTitle}
FOKUS: ${params.focusArea || "umum"}
PERTANYAAN: ${params.question}

JAWABAN KANDIDAT:
${params.answerText.slice(0, 8000)}

Nilai 0-100 untuk: relevansi, kejelasan komunikasi, kedalaman, contoh konkret.
JSON saja:
{
  "score": 75,
  "feedback": "2-4 kalimat Bahasa Indonesia: kekuatan + saran"
}`;

  const parsed = await chatJson(
    prompt,
    "You grade async interview answers fairly. Valid JSON only. Bahasa Indonesia."
  );

  return {
    score: clampScore(parseScore(parsed.score)),
    feedback:
      typeof parsed.feedback === "string" && parsed.feedback
        ? parsed.feedback
        : "Tidak ada feedback.",
  };
}

export async function rankInterviewSession(params: {
  jobTitle: string;
  answers: { question: string; answer: string; score: number | null; feedback: string | null }[];
}): Promise<{ overall_score: number; overall_summary: string }> {
  const body = params.answers
    .map(
      (a, i) =>
        `${i + 1}. Q: ${a.question}\nScore: ${a.score ?? "-"}\nA: ${a.answer.slice(0, 1500)}\nFB: ${a.feedback || "-"}`
    )
    .join("\n\n");

  const prompt = `Rangkum keseluruhan async interview untuk job ${params.jobTitle}.

HASIL PER PERTANYAAN:
${body}

JSON:
{
  "overall_score": 78,
  "overall_summary": "3-6 kalimat Bahasa Indonesia: gambaran umum, kekuatan, risiko, rekomendasi recruiter"
}`;

  const parsed = await chatJson(
    prompt,
    "You summarize full async interviews. Valid JSON only. Bahasa Indonesia."
  );

  return {
    overall_score: clampScore(parseScore(parsed.overall_score)),
    overall_summary:
      typeof parsed.overall_summary === "string" && parsed.overall_summary
        ? parsed.overall_summary
        : "Tidak ada ringkasan.",
  };
}

function parseScore(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const match = value.match(/(\d+(\.\d+)?)/);
    if (match) return Number(match[1]);
  }
  return NaN;
}

function extractJson(text: string): Record<string, unknown> {
  const cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]) as Record<string, unknown>;
    }
    throw new Error("Gagal parse JSON dari AI");
  }
}

function clampScore(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function strOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s || null;
}

function strArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean);
}
