/** Lightweight helpers for async interview identity guards. */

const PLACEHOLDER_TRANSCRIPT =
  /^(?:\(jawaban video\)|tidak ada transkrip|n\/a|none|\.+)$/i;

const ID_DIGIT_WORDS: Record<string, string> = {
  nol: "0",
  kosong: "0",
  satu: "1",
  dua: "2",
  tiga: "3",
  empat: "4",
  lima: "5",
  enam: "6",
  tujuh: "7",
  delapan: "8",
  sembilan: "9",
};

export function isUsableTranscript(raw: string | null | undefined): boolean {
  const text = (raw || "").trim();
  if (text.length < 24) return false;
  if (PLACEHOLDER_TRANSCRIPT.test(text)) return false;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 5) return false;
  // Latin letters (incl. Indonesian) — digits alone are not enough
  const letters = (text.match(/[a-zA-ZÀ-ÿ]/g) || []).length;
  return letters >= 12;
}

/** Turn spoken digit words into digits: "delapan satu lima" → "815". */
export function spokenDigitsFromTranscript(transcript: string): string {
  const lower = transcript.toLowerCase();
  const tokens = lower.split(/[^a-zA-ZÀ-ÿ0-9]+/).filter(Boolean);
  let out = "";
  for (const tok of tokens) {
    if (/^\d+$/.test(tok)) {
      out += tok;
      continue;
    }
    if (ID_DIGIT_WORDS[tok]) {
      out += ID_DIGIT_WORDS[tok];
    }
  }
  return out;
}

/**
 * Parse simple Indonesian hundreds phrases into a number string.
 * e.g. "delapan ratus lima belas" → "815", "delapan ratus lima" → "805"
 */
export function spokenHundredsToDigits(transcript: string): string | null {
  const lower = ` ${transcript.toLowerCase()} `;
  const hundredsMatch = lower.match(
    /\b(satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan)\s+ratus\b/
  );
  if (!hundredsMatch) return null;
  const h = Number(ID_DIGIT_WORDS[hundredsMatch[1]]);
  if (!h) return null;

  let rest = 0;
  const after = lower.slice(
    lower.indexOf(hundredsMatch[0]) + hundredsMatch[0].length
  );

  const belas = after.match(
    /^\s*(sebelas|dua\s*belas|tiga\s*belas|empat\s*belas|lima\s*belas|enam\s*belas|tujuh\s*belas|delapan\s*belas|sembilan\s*belas)\b/
  );
  if (belas) {
    const map: Record<string, number> = {
      sebelas: 11,
      "dua belas": 12,
      "dua  belas": 12,
      "tiga belas": 13,
      "empat belas": 14,
      "lima belas": 15,
      "enam belas": 16,
      "tujuh belas": 17,
      "delapan belas": 18,
      "sembilan belas": 19,
    };
    const key = belas[1].replace(/\s+/g, " ");
    rest = map[key] ?? 0;
  } else {
    const puluh = after.match(
      /^\s*(satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan)\s+puluh(?:\s+(satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan))?\b/
    );
    if (puluh) {
      rest =
        Number(ID_DIGIT_WORDS[puluh[1]]) * 10 +
        (puluh[2] ? Number(ID_DIGIT_WORDS[puluh[2]]) : 0);
    } else {
      const ones = after.match(
        /^\s*(satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan)\b/
      );
      if (ones) rest = Number(ID_DIGIT_WORDS[ones[1]]);
    }
  }

  return String(h * 100 + rest);
}

/** Normalize so "8 4 7", "847", "delapan satu lima", "delapan ratus…" can match. */
export function transcriptMentionsChallengeCode(
  transcript: string | null | undefined,
  code: string | null | undefined
): boolean {
  if (!code || !transcript) return false;
  const digits = code.replace(/\D/g, "");
  if (digits.length < 3) return false;

  const compact = transcript.replace(/\D/g, "");
  if (compact.includes(digits)) return true;

  const spaced = digits.split("").join("\\D*");
  try {
    if (new RegExp(spaced).test(transcript)) return true;
  } catch {
    /* ignore */
  }

  const spoken = spokenDigitsFromTranscript(transcript);
  if (spoken.includes(digits)) return true;

  const hundreds = spokenHundredsToDigits(transcript);
  if (hundreds && hundreds.includes(digits)) return true;

  return false;
}

/** True if any answer transcript mentions the challenge code. */
export function anyTranscriptMentionsChallengeCode(
  transcripts: Array<string | null | undefined>,
  code: string | null | undefined
): boolean {
  return transcripts.some((t) => transcriptMentionsChallengeCode(t, code));
}

export function generateChallengeCode(): string {
  return String(Math.floor(100 + Math.random() * 900)); // 100-999
}

/** Pick a middle-ish question for the spoken challenge (not always first). */
export function pickChallengeQuestionIndex(count: number): number {
  if (count <= 1) return 0;
  if (count === 2) return 1;
  return Math.min(
    count - 1,
    1 + Math.floor(Math.random() * Math.min(2, count - 1))
  );
}

export type FaceMatchStatus =
  | "pending"
  | "match"
  | "mismatch"
  | "unclear"
  | "skipped"
  | "manual";

export function buildIdentitySummary(params: {
  hasSelfie: boolean;
  challengePassed: boolean | null;
  faceMatchStatus: FaceMatchStatus | null;
  weakTranscriptCount: number;
  totalAnswers: number;
}): { needsManualReview: boolean; summary: string } {
  const flags: string[] = [];
  let needsManualReview = false;

  if (!params.hasSelfie) {
    flags.push("Selfie tidak ada");
    needsManualReview = true;
  } else {
    flags.push("Selfie OK");
  }

  if (params.challengePassed === true) {
    flags.push("Kode tantangan disebut di transkrip");
  } else if (params.challengePassed === false) {
    flags.push("Kode tantangan TIDAK terdeteksi di transkrip");
    needsManualReview = true;
  } else {
    flags.push("Kode tantangan belum dicek");
  }

  switch (params.faceMatchStatus) {
    case "match":
      flags.push("Face match: mirip");
      break;
    case "mismatch":
      flags.push("Face match: BERBEDA — curiga joki");
      needsManualReview = true;
      break;
    case "unclear":
      flags.push("Face match: tidak jelas");
      needsManualReview = true;
      break;
    case "manual":
    case "skipped":
      flags.push("Face match: cek manual (selfie vs frame video)");
      needsManualReview = true;
      break;
    default:
      flags.push("Face match: pending");
      needsManualReview = true;
  }

  if (params.weakTranscriptCount > 0) {
    flags.push(
      `${params.weakTranscriptCount}/${params.totalAnswers} jawaban tanpa transkrip layak skor AI`
    );
    needsManualReview = true;
  }

  return {
    needsManualReview,
    summary: flags.join(" · "),
  };
}

/** Human-readable note for vision / face-match failures (no raw JSON). */
export function humanizeVisionError(status: number, body: string): string {
  const lower = body.toLowerCase();
  if (status === 404 || lower.includes("no endpoints found")) {
    return "Layanan face-match sementara tidak tersedia — bandingkan selfie vs frame secara manual.";
  }
  if (status === 401 || status === 403) {
    return "Akses AI vision ditolak — cek API key, lalu bandingkan manual.";
  }
  if (status === 429) {
    return "Kuota vision AI penuh — coba lagi nanti, atau bandingkan manual.";
  }
  if (status >= 500) {
    return "Server vision AI bermasalah — bandingkan selfie vs frame secara manual.";
  }
  return "Face-match otomatis gagal — bandingkan selfie vs frame secara manual.";
}
