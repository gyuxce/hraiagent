/** Fast local heuristics so we don't wait on AI to fill name/email/phone. */

export function extractContactHints(cvText: string): {
  name: string | null;
  email: string | null;
  phone: string | null;
} {
  const text = (cvText || "").replace(/\r/g, "\n");
  const email =
    text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.trim() || null;

  const phoneRaw =
    text.match(
      /(?:\+62|62|0)[\d\s().-]{8,18}\d/
    )?.[0] || null;
  const phone = phoneRaw
    ? phoneRaw.replace(/[^\d+]/g, "").replace(/^62/, "+62")
    : null;

  const skip =
    /^(curriculum|resume|cv|profil|profile|pengalaman|experience|pendidikan|education|skill|kontak|contact|alamat|address)/i;

  let name: string | null = null;
  for (const line of text.split("\n").map((l) => l.trim()).filter(Boolean)) {
    if (line.length < 3 || line.length > 60) continue;
    if (line.includes("@") || skip.test(line)) continue;
    if (/^\d/.test(line)) continue;
    if (!/[A-Za-zÀ-ÿ]/.test(line)) continue;
    // Prefer 2–4 word person-like lines
    const words = line.split(/\s+/);
    if (words.length >= 2 && words.length <= 5) {
      name = line.replace(/\s+/g, " ");
      break;
    }
    if (!name && words.length === 1 && words[0].length >= 3) {
      name = words[0];
    }
  }

  return { name, email, phone };
}
