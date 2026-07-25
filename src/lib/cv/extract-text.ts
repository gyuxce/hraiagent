export async function extractTextFromFile(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<string> {
  const lower = fileName.toLowerCase();

  if (mimeType === "application/pdf" || lower.endsWith(".pdf")) {
    return extractPdf(buffer);
  }

  if (mimeType === "text/plain" || lower.endsWith(".txt")) {
    return buffer.toString("utf-8");
  }

  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower.endsWith(".docx") ||
    mimeType === "application/msword" ||
    lower.endsWith(".doc")
  ) {
    throw new Error(
      "Format Word belum didukung. Upload CV dalam format PDF atau TXT."
    );
  }

  const text = buffer.toString("utf-8").trim();
  if (text.length > 50) return text;

  throw new Error("Tidak bisa membaca isi file. Gunakan PDF atau TXT.");
}

async function extractPdf(buffer: Buffer): Promise<string> {
  const { extractText } = await import("unpdf");
  const result = await extractText(new Uint8Array(buffer), {
    mergePages: true,
  });

  const raw = result.text as unknown;
  const text = Array.isArray(raw)
    ? raw.join("\n")
    : typeof raw === "string"
      ? raw
      : "";

  if (!text.trim()) {
    throw new Error("PDF tidak berisi teks (mungkin hasil scan/gambar)");
  }

  return text.trim();
}
