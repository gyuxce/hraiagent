import {
  detectProvider,
  getVisionModelFallbacks,
  missingAiKeyMessage,
} from "@/lib/ai/config";
import {
  humanizeVisionError,
  type FaceMatchStatus,
} from "@/lib/interview/identity";

export type ParsedCvData = {
  name: string | null;
  email: string | null;
  phone: string | null;
  skills: string[];
  experience: string[];
  education: string[];
  summary: string | null;
};

export type ScoreBreakdown = {
  must_have: number;
  skills: number;
  experience: number;
  education: number;
  overall_fit: number;
  strengths: string[];
  gaps: string[];
  red_flags: string[];
};

export type ScreeningResult = {
  score: number;
  summary: string;
  parsed: ParsedCvData;
  breakdown: ScoreBreakdown;
};

export async function screenCandidateWithAI(params: {
  cvText: string;
  jobTitle: string;
  jobDescription: string;
  requirements: string[];
}): Promise<ScreeningResult> {
  const { baseUrl, model, apiKey } = detectProvider();

  if (!apiKey) {
    throw new Error(missingAiKeyMessage());
  }

  const requirementsText =
    params.requirements.length > 0
      ? params.requirements.map((r, i) => `${i + 1}. ${r}`).join("\n")
      : "(tidak ada requirement spesifik)";

  const jobDesc = (params.jobDescription || "").trim().slice(0, 1200);
  const prompt = `Kamu adalah asisten screening rekrutmen untuk agency di Indonesia.
Nilai kecocokan kandidat vs job dengan RUBRIK KETAT (jangan murah angka).

JOB TITLE: ${params.jobTitle}

JOB DESCRIPTION:
${jobDesc || "(tidak ada)"}

REQUIREMENTS (anggap poin awal = must-have kecuali jelas optional):
${requirementsText}

DOCUMENT TEXT:
${params.cvText.slice(0, 8000)}

Rubrik (tiap dimensi 0-100 integer):
- must_have: kecocokan requirement wajib / inti peran
- skills: tools/teknis/kompetensi yang disebut
- experience: relevansi durasi + tanggung jawab serupa
- education: kesesuaian pendidikan/sertifikasi bila relevan (jika job tidak minta, boleh 70 netral)
- overall_fit: penilaian holistik setelah mempertimbangkan red flags

Hitung score akhir (0-100) dengan bobot:
must_have 40% + skills 25% + experience 25% + education 10%.
Lalu sesuaikan ±5 jika ada red_flags berat / strengths luar biasa.
Jangan bulatkan ke angka "cantik" (80/85/90) tanpa bukti di CV.

Aturan:
1. Bukan CV → score=0, semua dimensi 0, is_cv=false.
2. Missing must-have penting → must_have ≤35 dan score akhir biasanya ≤55.
3. CV generik tanpa bukti konkret → score cenderung 40-60, bukan 80+.
4. Hanya score tinggi (≥75) jika ada bukti jelas di teks CV.
5. strengths/gaps/red_flags singkat, Bahasa Indonesia, berbasis bukti.

JSON saja (tanpa markdown):
{
  "score": 62,
  "is_cv": true,
  "summary": "2-4 kalimat: cocok di mana, kurang di mana, rekomendasi singkat",
  "breakdown": {
    "must_have": 55,
    "skills": 70,
    "experience": 60,
    "education": 75,
    "overall_fit": 62,
    "strengths": ["..."],
    "gaps": ["..."],
    "red_flags": ["..."]
  },
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
            "X-Title": "Saring",
          }
        : {}),
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 1400,
      messages: [
        {
          role: "system",
          content:
            "You are a strict Indonesian recruitment screener. Prefer evidence over generosity. Valid JSON only. Be concise.",
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
  const b = (parsed.breakdown || {}) as Record<string, unknown>;
  const breakdown: ScoreBreakdown = {
    must_have: clampScore(parseScore(b.must_have)),
    skills: clampScore(parseScore(b.skills)),
    experience: clampScore(parseScore(b.experience)),
    education: clampScore(parseScore(b.education)),
    overall_fit: clampScore(parseScore(b.overall_fit ?? parsed.score)),
    strengths: strArray(b.strengths).slice(0, 5),
    gaps: strArray(b.gaps).slice(0, 5),
    red_flags: strArray(b.red_flags).slice(0, 5),
  };

  const weighted = Math.round(
    breakdown.must_have * 0.4 +
      breakdown.skills * 0.25 +
      breakdown.experience * 0.25 +
      breakdown.education * 0.1
  );
  const modelScore = clampScore(parseScore(parsed.score));
  // Prefer weighted rubric; blend lightly with model score for stability
  let score = clampScore(Math.round(weighted * 0.75 + modelScore * 0.25));
  if (breakdown.red_flags.length >= 2) {
    score = Math.min(score, 55);
  }

  let summary =
    typeof parsed.summary === "string" && parsed.summary
      ? parsed.summary
      : "Tidak ada ringkasan dari AI.";

  if (parsed.is_cv === false) {
    score = 0;
    breakdown.must_have = 0;
    breakdown.skills = 0;
    breakdown.experience = 0;
    breakdown.education = 0;
    breakdown.overall_fit = 0;
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
    breakdown,
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
    throw new Error(missingAiKeyMessage());
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
            "X-Title": "Saring",
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

async function chatJson(
  prompt: string,
  system: string,
  opts?: { maxTokens?: number; temperature?: number }
): Promise<Record<string, unknown>> {
  const { baseUrl, model, apiKey } = detectProvider();
  if (!apiKey) {
    throw new Error(missingAiKeyMessage());
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
            "X-Title": "Saring",
          }
        : {}),
    },
    body: JSON.stringify({
      model,
      temperature: opts?.temperature ?? 0.3,
      ...(opts?.maxTokens ? { max_tokens: opts.maxTokens } : {}),
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
  /** Forces variety across sessions — include timestamp/random. */
  varietySeed?: string;
}): Promise<{ question_text: string; focus_area: string }[]> {
  const count = params.count ?? 5;
  const requirementsText =
    params.requirements.length > 0
      ? params.requirements
          .slice(0, 6)
          .map((r, i) => `${i + 1}. ${r}`)
          .join("\n")
      : "(umum)";
  const jobDesc = (params.jobDescription || "").trim().slice(0, 700);
  const seed =
    params.varietySeed ||
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const prompt = `Buat tepat ${count} pertanyaan interview video async (jawab bicara 30-90 detik).

JOB: ${params.jobTitle}
KANDIDAT: ${params.candidateName || "Kandidat"}
DESKRIPSI: ${jobDesc || "(tidak ada)"}
REQUIREMENTS:
${requirementsText}

SEED VARIASI (jangan diulang ke kandidat; pakai agar soal UNIK): ${seed}

Aturan:
- Pertanyaan HARUS spesifik ke job + requirements di atas (bukan template generik).
- Jangan mengulang soal klise yang sama tiap sesi.
- Campur behavioral / teknis / situational / komunikasi.
- Bahasa Indonesia, netral, singkat.

JSON saja: {"questions":[{"question_text":"...","focus_area":"behavioral|teknis|situational|komunikasi"}]}`;

  const parsed = await chatJson(
    prompt,
    "Generate UNIQUE job-specific async video interview questions each call. Never recycle generic templates. Valid JSON only. Bahasa Indonesia.",
    { maxTokens: 1100, temperature: 0.9 }
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
  const prompt = `Nilai jawaban interview async untuk recruiter. Jujur dan ketat.

JOB: ${params.jobTitle}
FOKUS: ${params.focusArea || "umum"}
PERTANYAAN: ${params.question}

JAWABAN KANDIDAT:
${params.answerText.slice(0, 8000)}

Rubrik skor (WAJIB diikuti):
- 0-25: kosong, off-topic, atau tidak menjawab pertanyaan
- 26-45: relevan tipis, dangkal, tanpa contoh
- 46-65: cukup relevan tapi kurang detail/contoh
- 66-80: relevan, jelas, ada contoh
- 81-100: sangat kuat, spesifik, siap kerja

Jika jawaban tidak relevan / tidak direkomendasikan untuk pertanyaan ini, skor HARUS ≤ 40.
Jangan pakai skor contoh; hitung dari rubrik di atas.

JSON saja (tanpa markdown):
{"score":<angka 0-100>,"feedback":"2-4 kalimat Bahasa Indonesia: kekuatan + kelemahan + saran"}`;

  const parsed = await chatJson(
    prompt,
    "Grade async interview answers strictly by the rubric. Never invent a high score for irrelevant answers. Valid JSON only. Bahasa Indonesia."
  );

  return {
    score: clampScore(parseScore(parsed.score)),
    feedback:
      typeof parsed.feedback === "string" && parsed.feedback
        ? parsed.feedback
        : "Tidak ada feedback.",
  };
}

/** Average of per-answer scores — overall number is never taken from the LLM. */
export function averageInterviewScore(
  scores: Array<number | null | undefined>
): number | null {
  const nums = scores.filter(
    (s): s is number => typeof s === "number" && !Number.isNaN(s)
  );
  if (nums.length === 0) return null;
  return clampScore(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function recommendationBand(score: number): string {
  if (score <= 39) return "tidak direkomendasikan";
  if (score <= 59) return "lemah — cadangan / perlu interview lanjutan";
  if (score <= 74) return "cukup — pertimbangkan dengan hati-hati";
  if (score <= 84) return "baik — layak lanjut";
  return "sangat kuat — direkomendasikan";
}

export async function rankInterviewSession(params: {
  jobTitle: string;
  answers: {
    question: string;
    answer: string;
    score: number | null;
    feedback: string | null;
  }[];
  /** Precomputed mean of answer scores — returned as overall_score. */
  overallScore: number;
}): Promise<{ overall_score: number; overall_summary: string }> {
  const overallScore = clampScore(params.overallScore);
  const band = recommendationBand(overallScore);
  const body = params.answers
    .map(
      (a, i) =>
        `${i + 1}. Q: ${a.question}\nScore: ${a.score ?? "-"}\nA: ${a.answer.slice(0, 1500)}\nFB: ${a.feedback || "-"}`
    )
    .join("\n\n");

  const prompt = `Rangkum async interview untuk job ${params.jobTitle}.

SKOR KESELURUHAN (sudah dihitung, JANGAN ubah): ${overallScore}/100
REKOMENDASI YANG HARUS SELARAS: ${band}

HASIL PER PERTANYAAN:
${body}

Tulis overall_summary 3-6 kalimat Bahasa Indonesia: gambaran umum, kekuatan, risiko, dan rekomendasi recruiter.
Rekomendasi di ringkasan HARUS selaras dengan skor ${overallScore} (${band}).
Jika skor rendah / jawaban tidak relevan, katakan jelas tidak / belum direkomendasikan — jangan memuji berlebihan.

JSON saja (tanpa markdown):
{"overall_summary":"..."}`;

  const parsed = await chatJson(
    prompt,
    "Summarize async interviews. Do not invent or change the overall score. Recommendation text must match the given score band. Valid JSON only. Bahasa Indonesia."
  );

  return {
    overall_score: overallScore,
    overall_summary:
      typeof parsed.overall_summary === "string" && parsed.overall_summary
        ? parsed.overall_summary
        : "Tidak ada ringkasan.",
  };
}

/**
 * Light face compare: selfie vs a still frame from the interview video.
 * Uses a vision model (separate from the text grading model).
 */
export async function compareInterviewFaces(params: {
  selfieDataUrl: string;
  faceFrameDataUrl: string;
}): Promise<{ status: FaceMatchStatus; note: string }> {
  const { baseUrl, apiKey } = detectProvider();
  if (!apiKey) {
    return {
      status: "manual",
      note: "API key AI tidak ada — bandingkan selfie vs frame secara manual.",
    };
  }

  const models = getVisionModelFallbacks();
  let lastHumanNote =
    "Face-match otomatis gagal — bandingkan selfie vs frame secara manual.";

  for (const model of models) {
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          ...(baseUrl.includes("openrouter.ai")
            ? {
                "HTTP-Referer":
                  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
                "X-Title": "Saring",
              }
            : {}),
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          messages: [
            {
              role: "system",
              content:
                "You compare two face photos for recruitment identity checks. Valid JSON only.",
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Bandingkan apakah foto 1 (selfie awal) dan foto 2 (frame dari video interview) kemungkinan orang yang sama.
Abaikan pencahayaan, sudut, dan kualitas rendah.
JSON saja:
{ "status": "match" | "mismatch" | "unclear", "note": "1 kalimat Bahasa Indonesia" }`,
                },
                {
                  type: "image_url",
                  image_url: { url: params.selfieDataUrl },
                },
                {
                  type: "image_url",
                  image_url: { url: params.faceFrameDataUrl },
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        lastHumanNote = humanizeVisionError(response.status, errText);
        // Try next model on 404 / missing endpoint
        if (
          response.status === 404 ||
          /no endpoints found/i.test(errText)
        ) {
          continue;
        }
        return { status: "manual", note: lastHumanNote };
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content || typeof content !== "string") {
        lastHumanNote =
          "Vision AI kosong — bandingkan selfie vs frame secara manual.";
        continue;
      }

      const parsed = extractJson(content);
      const raw =
        typeof parsed.status === "string" ? parsed.status.toLowerCase() : "";
      const status: FaceMatchStatus =
        raw === "match" || raw === "mismatch" || raw === "unclear"
          ? raw
          : "unclear";
      const note =
        typeof parsed.note === "string" && parsed.note.trim()
          ? parsed.note.trim()
          : "Tidak ada catatan face match.";

      return { status, note };
    } catch {
      lastHumanNote =
        "Face-match otomatis gagal — bandingkan selfie vs frame secara manual.";
    }
  }

  return { status: "manual", note: lastHumanNote };
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
