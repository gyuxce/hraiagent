/** First sentence / short line for decision-first UI. */
export function decisionLineFromSummary(
  summary: string | null | undefined,
  maxLen = 180
): string {
  const raw = (summary || "").replace(/\s+/g, " ").trim();
  if (!raw) return "";

  const match = raw.match(/^(.+?[.!?])(?:\s|$)/);
  let line = (match?.[1] || raw).trim();
  if (line.length > maxLen) {
    line = `${line.slice(0, maxLen - 1).trimEnd()}…`;
  }
  return line;
}
