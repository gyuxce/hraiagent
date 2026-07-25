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
    lower.endsWith(".docx")
  ) {
    return extractDocx(buffer);
  }

  if (mimeType === "application/msword" || lower.endsWith(".doc")) {
    throw new Error(
      "Format .doc lama belum didukung. Simpan sebagai .docx atau PDF lalu upload ulang."
    );
  }

  const text = buffer.toString("utf-8").trim();
  if (text.length > 50) return text;

  throw new Error("Tidak bisa membaca isi file. Gunakan PDF, DOCX, atau TXT.");
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

async function extractDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  const text = (result.value || "").trim();

  if (!text) {
    throw new Error("Dokumen Word kosong atau tidak berisi teks yang bisa dibaca");
  }

  return text;
}
