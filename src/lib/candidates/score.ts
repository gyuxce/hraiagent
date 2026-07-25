export function effectiveScore(candidate: {
  ai_score?: number | null;
  manual_score?: number | null;
}): number | null {
  if (candidate.manual_score != null) return candidate.manual_score;
  if (candidate.ai_score != null) return candidate.ai_score;
  return null;
}

export function scoreSource(candidate: {
  ai_score?: number | null;
  manual_score?: number | null;
}): "manual" | "ai" | null {
  if (candidate.manual_score != null) return "manual";
  if (candidate.ai_score != null) return "ai";
  return null;
}
