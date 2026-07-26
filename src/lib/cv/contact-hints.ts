/** Fast local heuristics so we don't wait on AI to fill name/email/phone. */

const SECTION_OR_LABEL =
  /^(curriculum|resume|cv|profil|profile|pengalaman|experience|pendidikan|education|skill|skills|keahlian|kontak|contact|alamat|address|email|phone|telp|telepon|mobile|whatsapp|ringkasan|summary|objective|tentang|about|sertifikat|certificate|bahasa|language|referensi|reference|minat|interest|proyek|project|organisasi|organization|prestasi|achievement|top\s*skills?|keahlian\s*teratas|skills?\s*utama|data\s*pribadi|personal\s*data|identitas|nama|name|posisi|position|judul|title)/i;

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
    /\b(keahlian|skills?|experience|pengalaman|education|pendidikan|teratas|utama|summary|ringkasan)\b/i.test(
      s
    ) &&
    !/\b(bin|binti|s\.|dr\.|ir\.)\b/i.test(s)
  ) {
    // "Keahlian Teratas", "Top Skills", etc. — not a person
    const words = s.split(/\s+/);
    if (words.length <= 4) return true;
  }
  return false;
}

export function looksLikePersonName(value: string | null | undefined): boolean {
  if (!value) return false;
  const s = value.trim().replace(/\s+/g, " ");
  if (s.length < 2 || s.length > 60) return false;
  if (looksLikePhone(s)) return false;
  if (looksLikeSectionHeader(s)) return false;
  if (s.includes("@")) return false;
  if (/https?:\/\//i.test(s)) return false;
  if (!/[A-Za-zÀ-ÿ]/.test(s)) return false;
  const letters = s.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (letters.length < 2) return false;
  // Prefer names with at least one capital letter (person names), reject ALL CAPS section-ish
  const words = s.split(/\s+/);
  if (words.length < 1 || words.length > 5) return false;
  // Reject if every word is a common section noun
  if (words.every((w) => SECTION_OR_LABEL.test(w))) return false;
  return true;
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

  let name: string | null = null;
  for (const line of text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)) {
    if (!looksLikePersonName(line)) continue;
    if (/^\d/.test(line) || line.startsWith("+")) continue;
    const words = line.split(/\s+/);
    // Strong preference: 2–4 Title-Case-ish words
    if (words.length >= 2 && words.length <= 4) {
      name = line;
      break;
    }
    if (!name && words.length === 1 && words[0].length >= 3) {
      name = words[0];
    }
  }

  if (name && (!looksLikePersonName(name) || looksLikePhone(name))) {
    name = null;
  }

  return { name, email, phone };
}
