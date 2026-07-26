/**
 * Cullr “Clownfish” palette — single light theme.
 * Keep CSS `:root` in sync with these values.
 */
export const CULLR_PALETTE = {
  ink: "#121019",
  navy: "#303856",
  coral: "#E16A40",
  mist: "#E9EFF5",
  teal: "#70E2DC",
} as const;

/** Status / score chips — only brand tokens (no Tailwind green/red/amber). */
export const CHIP = {
  good: "bg-secondary-soft text-secondary-hover",
  warn: "bg-accent-soft text-accent-hover",
  bad: "bg-accent-soft text-bad",
  neutral: "bg-mist text-muted",
  navy: "bg-mist-deep text-ink-soft",
  accent: "bg-accent-soft text-accent-hover",
} as const;

export function scoreChipClass(score: number | null | undefined): string {
  if (score == null) return CHIP.neutral;
  if (score >= 80) return CHIP.good;
  if (score >= 60) return CHIP.accent;
  if (score >= 40) return CHIP.navy;
  return CHIP.bad;
}

export function statusChipClass(status: string): string {
  switch (status) {
    case "hired":
    case "screened":
      return CHIP.good;
    case "interview":
    case "offer":
      return CHIP.navy;
    case "rejected":
      return CHIP.bad;
    case "submitted":
    default:
      return CHIP.neutral;
  }
}
