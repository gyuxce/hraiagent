/** Fast local heuristics so we don't wait on AI to fill name/email/phone. */

const SECTION_OR_LABEL =
  /^(curriculum|resume|cv|profil|profile|pengalaman|experience|pendidikan|education|skill|skills|keahlian|kontak|contact|alamat|address|email|phone|telp|telepon|mobile|whatsapp|ringkasan|summary|objective|tentang|about|sertifikat|certifications?|bahasa|language|referensi|reference|minat|interest|proyek|project|organisasi|organization|prestasi|achievement|top\s*skills?|keahlian\s*teratas|skills?\s*utama|data\s*pribadi|personal\s*data|identitas|nama|name|posisi|position|judul|title|hubungi|contact\s*info)/i;

/** Job/skill phrases that LinkedIn PDFs put above the real name. */
const BUSINESS_JARGON =
  /\b(strategy|strategies|business|growth|development|marketing|operations|operation|copywriting|customer|service|services|lead|leader|manager|management|analyst|consultant|specialist|engineer|designer|product|sales|visibility|systems?|coaching|kpi|content|certifications?|linkedin|helping|founding|founder|team\s*lead|live\s*chat)\b/i;

export function looksLikePhone(value: string | null | undefined): boolean {
  if (!value) return false;
  const s = value.trim();
  if (!s) return false;
  if (/^[\d+\s().-]{8,}(\s*\([^)]*\))?$/i.test(s)) return true;
  if (
    /(?:\+62|62|08)\d[\d\s().-]{6,}/.test(s) &&
    s.replace(/\D/g, "").length >= 9
  ) {
    return true;
  }
  if (
    /\b(mobile|whatsapp|telp|telepon|phone|hp)\b/i.test(s) &&
    /\d{6,}/.test(s)
  ) {
    return true;
  }
  return false;
}

export function looksLikeSectionHeader(value: string | null | undefined): boolean {
  if (!value) return false;
  const s = value.trim().replace(/\s+/g, " ");
  if (SECTION_OR_LABEL.test(s)) return true;
  if (
    /\b(keahlian|skills?|experience|pengalaman|education|pendidikan|teratas|utama|summary|ringkasan|certifications?)\b/i.test(
      s
    ) &&
    !/\b(bin|binti)\b/i.test(s)
  ) {
    const words = s.split(/\s+/);
    if (words.length <= 4) return true;
  }
  return false;
}

export function looksLikeSkillOrTitle(value: string | null | undefined): boolean {
  if (!value) return false;
  const s = value.trim().replace(/\s+/g, " ");
  if (BUSINESS_JARGON.test(s)) return true;
  return false;
}

export function looksLikePersonName(value: string | null | undefined): boolean {
  if (!value) return false;
  const s = value.trim().replace(/\s+/g, " ");
  if (s.length < 2 || s.length > 60) return false;
  if (looksLikePhone(s)) return false;
  if (looksLikeSectionHeader(s)) return false;
  if (looksLikeSkillOrTitle(s)) return false;
  if (s.includes("@")) return false;
  if (/https?:\/\//i.test(s) || /linkedin\.com/i.test(s)) return false;
  if (!/[A-Za-zÀ-ÿ]/.test(s)) return false;
  if (/[,:;|/]/.test(s)) return false;
  const letters = s.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (letters.length < 2) return false;
  const words = s.split(/\s+/);
  if (words.length < 2 || words.length > 5) return false;
  // Each word should look like a name token (letters, optional punctuation)
  if (!words.every((w) => /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'.-]*$/.test(w))) return false;
  if (words.every((w) => SECTION_OR_LABEL.test(w))) return false;
  return true;
}

function compactLetters(s: string): string {
  return s.toLowerCase().replace(/[^a-z]/g, "");
}

/** Prefer names that align with email local-part (yugegirip ↔ Yuge Giri Purboyo). */
export function nameMatchesEmail(
  name: string | null | undefined,
  email: string | null | undefined
): boolean {
  if (!name || !email) return false;
  const local = compactLetters(email.split("@")[0] || "");
  const compact = compactLetters(name);
  if (local.length < 4 || compact.length < 4) return false;
  const a = local.slice(0, Math.min(8, local.length));
  const b = compact.slice(0, Math.min(8, compact.length));
  return local.includes(b) || compact.includes(a) || local.includes(compact.slice(0, 6));
}

export function extractContactHints(cvText: string): {
  name: string | null;
  email: string | null;
  phone: string | null;
} {
  const text = (cvText || "").replace(/\r/g, "\n");
  const email =
    text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.trim() || null;

  const phoneRaw =
    text.match(/(?:\+62|62|0)[\d\s().-]{8,18}\d/)?.[0] || null;
  const phone = phoneRaw
    ? phoneRaw.replace(/[^\d+]/g, "").replace(/^62/, "+62")
    : null;

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  type Cand = { line: string; score: number };
  const cands: Cand[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!looksLikePersonName(line)) continue;
    if (/^\d/.test(line) || line.startsWith("+")) continue;

    let score = 10;
    const words = line.split(/\s+/);
    if (words.length >= 3) score += 8;
    if (words.length === 2) score += 3;
    if (nameMatchesEmail(line, email)) score += 40;

    const next = lines[i + 1] || "";
    const prev = lines[i - 1] || "";
    // LinkedIn: name often followed by headline / preceded by certifications block
    if (
      /helping|passionate|experienced|professional|operations|yogyakarta|indonesia/i.test(
        next
      ) ||
      next.length > 40
    ) {
      score += 12;
    }
    if (/certifications?|keahlian|skills?|pendidikan|education/i.test(prev)) {
      score += 6;
    }
    // Deprioritize early skill-cloud lines (first 15% of doc) unless email-matched
    if (i < Math.max(3, Math.floor(lines.length * 0.12)) && !nameMatchesEmail(line, email)) {
      score -= 15;
    }

    cands.push({ line, score });
  }

  cands.sort((a, b) => b.score - a.score);
  const name = cands[0] && cands[0].score > 0 ? cands[0].line : null;

  return { name, email, phone };
}
