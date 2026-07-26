/** Strip appended identity block from AI overall_summary. */
export function stripIdentityBlock(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/\n*\[Identitas\][^\n]*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Split prose into short bullet points for dense mobile UI.
 * Prefers sentence boundaries; falls back to length chunks.
 */
export function summaryPoints(
  text: string | null | undefined,
  maxPoints = 4
): string[] {
  const raw = stripIdentityBlock(text);
  if (!raw) return [];

  const sentences = raw
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const points: string[] = [];
  for (const s of sentences) {
    if (points.length >= maxPoints) break;
    const clipped =
      s.length > 160 ? `${s.slice(0, 159).trimEnd()}…` : s;
    points.push(clipped);
  }

  if (points.length === 0) {
    points.push(raw.length > 160 ? `${raw.slice(0, 159).trimEnd()}…` : raw);
  }

  return points;
}
