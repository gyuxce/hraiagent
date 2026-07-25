/** Lightweight helpers for async interview identity guards. */

const PLACEHOLDER_TRANSCRIPT =
  /^(?:\(jawaban video\)|tidak ada transkrip|n\/a|none|\.+)$/i;

export function isUsableTranscript(raw: string | null | undefined): boolean {
  const text = (raw || "").trim();
  if (text.length < 40) return false;
  if (PLACEHOLDER_TRANSCRIPT.test(text)) return false;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 8) return false;
  // Reject mostly-punctuation / garbage
  const letters = (text.match(/[a-zA-ZÀ-ÿ]/g) || []).length;
  return letters >= 20;
}

/** Normalize so "8 4 7", "847", "delapan..." still can match digits. */
export function transcriptMentionsChallengeCode(
  transcript: string | null | undefined,
  code: string | null | undefined
): boolean {
  if (!code || !transcript) return false;
  const digits = code.replace(/\D/g, "");
  if (digits.length < 3) return false;

  const compact = transcript.replace(/\D/g, "");
  if (compact.includes(digits)) return true;

  // Allow spaced digits: "8 4 7" or "8-4-7"
  const spaced = digits.split("").join("\\D*");
  try {
    return new RegExp(spaced).test(transcript);
  } catch {
    return false;
  }
}

export function generateChallengeCode(): string {
  return String(Math.floor(100 + Math.random() * 900)); // 100-999
}

/** Pick a middle-ish question for the spoken challenge (not always first). */
export function pickChallengeQuestionIndex(count: number): number {
  if (count <= 1) return 0;
  if (count === 2) return 1;
  // Prefer 2nd or 3rd question (0-based index 1 or 2)
  return Math.min(count - 1, 1 + Math.floor(Math.random() * Math.min(2, count - 1)));
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
