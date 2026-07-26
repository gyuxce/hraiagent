/** Fast local heuristics so we don't wait on AI to fill name/email/phone. */

export function looksLikePhone(value: string | null | undefined): boolean {
  if (!value) return false;
  const s = value.trim();
  if (!s) return false;
  // +62… / 08… / bare digits, optionally with (Mobile)/(WhatsApp)
  if (/^[\d+\s().-]{8,}(\s*\([^)]*\))?$/i.test(s)) return true;
  if (/(?:\+62|62|08)\d[\d\s().-]{6,}/.test(s) && s.replace(/\D/g, "").length >= 9) {
    return true;
  }
  if (/\b(mobile|whatsapp|telp|telepon|phone|hp)\b/i.test(s) && /\d{6,}/.test(s)) {
    return true;
  }
  return false;
}

export function looksLikePersonName(value: string | null | undefined): boolean {
  if (!value) return false;
  const s = value.trim().replace(/\s+/g, " ");
  if (s.length < 2 || s.length > 60) return false;
  if (looksLikePhone(s)) return false;
  if (s.includes("@")) return false;
  if (/https?:\/\//i.test(s)) return false;
  if (!/[A-Za-zÀ-ÿ]/.test(s)) return false;
  // Must contain letters beyond a parenthetical label
  const letters = s.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (letters.length < 2) return false;
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

  const skip =
    /^(curriculum|resume|cv|profil|profile|pengalaman|experience|pendidikan|education|skill|kontak|contact|alamat|address|email|phone|telp|telepon|mobile|whatsapp)/i;

  let name: string | null = null;
  for (const line of text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)) {
    if (!looksLikePersonName(line)) continue;
    if (skip.test(line)) continue;
    if (/^\d/.test(line) || line.startsWith("+")) continue;
    const words = line.split(/\s+/);
    if (words.length >= 2 && words.length <= 5) {
      name = line;
      break;
    }
    if (!name && words.length === 1 && words[0].length >= 3) {
      name = words[0];
    }
  }

  if (name && looksLikePhone(name)) name = null;

  return { name, email, phone };
}
