/** Short UI blurbs — first sentence, capped. */
export function shortSummary(
  text: string | null | undefined,
  maxLen = 140
): string {
  const raw = (text || "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  const match = raw.match(/^(.+?[.!?])(?:\s|$)/);
  let line = (match?.[1] || raw).trim();
  if (line.length > maxLen) {
    line = `${line.slice(0, maxLen - 1).trimEnd()}…`;
  }
  return line;
}
